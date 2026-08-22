"use client";

import { useRouter } from "next/navigation";
import { DragEvent, ChangeEvent, useEffect, useRef, useState } from "react";
import { LlmSelector, readLlmProvider, writeLlmProvider } from "@/components/llm-selector";
import type { LlmProvider } from "@/lib/llm";
import { extractPdfText } from "@/lib/pdf";

export type WizardHistoryRun = {
  id: string;
  jobTitle: string;
  resumeName: string | null;
  score: number | null;
  createdAt: string;
  status: string;
};

type WizardProps = { history: WizardHistoryRun[] };

export function NewResumePageWizard({ history }: WizardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"pdf" | "history">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [pdfStatus, setPdfStatus] = useState<"idle" | "reading" | "ready" | "error">("idle");
  const [jobContext, setJobContext] = useState("");
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [provider, setProvider] = useState<LlmProvider>("deepseek");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setProvider(readLlmProvider());
  }, []);

  function handleProviderChange(value: LlmProvider) {
    setProvider(value);
    writeLlmProvider(value);
  }

  async function handleFile(selected: File) {
    if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) {
      setPdfStatus("error"); setError("请上传 PDF 格式的简历。"); return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setPdfStatus("error"); setError("简历文件不能超过 20 MB。"); return;
    }
    setPdfStatus("reading"); setError("");
    try {
      const text = await extractPdfText(selected);
      setFile(selected); setPdfText(text); setPdfStatus("ready");
    } catch (caught) {
      setFile(null); setPdfText(""); setPdfStatus("error");
      setError(caught instanceof Error ? caught.message : "这份 PDF 未能提取到文字，请更换文件。");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) void handleFile(selected);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const selected = event.dataTransfer.files?.[0];
    if (selected) void handleFile(selected);
  }

  async function generate() {
    setBusy(true); setError("");
    try {
      let resumeId: string | null = null;
      let analysisRunId: string | null = null;

      if (mode === "pdf") {
        if (!file || !pdfText) throw new Error("请先上传并解析 PDF 简历。");
        const formData = new FormData();
        formData.append("file", file);
        formData.append("parsedText", pdfText);
        const saveResponse = await fetch("/api/resumes", { method: "POST", credentials: "same-origin", body: formData });
        const saved = await saveResponse.json().catch(() => null) as { resume?: { id: string }; error?: string } | null;
        if (!saveResponse.ok || !saved?.resume?.id) throw new Error(saved?.error || "简历保存失败，请稍后重试。");
        resumeId = saved.resume.id;
      } else {
        if (!selectedRun) throw new Error("请先选择一个历史分析作为来源。");
        analysisRunId = selectedRun;
      }

      const response = await fetch("/api/resume-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, analysisRunId, jobContext: jobContext.trim() || undefined, provider }),
      });
      const payload = await response.json().catch(() => null) as { page?: { id: string }; error?: string } | null;
      if (!response.ok || !payload?.page?.id) throw new Error(payload?.error || "生成失败，请稍后重试。");
      router.push(`/resume-pages/${payload.page.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成失败，请稍后重试。");
      setBusy(false);
    }
  }

  const ready = mode === "pdf" ? pdfStatus === "ready" : Boolean(selectedRun);

  return (
    <div className="wizard-shell">
      <nav className="wizard-nav"><span>履历 · NEW RESUME PAGE</span></nav>
      <header className="wizard-header">
        <div className="section-no">CREATE YOUR PAGE</div>
        <h1>从一份简历，<br />长出一个<em>主页。</em></h1>
        <p>选择材料来源，AI 会先帮你把内容组织成适合公开展示的个人主页结构，之后你可以自由编辑与换主题。</p>
      </header>

      <section className="wizard-source">
        <div className="wizard-source-tabs">
          <button type="button" className={mode === "pdf" ? "active" : ""} onClick={() => { setMode("pdf"); setError(""); }}>上传 PDF 简历</button>
          <button type="button" className={mode === "history" ? "active" : ""} onClick={() => { setMode("history"); setError(""); }}>从历史分析选择</button>
        </div>

        {mode === "pdf" ? (
          <div className="wizard-pdf">
            <button className="wizard-upload" type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
              <div className="pdf">PDF</div>
              <div className="file">{pdfStatus === "reading" ? "正在提取简历文字…" : file?.name || "拖拽或点击上传简历"}</div>
              <div className="meta">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · 已解析` : "支持可选中文本的 PDF · 最大 20 MB"}</div>
              {pdfStatus === "ready" && <div className="ready"><i>✓</i> 已准备好生成</div>}
            </button>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={onFileChange} hidden />
            <label className="wizard-context">
              <span>目标岗位 / JD（可选，让生成更定向）</span>
              <textarea rows={4} maxLength={3000} value={jobContext} onChange={(event) => setJobContext(event.target.value)} placeholder="粘贴目标岗位描述，AI 会按岗位侧重组织内容。" />
            </label>
          </div>
        ) : (
          <div className="wizard-history">
            {history.length === 0
              ? <p className="history-empty">还没有历史分析记录。先完成一次岗位分析，再回来生成在线简历页。</p>
              : <div className="wizard-history-list">{history.map((run) => (
                  <button type="button" className={`wizard-history-item ${selectedRun === run.id ? "active" : ""}`} key={run.id} onClick={() => setSelectedRun(run.id)}>
                    <b>{run.jobTitle}</b>
                    <span>{run.resumeName || "简历"} · {run.score !== null ? `${run.score} 分` : run.status === "failed" ? "未完成" : "处理中"} · {new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.createdAt))}</span>
                  </button>
                ))}</div>}
          </div>
        )}
      </section>

      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="wizard-action">
        <span className="privacy">生成结果默认保存为草稿，仅你可见；发布后才生成公开链接。</span>
        <LlmSelector value={provider} onChange={handleProviderChange} />
        <button className="analyze" type="button" disabled={!ready || busy} onClick={() => void generate()}>
          {busy ? "AI 正在组织内容…" : "AI 生成在线简历页"}<span>→</span>
        </button>
      </div>
    </div>
  );
}
