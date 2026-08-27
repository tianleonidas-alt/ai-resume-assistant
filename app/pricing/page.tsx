"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/site-nav";

type Pack = { id: string; credits: number; price: string; productId: string };
type PacksPayload = { enabled: boolean; currency: string; packs: Pack[] };

function currencySymbol(code?: string): string {
  if (code === "CNY") return "¥";
  if (code === "USD") return "$";
  return code || "";
}

export default function PricingPage() {
  const [packs, setPacks] = useState<PacksPayload | null>(null);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    void fetch("/api/billing/packs", { cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() : null))
      .then((payload) => setPacks(payload || null))
      .catch(() => undefined);
    void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() : { user: null }))
      .then((payload) => setUser(payload.user || null))
      .catch(() => setUser(null));
  }, []);

  return (
    <div className="pricing-page">
      <SiteNav />
      <main className="pricing-shell">
        <header className="pricing-head">
          <div className="section-no">PRICING</div>
          <h1>点数与价格</h1>
          <p>按实际使用付费：每次“简历分析 + 生成在线简历页”的完整流程消耗 1 点，失败不扣费、可重试。</p>
        </header>

        <section className="pricing-rules">
          <h2>计费说明</h2>
          <ul>
            <li>新账号注册后赠送 2 次免费额度，免费额度优先扣除。</li>
            <li>每次“简历分析 + 生成在线简历页”完整流程消耗 1 点；分析失败不扣费，可重试。</li>
            <li>从历史分析生成/重新生成在线简历页不额外扣费；直接上传 PDF 生成/重新生成在线简历页消耗 1 点。</li>
            <li>点数仅限本人账号使用，不可转让或兑换现金。充值订单问题请联系 Waffo 客服，其他问题请联系站点客服（页脚邮箱）。</li>
          </ul>
        </section>

        <div className="credits-packs-title">
          <h2>选择点数包</h2>
          <span>{currencySymbol(packs?.currency)} · {packs?.enabled ? "支付已开放" : "支付功能配置中"}</span>
        </div>
        <section className="credits-packs">
          {(packs?.packs || []).map((pack, index) => (
            <article className={`credits-pack ${index === 1 ? "recommend" : ""}`} key={pack.id}>
              {index === 1 && <span className="credits-pack-flag">推荐</span>}
              <h3>{pack.credits} 次点数包</h3>
              <div className="credits-pack-price"><b>{currencySymbol(packs?.currency)}{pack.price}</b></div>
              <Link href={user ? "/credits" : "/"}>{user ? "去充值 →" : "登录后充值 →"}</Link>
            </article>
          ))}
        </section>
        <p className="pricing-note">充值在“我的点数”页面完成；支付由 Waffo 提供安全收银台。</p>
      </main>
    </div>
  );
}
