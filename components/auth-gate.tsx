"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type AuthUser = { id: string; email: string | null };

function authErrorMessage(detail: string, fallback: string) {
  const text = detail.toLowerCase();
  if (text.includes("rate limit") || text.includes("over_email_send_rate_limit")) {
    return "发送过于频繁，请等待 1 小时后再试。";
  }
  if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
    return "该邮箱已有账户，请切换到“登录”。";
  }
  return fallback;
}

/**
 * Renders an inline login/signup panel for protected pages. After a successful
 * sign-in the page is refreshed in place, so the user never gets bounced to the
 * home page. Only render this on the unauthenticated branch of a server page.
 */
export function AuthGate({ message }: { message?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "guest" | "authed">("checking");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() : null))
      .then((payload: { user?: AuthUser } | null) => {
        if (active) setState(payload?.user ? "authed" : "guest");
      })
      .catch(() => { if (active) setState("guest"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (state !== "authed") return;
    const timer = window.setTimeout(() => router.refresh(), 300);
    return () => window.clearTimeout(timer);
  }, [state, router]);

  if (state === "checking") {
    return <main className="auth-inline-shell"><p className="auth-inline-checking">正在确认登录状态…</p></main>;
  }
  if (state === "authed") {
    return <main className="auth-inline-shell"><p className="auth-inline-checking">登录成功，正在载入…</p></main>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    if (mode === "signUp") {
      if (password.length < 8) { setAuthError("密码至少需要 8 位。"); return; }
      if (password !== confirmPassword) { setAuthError("两次输入的密码不一致。"); return; }
    }
    if (!email || !password) { setAuthError("请输入邮箱和密码。"); return; }

    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode === "signIn" ? "login" : "signup"}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json() as { user?: AuthUser; error?: string };
      if (!response.ok || !payload.user) {
        setAuthError(payload?.error ? authErrorMessage(payload.error, payload.error) : "登录失败，请稍后重试。");
        setLoading(false);
        return;
      }
      setState("authed");
    } catch {
      setAuthError("网络异常，请稍后重试。");
      setLoading(false);
    }
  }

  return (
    <section className="auth-inline-card" role="dialog" aria-modal="false" aria-labelledby="auth-gate-title">
      <div className="section-no">ACCOUNT ACCESS</div>
      <h2 id="auth-gate-title">登录后继续</h2>
      {message && <p className="auth-inline-message">{message}</p>}
      <div className="auth-tabs" role="tablist" aria-label="账户操作">
        <button type="button" role="tab" aria-selected={mode === "signIn"} className={mode === "signIn" ? "active" : ""} onClick={() => setMode("signIn")}>登录</button>
        <button type="button" role="tab" aria-selected={mode === "signUp"} className={mode === "signUp" ? "active" : ""} onClick={() => setMode("signUp")}>注册</button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="auth-gate-email">邮箱地址</label>
        <input id="auth-gate-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <label htmlFor="auth-gate-password">密码</label>
        <input id="auth-gate-password" type="password" autoComplete={mode === "signUp" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" />
        {mode === "signUp" && <>
          <label htmlFor="auth-gate-confirm">确认密码</label>
          <input id="auth-gate-confirm" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" />
        </>}
        <button className="auth-submit" type="submit" disabled={loading}>{loading ? "正在处理…" : mode === "signIn" ? "登录并继续 →" : "创建账户并继续 →"}</button>
      </form>
      {authError && <p className="auth-message error" role="status">{authError}</p>}
      <small>{mode === "signUp" ? "无需邮箱确认，注册后可直接登录。" : "还没有账户？请选择“注册”创建一个。"}</small>
    </section>
  );
}
