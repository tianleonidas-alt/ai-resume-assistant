"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

type BalancePayload = {
  billingEnabled: boolean;
  balance: number;
  freeRemaining: number;
};

export function SiteNav({
  authSlot,
  onSignOut,
}: {
  authSlot?: ReactNode;
  onSignOut?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [balance, setBalance] = useState<BalancePayload | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() : { user: null }))
      .then((payload) => { if (active) setUser(payload.user || null); })
      .catch(() => { if (active) setUser(null); });

    async function loadBalance() {
      try {
        const response = await fetch("/api/billing/balance", { credentials: "same-origin", cache: "no-store" });
        const payload = response.ok ? await response.json() : null;
        if (active) setBalance(payload || null);
      } catch {
        if (active) setBalance(null);
      }
    }
    const onRefresh = () => void loadBalance();
    const onFocus = () => { if (document.visibilityState !== "hidden") void loadBalance(); };
    void loadBalance();
    window.addEventListener("credits:refresh", onRefresh);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      window.removeEventListener("credits:refresh", onRefresh);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [pathname]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    if (onSignOut) await onSignOut();
    setUser(null);
    setBalance(null);
    router.refresh();
  }

  return (
    <nav className="nav site-nav">
      <Link className="brand" href="/" aria-label="返回分析页">
        <span className="mark">履</span><b>履历</b><small>CAREER INTELLIGENCE</small>
      </Link>
      <div className="nav-actions">
        {user ? (
          <>
            <Link className="history-link" href="/">首页</Link>
            <Link className="history-link" href="/resume-pages">我的在线简历</Link>
            <Link className="history-link" href="/history">历史分析结果</Link>
            {balance?.billingEnabled ? (
              <Link className="credits-chip" href="/credits" title="我的点数">
                <span>我的点数</span><b>{balance.balance}</b><em>充值</em>
              </Link>
            ) : (
              <Link className="history-link" href="/credits">我的点数</Link>
            )}
            <button className="account-button" type="button" onClick={() => void handleSignOut()} title="退出登录">
              {user.email?.split("@")[0] || "我的账户"}<span>退出</span>
            </button>
          </>
        ) : (
          <>
            <Link className="history-link" href="/pricing">定价</Link>
            {authSlot || null}
          </>
        )}
      </div>
    </nav>
  );
}
