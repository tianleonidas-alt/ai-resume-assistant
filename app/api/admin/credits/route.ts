import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = process.env.ADMIN_CREDITS_TOKEN;
  if (!token) return new Response("Not found", { status: 404 });

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "未授权。" }, { status: 401 });
  }

  let email = "";
  let amount = 0;
  let note = "";
  try {
    const body = await request.json() as { email?: string; amount?: number; note?: string };
    email = String(body.email || "").trim();
    amount = typeof body.amount === "number" && Number.isInteger(body.amount) ? body.amount : 0;
    note = String(body.note || "").trim().slice(0, 200);
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  if (!email || amount <= 0) {
    return NextResponse.json({ error: "请提供邮箱和正数点数。" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  let userId: string | null = null;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      userId = match.id;
      break;
    }
    if (data.users.length < 200) break;
  }

  if (!userId) {
    return NextResponse.json({ error: "未找到该邮箱对应的账号。" }, { status: 404 });
  }

  const { error: ledgerError } = await admin.from("credit_ledger").insert({
    user_id: userId,
    event_type: "admin_grant",
    amount,
    note: note || "运营加点",
  });
  if (ledgerError) {
    console.error("Admin grant failed", ledgerError);
    return NextResponse.json({ error: "加点失败，请稍后重试。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId, amount });
}
