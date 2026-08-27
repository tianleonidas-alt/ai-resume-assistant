import { createAdminSupabaseClient } from "./supabase/admin";

export const FREE_CREDIT_TOTAL = 2;

export type BillingPack = {
  id: string;
  credits: number;
  price: string;
  productId: string;
};

export type BalanceSummary = {
  balance: number;
  paidCredits: number;
  consumed: number;
};

export type LlmUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
} | null;

export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

export function billingCurrency(): string {
  return process.env.BILLING_CURRENCY || "USD";
}

/**
 * 点数包配置：BILLING_PACKS=credits:price:productId,credits:price:productId
 * 例如 "10:9.9:PROD_x,50:39.9:PROD_y,100:69.9:PROD_z"
 */
export function parsePacks(): BillingPack[] {
  const raw = process.env.BILLING_PACKS || "";
  return raw
    .split(",")
    .map((part) => {
      const [creditsRaw, priceRaw, productIdRaw] = part.split(":");
      const credits = Number(creditsRaw);
      if (!Number.isFinite(credits) || credits <= 0 || !priceRaw) return null;
      return {
        id: creditsRaw,
        credits,
        price: priceRaw,
        productId: productIdRaw || "",
      };
    })
    .filter((pack): pack is BillingPack => pack !== null);
}

export async function getBalance(userId: string): Promise<BalanceSummary> {
  const admin = createAdminSupabaseClient();
  try {
    await admin.rpc("release_stale_credits", { p_user: userId });
  } catch {
    // 清理失败不影响余额读取。
  }
  const { data, error } = await admin
    .from("credit_ledger")
    .select("event_type, amount")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = (data || []) as { event_type: string; amount: number }[];
  let balance = 0;
  let paidCredits = 0;
  let consumed = 0;
  for (const row of rows) {
    balance += row.amount;
    if (row.event_type === "consume") consumed += 1;
    else if (row.amount > 0) paidCredits += row.amount;
  }
  return { balance, paidCredits, consumed };
}

/**
 * 原子预扣 1 点（成功才算消耗：任务成功则保留预扣，失败则 releaseCredit 释放）。
 * 计费关闭时直接放行，不落账。
 */
export async function reserveCredit(userId: string, eventRef: string, note: string): Promise<boolean> {
  if (!isBillingEnabled()) return true;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("reserve_credit", {
    p_user: userId,
    p_ref: eventRef,
    p_note: note,
  });
  if (error) throw error;
  return data === true;
}

/** 释放预扣（任务失败/异常时调用）；失败由过期清理兜底。 */
export async function releaseCredit(userId: string, eventRef: string): Promise<void> {
  if (!isBillingEnabled()) return;
  try {
    const admin = createAdminSupabaseClient();
    await admin.rpc("release_credit", { p_user: userId, p_ref: eventRef });
  } catch {
    // 忽略：超时预扣会由 release_stale_credits 清理。
  }
}

export async function recordLlmUsage(input: {
  userId: string;
  provider: string;
  model: string;
  purpose: "analysis" | "resume_page";
  eventRef: string | null;
  usage: LlmUsage;
}): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    await admin.from("llm_usage_events").insert({
      user_id: input.userId,
      provider: input.provider,
      model: input.model,
      purpose: input.purpose,
      event_ref: input.eventRef,
      prompt_tokens: input.usage?.promptTokens ?? null,
      completion_tokens: input.usage?.completionTokens ?? null,
      total_tokens: input.usage?.totalTokens ?? null,
    });
  } catch {
    // 用量统计失败不影响业务。
  }
}

export async function listLedger(userId: string, limit = 50) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("credit_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
