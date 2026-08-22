"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  RESUME_PAGE_THEMES,
  normalizeResumePageContent,
  type ResumePageContent,
  type ResumePageDTO,
  type ResumePageHighlight,
  type ResumePageProject,
  type ResumePageSkillGroup,
  type ResumePageSocial,
  type ResumePageThemeId,
} from "@/lib/resume-page";
import { ResumePageView } from "@/components/resume-page-view";

type SaveState = "idle" | "saving" | "saved" | "error";

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function splitList(value: string): string[] {
  return value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
}

function EditorCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="editor-card"><h3>{title}</h3>{children}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="editor-field"><span>{label}</span>{children}</label>;
}

type ItemToolbarProps = { index: number; total: number; onMove: (direction: -1 | 1) => void; onRemove: () => void };

function ItemToolbar({ index, total, onMove, onRemove }: ItemToolbarProps) {
  return <div className="editor-item-tools">
    <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label="上移">↑</button>
    <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="下移">↓</button>
    <button type="button" className="danger" onClick={onRemove} aria-label="删除">×</button>
  </div>;
}

export function ResumePageEditor({ page: initial }: { page: ResumePageDTO }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [themeId, setThemeId] = useState<ResumePageThemeId>(initial.themeId);
  const [content, setContent] = useState<ResumePageContent>(() => normalizeResumePageContent(initial.content));
  const [pdfDownloadEnabled, setPdfDownloadEnabled] = useState(initial.pdfDownloadEnabled);
  const [status, setStatus] = useState(initial.status);
  const [slug, setSlug] = useState(initial.slug);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function persist() {
    try {
      const response = await fetch(`/api/resume-pages/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, themeId, content, pdfDownloadEnabled }),
      });
      if (!response.ok) throw new Error("save failed");
      dirtyRef.current = false;
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setError("自动保存失败，请检查网络后重试。");
    }
  }

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    dirtyRef.current = true;
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void persist(); }, 800);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [title, themeId, content, pdfDownloadEnabled]);

  async function regenerate() {
    if (dirtyRef.current && !window.confirm("重新生成会覆盖当前内容（主题与标题保留），确定继续吗？")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/resume-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: initial.sourceResumeId,
          analysisRunId: initial.sourceAnalysisRunId,
        }),
      });
      const payload = await response.json() as { page?: ResumePageDTO; error?: string };
      if (!response.ok || !payload.page) throw new Error(payload.error || "重新生成失败，请稍后重试。");
      setContent(normalizeResumePageContent(payload.page.content));
      setTitle(payload.page.title);
      setSaveState("saved");
      dirtyRef.current = false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "重新生成失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/resume-pages/${initial.id}/publish`, { method: "POST" });
      const payload = await response.json() as { page?: ResumePageDTO; error?: string };
      if (!response.ok || !payload.page) throw new Error(payload.error || "发布失败，请稍后重试。");
      setStatus("published");
      setSlug(payload.page.slug);
      setSaveState("saved");
      dirtyRef.current = false;
      setShareOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发布失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!window.confirm("取消发布后，现有公开链接将立即失效。确定取消发布吗？")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/resume-pages/${initial.id}/unpublish`, { method: "POST" });
      const payload = await response.json() as { page?: ResumePageDTO; error?: string };
      if (!response.ok || !payload.page) throw new Error(payload.error || "取消发布失败。");
      setStatus("draft");
      setSlug(null);
      setShareOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "取消发布失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function removePage() {
    if (!window.confirm("删除后无法恢复，确定删除这个在线简历页吗？")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/resume-pages/${initial.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) throw new Error("删除失败，请稍后重试。");
      router.push("/resume-pages");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败，请稍后重试。");
      setBusy(false);
    }
  }

  function updateHighlight(index: number, patch: Partial<ResumePageHighlight>) {
    setContent((prev) => normalizeResumePageContent({
      ...prev,
      highlights: prev.highlights.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function updateProject(index: number, patch: Partial<ResumePageProject>) {
    setContent((prev) => normalizeResumePageContent({
      ...prev,
      projects: prev.projects.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function updateSkillGroup(index: number, patch: Partial<ResumePageSkillGroup>) {
    setContent((prev) => normalizeResumePageContent({
      ...prev,
      skills: prev.skills.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function updateSocial(index: number, patch: Partial<ResumePageSocial>) {
    setContent((prev) => normalizeResumePageContent({
      ...prev,
      contact: { ...prev.contact, socials: prev.contact.socials.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) },
    }));
  }

  const shareUrl = slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${slug}` : "";
  const saveLabel = saveState === "saving" ? "保存中…" : saveState === "saved" ? "已保存" : saveState === "error" ? "保存失败" : "";

  return (
    <div className="editor-shell">
      <nav className="editor-nav">
        <Link className="back-link" href="/resume-pages">← 我的在线页</Link>
        <span className="editor-save-state">{saveLabel}</span>
        <div className="editor-nav-actions">
          <button type="button" disabled={busy} onClick={() => void regenerate()}>重新生成</button>
          {status === "published"
            ? <button type="button" className="editor-unpublish" disabled={busy} onClick={() => void unpublish()}>取消发布</button>
            : <button type="button" className="editor-publish" disabled={busy} onClick={() => void publish()}>发布并分享</button>}
          <button type="button" className="editor-delete" disabled={busy} onClick={() => void removePage()}>删除</button>
        </div>
      </nav>
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="editor-layout">
        <aside className="editor-form">
          <EditorCard title="页面信息">
            <Field label="页面标题"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></Field>
            <label className="editor-toggle">
              <input type="checkbox" checked={pdfDownloadEnabled} onChange={(event) => setPdfDownloadEnabled(event.target.checked)} />
              <span>公开页提供“下载 PDF 简历”按钮</span>
            </label>
          </EditorCard>

          <EditorCard title="主题">
            <div className="theme-picker">
              {RESUME_PAGE_THEMES.map((theme) => (
                <button type="button" className={`theme-picker-card theme-${theme.id} ${themeId === theme.id ? "active" : ""}`} key={theme.id} onClick={() => setThemeId(theme.id)}>
                  <b>{theme.name}</b><span>{theme.description}</span>
                </button>
              ))}
            </div>
          </EditorCard>

          <EditorCard title="基本信息">
            <Field label="姓名"><input value={content.name} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, name: event.target.value }))} maxLength={60} /></Field>
            <Field label="职位定位"><input value={content.headline} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, headline: event.target.value }))} maxLength={80} placeholder="如：高级产品经理｜增长方向" /></Field>
            <Field label="一句话定位"><input value={content.positioning} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, positioning: event.target.value }))} maxLength={120} /></Field>
            <Field label="个人介绍"><textarea rows={4} value={content.bio} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, bio: event.target.value }))} maxLength={1000} /></Field>
          </EditorCard>

          <EditorCard title="核心优势">
            {content.highlights.map((item, index) => (
              <div className="editor-item-card" key={index}>
                <ItemToolbar index={index} total={content.highlights.length}
                  onMove={(direction) => setContent((prev) => normalizeResumePageContent({ ...prev, highlights: moveItem(prev.highlights, index, direction) }))}
                  onRemove={() => setContent((prev) => normalizeResumePageContent({ ...prev, highlights: prev.highlights.filter((_, i) => i !== index) }))} />
                <Field label="标题"><input value={item.title} onChange={(event) => updateHighlight(index, { title: event.target.value })} maxLength={40} /></Field>
                <Field label="说明"><textarea rows={2} value={item.description} onChange={(event) => updateHighlight(index, { description: event.target.value })} maxLength={200} /></Field>
              </div>
            ))}
            <button type="button" className="editor-add" onClick={() => setContent((prev) => normalizeResumePageContent({ ...prev, highlights: [...prev.highlights, { title: "", description: "" }] }))}>+ 添加优势</button>
          </EditorCard>

          <EditorCard title="项目经历">
            {content.projects.map((item, index) => (
              <div className="editor-item-card" key={index}>
                <ItemToolbar index={index} total={content.projects.length}
                  onMove={(direction) => setContent((prev) => normalizeResumePageContent({ ...prev, projects: moveItem(prev.projects, index, direction) }))}
                  onRemove={() => setContent((prev) => normalizeResumePageContent({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }))} />
                <Field label="项目名称"><input value={item.name} onChange={(event) => updateProject(index, { name: event.target.value })} maxLength={80} /></Field>
                <Field label="担任角色"><input value={item.role} onChange={(event) => updateProject(index, { role: event.target.value })} maxLength={40} /></Field>
                <Field label="成果描述"><textarea rows={3} value={item.summary} onChange={(event) => updateProject(index, { summary: event.target.value })} maxLength={500} /></Field>
                <Field label="技术/关键词（、分隔）"><input value={item.tech.join("、")} onChange={(event) => updateProject(index, { tech: splitList(event.target.value) })} /></Field>
                <Field label="链接（可选）"><input value={item.link} onChange={(event) => updateProject(index, { link: event.target.value })} maxLength={300} placeholder="https://…" /></Field>
              </div>
            ))}
            <button type="button" className="editor-add" onClick={() => setContent((prev) => normalizeResumePageContent({ ...prev, projects: [...prev.projects, { name: "", role: "", summary: "", tech: [], link: "" }] }))}>+ 添加项目</button>
          </EditorCard>

          <EditorCard title="技能">
            {content.skills.map((group, index) => (
              <div className="editor-item-card" key={index}>
                <ItemToolbar index={index} total={content.skills.length}
                  onMove={(direction) => setContent((prev) => normalizeResumePageContent({ ...prev, skills: moveItem(prev.skills, index, direction) }))}
                  onRemove={() => setContent((prev) => normalizeResumePageContent({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }))} />
                <Field label="分类"><input value={group.category} onChange={(event) => updateSkillGroup(index, { category: event.target.value })} maxLength={40} /></Field>
                <Field label="技能（、分隔）"><input value={group.items.join("、")} onChange={(event) => updateSkillGroup(index, { items: splitList(event.target.value) })} /></Field>
              </div>
            ))}
            <button type="button" className="editor-add" onClick={() => setContent((prev) => normalizeResumePageContent({ ...prev, skills: [...prev.skills, { category: "", items: [] }] }))}>+ 添加技能组</button>
          </EditorCard>

          <EditorCard title="联系方式">
            <Field label="邮箱"><input type="email" value={content.contact.email} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, contact: { ...prev.contact, email: event.target.value } }))} maxLength={120} /></Field>
            <Field label="电话"><input value={content.contact.phone} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, contact: { ...prev.contact, phone: event.target.value } }))} maxLength={40} /></Field>
            <Field label="所在地"><input value={content.contact.location} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, contact: { ...prev.contact, location: event.target.value } }))} maxLength={80} /></Field>
            <Field label="个人网站"><input value={content.contact.website} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, contact: { ...prev.contact, website: event.target.value } }))} maxLength={300} placeholder="https://…" /></Field>
            {content.contact.socials.map((social, index) => (
              <div className="editor-item-card" key={index}>
                <ItemToolbar index={index} total={content.contact.socials.length}
                  onMove={(direction) => setContent((prev) => normalizeResumePageContent({ ...prev, contact: { ...prev.contact, socials: moveItem(prev.contact.socials, index, direction) } }))}
                  onRemove={() => setContent((prev) => normalizeResumePageContent({ ...prev, contact: { ...prev.contact, socials: prev.contact.socials.filter((_, i) => i !== index) } }))} />
                <Field label="平台"><input value={social.label} onChange={(event) => updateSocial(index, { label: event.target.value })} maxLength={40} /></Field>
                <Field label="链接"><input value={social.url} onChange={(event) => updateSocial(index, { url: event.target.value })} maxLength={300} placeholder="https://…" /></Field>
              </div>
            ))}
            <button type="button" className="editor-add" onClick={() => setContent((prev) => normalizeResumePageContent({ ...prev, contact: { ...prev.contact, socials: [...prev.contact.socials, { label: "", url: "" }] } }))}>+ 添加社交链接</button>
          </EditorCard>

          <EditorCard title="行动按钮">
            <Field label="按钮文案"><input value={content.cta.label} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, cta: { ...prev.cta, label: event.target.value } }))} maxLength={20} /></Field>
            <Field label="按钮链接"><input value={content.cta.href} onChange={(event) => setContent((prev) => normalizeResumePageContent({ ...prev, cta: { ...prev.cta, href: event.target.value } }))} maxLength={300} placeholder="mailto:you@example.com" /></Field>
          </EditorCard>
        </aside>

        <div className="editor-preview">
          <ResumePageView content={content} themeId={themeId} isPreview />
        </div>
      </div>

      {shareOpen && slug && (
        <div className="share-backdrop" role="presentation" onMouseDown={() => setShareOpen(false)}>
          <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" onClick={() => setShareOpen(false)} aria-label="关闭">×</button>
            <div className="section-no">PAGE PUBLISHED</div>
            <h2 id="share-title">你的在线简历页已发布</h2>
            <p>公开链接无需登录即可访问；此后编辑会即时生效，取消发布后链接立即失效。</p>
            <div className="share-link-row">
              <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" onClick={() => void navigator.clipboard.writeText(shareUrl).catch(() => undefined)}>复制链接</button>
            </div>
            <a className="share-open" href={shareUrl} target="_blank" rel="noreferrer">在新窗口打开 ↗</a>
          </section>
        </div>
      )}
    </div>
  );
}
