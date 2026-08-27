import { NextRequest, NextResponse } from "next/server";
import { billingCurrency, isBillingEnabled, parsePacks } from "@/lib/billing";
import { createWaffoCheckout, isWaffoConfigured, waffoErrorMessage } from "@/lib/payments/waffo";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "支付功能暂未开放，请稍后再试。" }, { status: 403 });
  }
  if (!isWaffoConfigured()) {
    return NextResponse.json({ error: "支付功能配置中，请稍后再试。", code: "PAYMENT_NOT_CONFIGURED" }, { status: 503 });
  }

  let packId = "";
  try {
    const body = await request.json() as { packId?: string };
    packId = typeof body.packId === "string" ? body.packId : "";
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const pack = parsePacks().find((item) => item.id === packId);
  if (!pack || !pack.productId) {
    return NextResponse.json({ error: "点数包不存在或尚未配置。" }, { status: 400 });
  }

  const { supabase } = createRouteSupabaseClient(request);
  const { data: claimsData } = await supabase.auth.getClaims();
  const buyerEmail = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : undefined;

  const currency = billingCurrency();
  const amountCents = Math.round(parseFloat(pack.price) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "点数包价格配置异常。" }, { status: 500 });
  }

  const admin = createAdminSupabaseClient();
  const orderId = crypto.randomUUID();
  const { error: insertError } = await admin.from("payment_orders").insert({
    id: orderId,
    user_id: user.id,
    pack_id: pack.id,
    credits: pack.credits,
    amount_cents: amountCents,
    currency,
    status: "pending",
  });
  if (insertError) {
    console.error("Order insert failed", insertError);
    return NextResponse.json({ error: "订单创建失败，请稍后重试。" }, { status: 500 });
  }

  try {
    const origin = new URL(request.url).origin;
    const session = await createWaffoCheckout({
      productId: pack.productId,
      currency,
      buyerEmail,
      successUrl: `${origin}/credits?status=success&order=${orderId}`,
      orderMerchantExternalId: orderId,
      metadata: { orderId },
    });

    await admin.from("payment_orders").update({ waffo_session_id: session.sessionId }).eq("id", orderId);

    return NextResponse.json({ checkoutUrl: session.checkoutUrl, orderId });
  } catch (error) {
    console.error("Checkout session failed", error);
    await admin.from("payment_orders").update({ status: "failed" }).eq("id", orderId);
    return NextResponse.json({ error: waffoErrorMessage(error) }, { status: 502 });
  }
}
