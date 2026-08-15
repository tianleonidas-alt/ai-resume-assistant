import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";

export async function POST(request: NextRequest) {
  let password = "";
  try {
    const body = await request.json() as { password?: string };
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "密码信息格式不正确。" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "密码至少需要 8 位。" }, { status: 400 });
  }

  const { supabase, applySessionCookies } = createRouteSupabaseClient(request);
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || typeof claimsData?.claims?.sub !== "string") {
    return applySessionCookies(NextResponse.json({ error: "重设会话已失效，请重新申请链接。" }, { status: 401 }));
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return applySessionCookies(NextResponse.json({ error: "更新密码失败，请重新申请重设链接。" }, { status: 400 }));
  }

  return applySessionCookies(NextResponse.json({ ok: true }));
}
