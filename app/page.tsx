"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { demoResult, titleFromJobDescription, type AnalysisResult } from "@/lib/analysis";
import { deleteAnalysisDraft, readAnalysisDraft, writeAnalysisDraft } from "@/lib/analysis-draft";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AnalysisReport } from "@/components/analysis-report";

type AuthenticatedUser = Pick<User, "id" | "email">;

const sampleJob = `高级产品经理｜杭州

我们期待你主导核心增长产品，围绕用户洞察、商业目标与跨团队协作，持续推进产品从 0 到 1 及规模化迭代。

你需要：3 年以上互联网产品经验；具备数据分析能力和增长思维；能独立完成需求洞察、方案设计及项目落地；优秀的沟通协作能力。`;

const supabaseEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

function formatAuthEmailError(error: { message?: string; code?: string } | null) {
  const detail = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  if (detail.includes("rate limit") || detail.includes("over_email_send_rate_limit")) {
    return "验证邮件发送过于频繁，Supabase 已暂时限流。请等待至少 1 小时后仅重试一次；持续使用前请配置自定义 SMTP。";
  }
  return "暂时无法发送邮件，请稍后再试。";
}

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [savedResumeId, setSavedResumeId] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState(sampleJob);
  const [status, setStatus] = useState<"idle" | "reading" | "ready" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult>(demoResult);
  const [isDemo, setIsDemo] = useState(true);
  const [reportJobTitle, setReportJobTitle] = useState("高级产品经理");
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(!supabaseEnabled);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp" | "forgot">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authMessageKind, setAuthMessageKind] = useState<"success" | "error">("success");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) return;
    void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { user: AuthenticatedUser } : { user: null })
      .then((payload) => setUser(payload.user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoaded(true));
    const authState = new URLSearchParams(window.location.search).get("auth");
    if (authState === "error") {
      setLoginOpen(true);
      setAuthMessageKind("error");
      setAuthMessage("验证链接已失效或无法完成验证，请重试。 ");
    }
    if (authState === "confirmed") {
      setAuthMessageKind("success");
      setAuthMessage("邮箱已确认，欢迎回来。 ");
    }
    if (authState === "password-updated") {
      setAuthMessageKind("success");
      setAuthMessage("密码已更新，请使用新密码登录。 ");
    }
  }, []);

  const draftKey = user ? `user:${user.id}` : "guest";

  useEffect(() => {
    if (!authLoaded) return;
    let active = true;
    setDraftLoaded(false);
    setLoadedDraftKey(null);
    void readAnalysisDraft(draftKey)
      .then((draft) => {
        if (!active || !draft) return;
        setFile(draft.file);
        setResumeText(draft.resumeText);
        setSavedResumeId(draft.savedResumeId);
        setJobDescription(draft.jobDescription);
        setStatus(draft.file && draft.resumeText ? "ready" : "idle");
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) { setLoadedDraftKey(draftKey); setDraftLoaded(true); }
      });
    return () => { active = false; };
  }, [authLoaded, draftKey]);

  useEffect(() => {
    if (!draftLoaded || loadedDraftKey !== draftKey) return;
    const hasDraft = Boolean(file || resumeText || savedResumeId || jobDescription !== sampleJob);
    const action = hasDraft
      ? writeAnalysisDraft(draftKey, { file, resumeText, savedResumeId, jobDescription })
      : deleteAnalysisDraft(draftKey);
    void action.catch(() => undefined);
  }, [draftLoaded, loadedDraftKey, draftKey, file, resumeText, savedResumeId, jobDescription]);

  async function extractPdf(selected: File) {
    if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) {
      setStatus("error"); setError("请上传 PDF 格式的简历。"); return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setStatus("error"); setError("简历文件不能超过 20 MB。"); return;
    }
    setStatus("reading"); setError("");
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const document = await pdfjs.getDocument({ data: await selected.arrayBuffer() }).promise;
      const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
        const page = await document.getPage(index + 1);
        const content = await page.getTextContent();
        return content.items.map((item) => "str" in item ? item.str : "").join(" ");
      }));
      const text = pages.join("\n").replace(/\s{2,}/g, " ").trim();
      if (text.length < 30) throw new Error("empty PDF");
      setFile(selected); setResumeText(text); setSavedResumeId(null); setStatus("ready");
    } catch {
      setFile(null); setResumeText(""); setSavedResumeId(null); setStatus("error");
      setError("这份 PDF 未能提取到文字。请使用可选中文本版简历后重试。");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) void extractPdf(selected);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const selected = event.dataTransfer.files?.[0];
    if (selected) void extractPdf(selected);
  }

  async function saveResume() {
    if (!file) throw new Error("请先上传 PDF 简历。");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("parsedText", resumeText);
    const response = await fetch("/api/resumes", { method: "POST", credentials: "same-origin", body: formData });
    const payload = await response.json() as { resume?: { id: string }; error?: string };
    if (!response.ok || !payload.resume?.id) throw new Error(payload.error || "简历保存失败。");
    setSavedResumeId(payload.resume.id);
    return payload.resume.id;
  }

  async function analyze() {
    if (!resumeText || !jobDescription.trim()) return;
    if (!supabaseEnabled) {
      setStatus("error"); setError("尚未配置 Supabase。请先填写 .env.local 并执行数据库迁移。"); return;
    }
    if (!user) {
      setLoginOpen(true); setAuthMessage("登录后即可安全保存简历与分析历史。 "); return;
    }

    setStatus("loading"); setError("");
    try {
      const resumeId = savedResumeId || await saveResume();
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ resumeId, jobDescription }),
      });
      const payload = await response.json() as { result?: AnalysisResult; completedAt?: string; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "分析失败");
      setResult(payload.result); setReportJobTitle(titleFromJobDescription(jobDescription)); setGeneratedAt(payload.completedAt || new Date().toISOString()); setIsDemo(false);
      document.querySelector("#report")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setStatus("ready");
    } catch (caught) {
      setStatus("error"); setError(caught instanceof Error ? caught.message : "分析失败，请稍后重试。");
    }
  }

  function openAuth(mode: "signIn" | "signUp" | "forgot") {
    setAuthMode(mode);
    setAuthMessage("");
    setAuthMessageKind("success");
    setPassword("");
    setConfirmPassword("");
    setLoginOpen(true);
  }

  function setAuthError(message: string) {
    setAuthMessageKind("error");
    setAuthMessage(message);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseEnabled) {
      setAuthError("请先填写 Supabase 项目环境变量。 "); return;
    }
    setAuthLoading(true); setAuthMessage("");
    const supabase = createBrowserSupabaseClient();

    if (authMode === "signUp") {
      if (password.length < 8) {
        setAuthLoading(false); setAuthError("密码至少需要 8 位。 "); return;
      }
      if (password !== confirmPassword) {
        setAuthLoading(false); setAuthError("两次输入的密码不一致。 "); return;
      }
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json() as { user?: AuthenticatedUser; error?: string };
      setAuthLoading(false);
      if (!response.ok || !payload.user) {
        setAuthError(payload.error || "暂时无法创建账户，请稍后再试。");
        return;
      }
      setUser(payload.user);
      void deleteAnalysisDraft("guest").catch(() => undefined);
      setPassword(""); setConfirmPassword("");
      setLoginOpen(false);
      router.refresh();
      return;
    }

    if (authMode === "forgot") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setAuthLoading(false);
      if (resetError) {
        setAuthError(formatAuthEmailError(resetError));
        return;
      }
      setAuthMessageKind("success");
      setAuthMessage("如该邮箱已注册，重设密码链接已发送，请前往邮箱查收。 ");
      return;
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json() as { user?: AuthenticatedUser; error?: string; code?: string };
    setAuthLoading(false);
    if (!response.ok || !payload.user) {
      setAuthError(payload.error || "邮箱或密码不正确，请重试。 ");
      return;
    }
    setUser(payload.user);
    void deleteAnalysisDraft("guest").catch(() => undefined);
    setPassword("");
    setLoginOpen(false);
    router.refresh();
  }

  async function signOut() {
    if (!supabaseEnabled) return;
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setUser(null); setFile(null); setResumeText(""); setSavedResumeId(null); setJobDescription(sampleJob); setStatus("idle");
    router.refresh();
  }

  const ready = Boolean(resumeText && jobDescription.trim());
  const accountLabel = user?.email?.split("@")[0] || "我的账户";

  return <div className="shell">
    <nav className="nav"><div className="brand"><span className="mark">履</span><b>履历</b><small>CAREER INTELLIGENCE</small></div><div className="nav-actions">{user ? <><Link className="history-link" href="/history">我的分析</Link><button className="account-button" type="button" onClick={() => void signOut()} title="退出登录">{accountLabel}<span>退出</span></button></> : <button className="login-button" type="button" onClick={() => openAuth("signIn")}>登录并保存</button>}<div className="nav-note"><i>●</i> 让每一次投递，更接近理想工作</div></div></nav>
    <header className="hero"><div><div className="eyebrow">THE CAREER EDITOR / 01</div><h1>把经验，写成值得被看见的<em>机会。</em></h1></div><div className="hero-details"><p>上传你的履历，告诉我们你向往的岗位。我们将用一份清晰、诚实而有说服力的职业叙事，帮你走近下一次面试。</p><aside><b>从简历到回音</b><p>定位匹配 · 打磨表达 ·<br />为下一场对话做好准备</p></aside></div></header>
    <main>
      <section className="workspace" aria-label="求职材料输入区"><div className="workspace-head"><h2>给我两份材料</h2><span className="step">STEP 01 — 02</span></div><div className="input-grid">
        <article className="input-card"><div className="input-label"><span>你的简历</span><span>PDF</span></div><button className="upload" type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><div><div className="pdf">PDF</div><div className="file">{status === "reading" ? "正在提取简历文字…" : file?.name || "拖拽或点击上传简历"}</div><div className="meta">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · 已解析文字` : "支持可选中文本的 PDF · 最大 20 MB"}</div>{status === "ready" && <div className="ready"><i>✓</i>{savedResumeId ? "已安全保存" : "已准备好分析"}</div>}</div></button><input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={onFileChange} hidden /></article>
        <article className="input-card"><div className="input-label"><span>目标岗位描述{jobDescription === sampleJob && <em className="input-example">举例</em>}</span><span>{jobDescription.length.toLocaleString()} / 3,000</span></div><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} maxLength={3000} aria-label="岗位描述" /><div className="hint">{jobDescription === sampleJob ? "当前为示例内容，可直接覆盖" : "粘贴完整 JD，分析会更贴近真实招聘要求"}</div></article>
      </div><div className="action-row"><span className="privacy">{user ? "你的材料仅用于本次分析与个人历史保存" : "登录后可安全保存材料与分析历史"}</span><button className="analyze" type="button" disabled={!ready || status === "loading"} onClick={() => void analyze()}>{status === "loading" ? "正在深度分析…" : user ? "开始深度分析" : "登录后分析"}<span>→</span></button></div>{error && <p className="error-message" role="alert">{error}</p>}</section>

      <AnalysisReport result={result} jobTitle={reportJobTitle} generatedAt={generatedAt} isDemo={isDemo} />
    </main><footer><span>履历 · CAREER INTELLIGENCE</span><span>{user ? "分析结果已安全保存至你的账户" : "登录后保存你的材料与分析历史"}</span></footer>

    {loginOpen && <div className="auth-backdrop" role="presentation" onMouseDown={() => setLoginOpen(false)}><section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}><button className="dialog-close" type="button" onClick={() => setLoginOpen(false)} aria-label="关闭">×</button><div className="section-no">ACCOUNT ACCESS</div><h2 id="auth-title">{authMode === "signUp" ? <>为下一次机会，<br />建立你的档案。</> : authMode === "forgot" ? <>重新设置，<br />继续向前。</> : <>把每一份努力，<br />妥善保存。</>}</h2><p>{authMode === "signUp" ? "创建账户后即可开始分析。你的求职材料与分析结果将只保存在个人账户中。" : authMode === "forgot" ? "输入你的注册邮箱。若账户存在，我们会发送安全的密码重设链接。" : "登录后，简历、岗位材料与分析结果只会保存在你的个人账户中。"}</p><div className="auth-tabs" role="tablist" aria-label="账户操作"><button type="button" role="tab" aria-selected={authMode === "signIn"} className={authMode === "signIn" ? "active" : ""} onClick={() => openAuth("signIn")}>登录</button><button type="button" role="tab" aria-selected={authMode === "signUp"} className={authMode === "signUp" ? "active" : ""} onClick={() => openAuth("signUp")}>注册</button></div><form onSubmit={(event) => void handleAuthSubmit(event)}><label htmlFor="email">邮箱地址</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />{authMode !== "forgot" && <><label htmlFor="password">密码</label><input id="password" type="password" autoComplete={authMode === "signUp" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" />{authMode === "signUp" && <><label htmlFor="confirm-password">确认密码</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" /></>}</>}<button className="auth-submit" type="submit" disabled={authLoading}>{authLoading ? "正在处理…" : authMode === "signUp" ? "创建账户并继续 →" : authMode === "forgot" ? "发送重设链接 →" : "登录并继续 →"}</button></form>{authMode === "signIn" && <button className="auth-inline-action" type="button" onClick={() => openAuth("forgot")}>忘记密码？</button>}{authMode === "forgot" && <button className="auth-inline-action" type="button" onClick={() => openAuth("signIn")}>返回登录</button>}{authMessage && <p className={`auth-message ${authMessageKind === "error" ? "error" : ""}`} role="status">{authMessage}</p>}<small>{authMode === "signUp" ? "无需邮箱确认，注册后可直接使用邮箱和密码登录。" : authMode === "forgot" ? "重设链接将发送至你的注册邮箱。" : "还没有账户？请选择“注册”创建一个。"}</small></section></div>}
  </div>;
}
