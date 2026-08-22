import { NextResponse } from "next/server";
import { getLlmProvider, isLlmProvider, type LlmProvider } from "@/lib/llm";
import { readJsonObject, runChatCompletion } from "@/lib/llm-core";
import { RESUME_PAGE_SYSTEM_PROMPT } from "@/lib/page-generate-core";
import { DEFAULT_RESUME_PAGE_THEME, mapResumePageRow, normalizeResumePageContent } from "@/lib/resume-page";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

async function generatePageContent(resumeText: string, jobContext: string, provider: LlmProvider) {
  const { content } = await runChatCompletion({
    provider,
    temperature: 0.45,
    json: true,
    messages: [
      { role: "system", content: RESUME_PAGE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `【简历文本】\n${resumeText.slice(0, 18000)}${jobContext ? `\n\n【目标岗位描述（用于定向）】\n${jobContext.slice(0, 12000)}` : ""}`,
      },
    ],
  });
  const normalized = normalizeResumePageContent(readJsonObject(content));
  const title = normalized.name ? `${normalized.name} · 在线简历` : "未命名在线简历页";
  return { normalized, title: title.slice(0, 120) };
}

function publicError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedRequestUser(request);
    if (!user) return publicError("请先登录后再生成在线简历页。", 401);

    let body: Record<string, unknown> = {};
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return publicError("请求格式不正确。", 400);
    }

    const admin = createAdminSupabaseClient();
    const providerInput = typeof body.provider === "string" ? body.provider : "";
    const provider: LlmProvider = isLlmProvider(providerInput) ? providerInput : "deepseek";
    const providerConfig = getLlmProvider(provider);
    if (!providerConfig) return publicError("不支持的模型提供方。", 400);

    const resumeId = typeof body.resumeId === "string" ? body.resumeId : null;
    const analysisRunId = typeof body.analysisRunId === "string" ? body.analysisRunId : null;
    let resumeText = typeof body.resumeText === "string" ? body.resumeText.trim() : "";
    let jobContext = typeof body.jobContext === "string" ? body.jobContext.trim() : "";
    let sourceResumeId: string | null = resumeId;
    let sourceAnalysisRunId: string | null = analysisRunId;

    if (analysisRunId) {
      const { data: run, error: runError } = await admin
        .from("analysis_runs")
        .select("id, resume_id, job_descriptions(job_title, source_text)")
        .eq("id", analysisRunId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (runError || !run) return publicError("未找到可用的历史分析，请重新选择。", 404);
      const runRow = run as unknown as {
        id: string;
        resume_id: string | null;
        job_descriptions?: { job_title?: string; source_text?: string } | { job_title?: string; source_text?: string }[] | null;
      };
      const jobDescription = Array.isArray(runRow.job_descriptions) ? runRow.job_descriptions[0] : runRow.job_descriptions;
      sourceAnalysisRunId = runRow.id;
      if (runRow.resume_id) {
        const { data: resume } = await admin.from("resumes").select("id, parsed_text").eq("id", runRow.resume_id).maybeSingle();
        if (resume?.parsed_text) {
          sourceResumeId = resume.id;
          resumeText = String(resume.parsed_text).trim();
        }
      }
      if (!jobContext && jobDescription?.source_text) {
        jobContext = String(jobDescription.source_text).trim();
      }
    } else if (resumeId) {
      const { data: resume } = await admin
        .from("resumes")
        .select("id, parsed_text")
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!resume?.parsed_text) return publicError("未找到可用的简历文本，请重新上传。", 404);
      resumeText = String(resume.parsed_text).trim();
    }

    if (resumeText.length < 30) {
      return publicError("请上传可选中文本的 PDF 简历，或选择一个历史分析作为来源。", 400);
    }

    // Netlify 仅在构建期注入 NETLIFY，运行时只有 URL 可靠；两者都判断，确保线上走后台函数分支。
    const isNetlify = process.env.NETLIFY === "true" || Boolean(process.env.URL);

    if (isNetlify) {
      const { data: page, error: insertError } = await admin
        .from("resume_pages")
        .insert({
          user_id: user.id,
          source_resume_id: sourceResumeId,
          source_analysis_run_id: sourceAnalysisRunId,
          title: "在线简历页生成中…",
          theme_id: DEFAULT_RESUME_PAGE_THEME,
          content: normalizeResumePageContent({}),
          pdf_download_enabled: true,
          status: "draft",
          generation_status: "pending",
        })
        .select("*")
        .single();
      if (insertError) {
        console.error("Resume page insert failed", insertError);
        throw new Error("保存生成的页面失败，请稍后重试。");
      }

      const pageId = String((page as Record<string, unknown>).id);

      return NextResponse.json(
        {
          page: mapResumePageRow(page as Record<string, unknown>),
          generationStatus: "pending",
          trigger: {
            pageId,
            provider,
            resumeText,
            jobContext,
          },
        },
        { status: 202 },
      );
    }

    const { normalized, title } = await generatePageContent(resumeText, jobContext, provider);
    const { data: page, error: insertError } = await admin
      .from("resume_pages")
      .insert({
        user_id: user.id,
        source_resume_id: sourceResumeId,
        source_analysis_run_id: sourceAnalysisRunId,
        title,
        theme_id: DEFAULT_RESUME_PAGE_THEME,
        content: normalized,
        pdf_download_enabled: true,
        status: "draft",
        generation_status: "idle",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Resume page insert failed", insertError);
      throw new Error("保存生成的页面失败，请稍后重试。");
    }

    return NextResponse.json({ page: mapResumePageRow(page as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    console.error("Resume page generation failed", error);
    const message = error instanceof Error ? error.message : "生成失败，请稍后重试。";
    return publicError(message, 502);
  }
}
