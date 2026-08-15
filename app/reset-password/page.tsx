"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const minimumPasswordLength = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => {
        setReady(response.ok);
        if (!response.ok) {
          setIsError(true);
          setMessage("重设链接已失效，或尚未完成安全验证。请重新申请重设密码。 ");
        }
      })
      .catch(() => {
        setReady(false);
        setIsError(true);
        setMessage("重设链接已失效，或尚未完成安全验证。请重新申请重设密码。 ");
      });
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < minimumPasswordLength) {
      setIsError(true); setMessage("密码至少需要 8 位。 "); return;
    }
    if (password !== confirmPassword) {
      setIsError(true); setMessage("两次输入的密码不一致。 "); return;
    }

    setLoading(true); setMessage("");
    const response = await fetch("/api/auth/password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setIsError(true); setMessage(payload.error || "更新密码失败，请重新申请重设链接。 "); return;
    }
    router.replace("/?auth=password-updated");
    router.refresh();
  }

  return <main className="reset-shell"><nav className="reset-nav"><Link href="/" className="back-link">← 返回履历</Link><span>ACCOUNT RECOVERY</span></nav><section className="reset-card"><div className="section-no">RESET PASSWORD</div><h1>给账户，<br />一个新的入口。</h1><p>设置至少 8 位的新密码。更新完成后，你可以立即回到这里继续准备下一次投递。</p>{ready && <form onSubmit={(event) => void updatePassword(event)}><label htmlFor="new-password">新密码</label><input id="new-password" type="password" autoComplete="new-password" required minLength={minimumPasswordLength} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" /><label htmlFor="new-password-confirm">确认新密码</label><input id="new-password-confirm" type="password" autoComplete="new-password" required minLength={minimumPasswordLength} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" /><button className="auth-submit" type="submit" disabled={loading}>{loading ? "正在更新…" : "保存新密码 →"}</button></form>}{message && <p className={`auth-message ${isError ? "error" : ""}`} role="status">{message}</p>}{!ready && <Link href="/" className="reset-return">回到首页</Link>}</section></main>;
}
