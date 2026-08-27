import { NextRequest, NextResponse } from "next/server";
import { FREE_CREDIT_TOTAL, getBalance, isBillingEnabled, listLedger } from "@/lib/billing";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  try {
    const { balance, paidCredits, consumed } = await getBalance(user.id);
    const ledger = await listLedger(user.id, 30);
    const freeUsed = Math.min(FREE_CREDIT_TOTAL, consumed);

    return NextResponse.json({
      billingEnabled: isBillingEnabled(),
      balance,
      freeTotal: FREE_CREDIT_TOTAL,
      freeUsed,
      freeRemaining: Math.max(0, FREE_CREDIT_TOTAL - freeUsed),
      paidCredits,
      ledger,
    });
  } catch (error) {
    console.error("Balance lookup failed", error);
    return NextResponse.json({ error: "余额读取失败，请稍后重试。" }, { status: 500 });
  }
}
