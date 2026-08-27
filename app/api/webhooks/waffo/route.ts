import { NextResponse } from "next/server";
import { WebhookEventType } from "@waffo/pancake-ts";
import { verifyWaffoWebhook } from "@/lib/payments/waffo";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-waffo-signature");

  let event: { eventType: WebhookEventType; data: Record<string, unknown> };
  try {
    event = verifyWaffoWebhook(body, signature) as { eventType: WebhookEventType; data: Record<string, unknown> };
  } catch (error) {
    console.error("Waffo webhook signature verification failed", error);
    return new Response("Invalid signature", { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  if (event.eventType === WebhookEventType.OrderCompleted) {
    const data = event.data as {
      orderId?: string;
      orderMerchantExternalId?: string;
      orderMetadata?: Record<string, string>;
    };
    const ourOrderId = data.orderMerchantExternalId || data.orderMetadata?.orderId;
    if (!ourOrderId) {
      console.warn("Waffo webhook missing order reference", event.data);
      return NextResponse.json({ received: true });
    }

    const { data: order, error: lookupError } = await admin
      .from("payment_orders")
      .select("id, user_id, credits, status")
      .eq("id", ourOrderId)
      .maybeSingle();
    if (lookupError || !order) {
      console.warn("Waffo webhook order not found", ourOrderId);
      return NextResponse.json({ received: true });
    }

    if (order.status === "pending") {
      const paidAt = new Date().toISOString();
      // 先记账（幂等），再置订单 paid；任一步失败返回 500 让 Waffo 重试，重试可自愈且不重复加点。
      const { error: ledgerError } = await admin
        .from("credit_ledger")
        .upsert(
          {
          user_id: order.user_id,
          event_type: "purchase",
          event_ref: order.id,
          amount: order.credits,
          note: `Waffo 支付成功 · ${order.credits} 次点数包`,
          },
          { onConflict: "user_id,event_type,event_ref", ignoreDuplicates: true },
        );
      if (ledgerError) {
        console.error("Purchase credit insert failed", ledgerError);
        return new Response("Internal error", { status: 500 });
      }

      const { error: updateError } = await admin
        .from("payment_orders")
        .update({ status: "paid", waffo_order_id: data.orderId ?? null, paid_at: paidAt })
        .eq("id", order.id)
        .eq("status", "pending");
      if (updateError) {
        console.error("Order paid update failed", updateError);
        return new Response("Internal error", { status: 500 });
      }
    }
  } else if (event.eventType === WebhookEventType.RefundSucceeded) {
    // 本期不做自动退款冲正；仅记录日志，退款由 Waffo 客服处理。
    console.log("Waffo refund succeeded", event.data.orderMerchantExternalId || event.data.orderId);
  }

  return NextResponse.json({ received: true });
}
