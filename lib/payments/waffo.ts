import { WaffoPancake, verifyWebhook, WaffoPancakeError } from "@waffo/pancake-ts";

export type WaffoEnvironment = "test" | "prod";

export function waffoEnvironment(): WaffoEnvironment {
  return process.env.WAFFO_ENVIRONMENT === "prod" ? "prod" : "test";
}

export function waffoStoreId(): string {
  return process.env.WAFFO_STORE_ID || "";
}

export function isWaffoConfigured(): boolean {
  return Boolean(process.env.WAFFO_MERCHANT_ID && (process.env.WAFFO_PRIVATE_KEY || process.env.WAFFO_PRIVATE_KEY_BASE64));
}

export function resolveWaffoPrivateKey(): string {
  if (process.env.WAFFO_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.WAFFO_PRIVATE_KEY_BASE64, "base64").toString("utf-8");
  }
  if (process.env.WAFFO_PRIVATE_KEY) return process.env.WAFFO_PRIVATE_KEY;
  throw new Error("Waffo 私钥未配置（WAFFO_PRIVATE_KEY 或 WAFFO_PRIVATE_KEY_BASE64）。");
}

export function getWaffoClient(): WaffoPancake {
  const merchantId = process.env.WAFFO_MERCHANT_ID;
  if (!merchantId) throw new Error("Waffo 商户号未配置。");
  return new WaffoPancake({
    merchantId,
    privateKey: resolveWaffoPrivateKey(),
    environment: waffoEnvironment(),
  });
}

export async function createWaffoCheckout(params: {
  productId: string;
  currency: string;
  buyerEmail?: string;
  successUrl: string;
  orderMerchantExternalId: string;
  metadata: Record<string, string>;
}) {
  const client = getWaffoClient();
  return client.checkout.createSession({
    productId: params.productId,
    currency: params.currency,
    buyerEmail: params.buyerEmail || undefined,
    successUrl: params.successUrl,
    expiresInSeconds: 3600,
    orderMerchantExternalId: params.orderMerchantExternalId,
    metadata: params.metadata,
  });
}

export function verifyWaffoWebhook(body: string, signature: string | null | undefined) {
  return verifyWebhook(body, signature, { environment: waffoEnvironment() });
}

export function waffoErrorMessage(error: unknown): string {
  if (error instanceof WaffoPancakeError) {
    return error.errors?.[0]?.message || error.message;
  }
  return error instanceof Error ? error.message : "支付服务异常，请稍后重试。";
}

export { WaffoPancakeError };
