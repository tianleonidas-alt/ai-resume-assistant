"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { SiteNav } from "@/components/site-nav";

type Pack = { id: string; credits: number; price: string; productId: string };
type BalancePayload = {
  billingEnabled: boolean;
  balance: number;
  freeTotal: number;
  freeUsed: number;
  freeRemaining: number;
  paidCredits: number;
  ledger: Array<{
    id: string;
    event_type: string;
    amount: number;
    note: string | null;
    created_at: string;
  }>;
};
type PacksPayload = { enabled: boolean; currency: string; packs: Pack[] };

function currencySymbol(code?: string): string {
  if (code === "CNY") return "¥";
  if (code === "USD") return "$";
  return code || "";
}

function CreditsContent() {
  const [balance, setBalance] = useState<BalancePayload | null>(null);
  const [packs, setPacks] = useState<PacksPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    let active = true;
    async function refreshBalance() {
      try {
        const response = await fetch("/api/billing/balance", { credentials: "same-origin", cache: "no-store" });
        const payload = response.ok ? await response.json() : null;
        if (active) setBalance(payload || null);
      } catch {
        if (active) setBalance(null);
      }
    }
    void fetch("/api/billing/packs", { cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() : null))
      .then((payload) => { if (active) setPacks(payload || null); })
      .catch(() => undefined);
    void refreshBalance();

    const onFocus = () => { if (document.visibilityState !== "hidden") void refreshBalance(); };
    const onCreditsRefresh = () => void refreshBalance();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("credits:refresh", onCreditsRefresh);

    // 支付跳回后 Webhook 可能滞后数秒，主动重试几次刷新余额。
    const timers = new URLSearchParams(window.location.search).get("status") === "success"
      ? [2000, 6000, 12000].map((ms) => window.setTimeout(() => void refreshBalance(), ms))
      : [];

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("credits:refresh", onCreditsRefresh);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const successStatus = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("status");

  async function startCheckout() {
    if (!selectedPack || !agreed) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: selectedPack.id }),
      });
      const payload = await response.json().catch(() => null) as { checkoutUrl?: string; error?: string } | null;
      if (!response.ok || !payload?.checkoutUrl) {
        throw new Error(payload?.error || "创建支付会话失败，请稍后重试。");
      }
      window.location.href = payload.checkoutUrl;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建支付会话失败，请稍后重试。");
      setBusy(false);
    }
  }

  const canPay = Boolean(packs?.enabled);
  const eventLabels: Record<string, string> = {
    signup_bonus: "注册赠送",
    purchase: "充值",
    consume: "消耗",
    admin_grant: "运营加点",
  };

  return (
    <>
      <SiteNav />
      <main className="credits-shell">
        <header className="credits-head">
          <div className="section-no">ACCOUNT / CREDITS</div>
          <h1>我的点数</h1>
          <p>每次“简历分析 + 生成在线简历页”的完整流程消耗 1 点；失败不扣费，可重试。新账号赠送 {balance?.freeTotal ?? 2} 次免费额度。</p>
        </header>

        {successStatus === "success" && <div className="credits-success" role="status">支付成功，点数已到账。如有延迟请刷新页面查看。</div>}
        {error && <p className="error-message" role="alert">{error}</p>}

        <section className="credits-balance">
          <div className="credits-balance-card">
            <span className="credits-balance-label">可用点数</span>
            <div className="credits-balance-num"><b>{balance?.balance ?? "–"}</b><small>次完整流程</small></div>
            <p className="credits-free">免费额度 {balance?.freeUsed ?? 0} / {balance?.freeTotal ?? 2} · 付费点数 {Math.max(0, balance?.paidCredits ?? 0)}</p>
            <p className="credits-sub">免费额度优先扣除；用完后将从充值点数中扣除。</p>
          </div>
        </section>

        <div className="credits-packs-title">
          <h2>选择点数包</h2>
          <span>{currencySymbol(packs?.currency) || "USD"} · {packs?.enabled ? "支付已开放" : "支付功能配置中，暂不可购买"}</span>
        </div>
        <section className="credits-packs">
          {(packs?.packs || []).map((pack, index) => (
            <article className={`credits-pack ${index === 1 ? "recommend" : ""}`} key={pack.id}>
              {index === 1 && <span className="credits-pack-flag">推荐</span>}
              <h3>{pack.credits} 次点数包</h3>
              <div className="credits-pack-price"><b>{currencySymbol(packs?.currency)}{pack.price}</b></div>
              <button type="button" disabled={!packs?.enabled || !pack.productId} onClick={() => { setSelectedPack(pack); setAgreed(false); setError(""); }}>
                {packs?.enabled && pack.productId ? "立即充值" : "暂不可购买"}
              </button>
            </article>
          ))}
        </section>

        <section className="credits-ledger">
          <h2>点数明细</h2>
          {!balance?.ledger?.length ? (
            <p className="credits-empty">暂无明细记录。</p>
          ) : (
            <table>
              <thead><tr><th>时间</th><th>类型</th><th style={{ textAlign: "right" }}>点数</th><th>说明</th></tr></thead>
              <tbody>
                {balance.ledger.map((row) => (
                  <tr key={row.id}>
                    <td className="credits-note">{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}</td>
                    <td>{eventLabels[row.event_type] || row.event_type}</td>
                    <td className={`credits-amt ${row.amount > 0 ? "pos" : "neg"}`}>{row.amount > 0 ? `+${row.amount}` : row.amount}</td>
                    <td className="credits-note">{row.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
      {selectedPack && (
        <div className="auth-backdrop" role="presentation" onMouseDown={() => setSelectedPack(null)}>
          <section className="auth-dialog credits-checkout" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => setSelectedPack(null)} aria-label="关闭">×</button>
            <div className="section-no">WAFFO CHECKOUT</div>
            <h2 id="checkout-title">确认充值 · {selectedPack.credits} 次点数包</h2>
            <p>将通过 Waffo 托管收银台完成支付（{currencySymbol(packs?.currency)}{selectedPack.price}），支付成功后点数自动到账。</p>
            <label className="credits-agree">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
              <span>我已阅读并同意 <Link href="/terms" target="_blank">《服务条款》</Link> 与 <Link href="/privacy" target="_blank">《隐私政策》</Link></span>
            </label>
            <div className="credit-confirm-actions">
              <button className="credit-confirm-cancel" type="button" onClick={() => setSelectedPack(null)}>取消</button>
              <button className="credit-confirm-ok" type="button" disabled={!agreed || busy} onClick={() => void startCheckout()}>
                {busy ? "正在跳转…" : "跳转 Waffo 收银台 →"}
              </button>
            </div>
            <p className="credits-help">支付问题请联系 Waffo 客服邮箱：merchant.support@waffo.com</p>
          </section>
        </div>
      )}
    </>
  );
}

export default function CreditsPage() {
  return (
    <Suspense fallback={<div className="credits-shell"><SiteNav /></div>}>
      <CreditsContent />
    </Suspense>
  );
}
