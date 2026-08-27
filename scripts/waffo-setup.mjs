/**
 * Waffo Pancake 初始化脚本：
 * 1. 为三档点数包创建一次性商品（如果尚未创建）
 * 2. 配置测试环境 Webhook（指向 /api/webhooks/waffo）
 *
 * 运行前设置环境变量：
 *   WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY 或 WAFFO_PRIVATE_KEY_BASE64 /
 *   WAFFO_STORE_ID / WAFFO_ENVIRONMENT / BILLING_CURRENCY / BILLING_PACKS /
 *   WAFFO_WEBHOOK_URL（如 https://tianzhaoqun.top/api/webhooks/waffo）
 *
 * 输出商品 ID，用于填写 BILLING_PACKS。
 */
import { WaffoPancake } from "@waffo/pancake-ts";

const merchantId = process.env.WAFFO_MERCHANT_ID;
const privateKey = process.env.WAFFO_PRIVATE_KEY_BASE64
  ? Buffer.from(process.env.WAFFO_PRIVATE_KEY_BASE64, "base64").toString("utf-8")
  : process.env.WAFFO_PRIVATE_KEY;
const storeId = process.env.WAFFO_STORE_ID;
const environment = process.env.WAFFO_ENVIRONMENT === "prod" ? "prod" : "test";

if (!merchantId || !privateKey || !storeId) {
  console.error("缺少 WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY / WAFFO_STORE_ID");
  process.exit(1);
}

const client = new WaffoPancake({ merchantId, privateKey, environment });

const packsRaw = process.env.BILLING_PACKS || "10:9.9,50:39.9,100:69.9";
const packs = packsRaw.split(",").map((part) => {
  const [credits, price] = part.split(":");
  return { credits, price };
});

const currency = process.env.BILLING_CURRENCY || "USD";
const created = [];

for (const pack of packs) {
  const name = `${pack.credits} 次点数包（AI 求职助手）`;
  try {
    const { product } = await client.onetimeProducts.create({
      storeId,
      name,
      description: `AI 求职助手点数包：${pack.credits} 次完整流程`,
      prices: { [currency]: { amount: pack.price, taxCategory: "digital_goods" } },
      metadata: { packId: pack.credits, credits: pack.credits },
      successUrl: `${process.env.WAFFO_WEBHOOK_URL || "https://tianzhaoqun.top"}/credits?status=success`,
    });
    created.push({ credits: pack.credits, price: pack.price, productId: product.id });
  } catch (error) {
    console.error(`创建商品失败（${name}）`, error?.errors?.[0]?.message || error.message);
  }
}

console.log("PRODUCTS:");
created.forEach((p) => console.log(`${p.credits}:${p.price}:${p.productId}`));

const webhookUrl = process.env.WAFFO_WEBHOOK_URL;
if (webhookUrl) {
  try {
    const { webhook } = await client.webhooks.add({
      storeId,
      channel: "http",
      url: webhookUrl,
      events: ["order.completed", "refund.succeeded"],
      testMode: environment === "test",
    });
    console.log("WEBHOOK:", webhook.url, webhook.testMode ? "(test)" : "(prod)");
  } catch (error) {
    console.error("配置 Webhook 失败", error?.errors?.[0]?.message || error.message);
  }
}
