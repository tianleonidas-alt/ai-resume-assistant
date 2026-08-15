import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";

function signupErrorMessage(error: { code?: string; message?: string; status?: number }) {
  const text = `${error.code || ""} ${error.message || ""}`.toLowerCase();

  if (error.status === 429 || text.includes("rate limit")) {
    return "注册请求过于频繁，请稍等一会儿后再试。";
  }
  if (text.includes("signup") && (text.includes("disabled") || text.includes("not allowed"))) {
    return "Supabase 当前关闭了新用户注册。请在 Dashboard 的 Authentication → Sign In / Providers 中开启 User signups。";
  }
  if (text.includes("invalid") && text.includes("email")) {
    return "请输入格式正确的邮箱地址。";
  }
  if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
    return "该邮箱已有账户，请切换到“登录”；忘记密码时可使用“忘记密码？”重设。";
  }

  return "账户暂时无法创建，请稍后再试。";
}

export async function POST(request: NextRequest) {
  let email = "";
  let password = "";

  try {
    const body = await request.json() as { email?: string; password?: string };
    email = body.email?.trim() || "";
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "注册信息格式不正确。" }, { status: 400 });
  }

  if (!email || password.length < 8) {
    return NextResponse.json({ error: "请输入邮箱和至少 8 位的密码。" }, { status: 400 });
  }

  const { supabase, applySessionCookies } = createRouteSupabaseClient(request);
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    if (error) {
      // Only retain non-sensitive diagnostic fields. Do not log email, password, or tokens.
      console.warn("[auth][signup] rejected", { status: error.status, code: error.code || "unknown" });
    } else {
      console.warn("[auth][signup] rejected", { status: "unknown", code: "missing_user" });
    }
    return applySessionCookies(NextResponse.json(
      { error: signupErrorMessage(error || {}) },
      { status: 400 },
    ));
  }

  if (!data.session) {
    return applySessionCookies(NextResponse.json(
      { error: "账户未能直接登录。请确认 Supabase 已关闭“Confirm email”后重试。" },
      { status: 409 },
    ));
  }

  return applySessionCookies(NextResponse.json({
    user: { id: data.user.id, email: data.user.email || null },
  }));
}
