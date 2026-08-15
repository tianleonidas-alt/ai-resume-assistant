import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";

export async function POST(request: NextRequest) {
  let email = "";
  let password = "";

  try {
    const body = await request.json() as { email?: string; password?: string };
    email = body.email?.trim() || "";
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "登录信息格式不正确。" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "请输入邮箱和密码。" }, { status: 400 });
  }

  const { supabase, applySessionCookies } = createRouteSupabaseClient(request);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user || !data.session) {
    if (error) {
      // Keep only non-sensitive diagnostics for local troubleshooting.
      console.warn("[auth][login] rejected", { status: error.status, code: error.code || "unknown" });
    }
    const confirmationRequired = error?.message.toLowerCase().includes("confirm");
    return applySessionCookies(NextResponse.json(
      confirmationRequired
        ? { error: "邮箱尚未确认。请完成确认，或重新发送确认邮件。", code: "email_not_confirmed" }
        : { error: "邮箱或密码不正确，请重试。" },
      { status: 401 },
    ));
  }

  return applySessionCookies(NextResponse.json({
    user: { id: data.user.id, email: data.user.email || null },
  }));
}
