import { NextResponse } from "next/server";
import { getLlmProvider, isLlmProvider, type LlmProvider } from "@/lib/llm";
import { runChatCompletion } from "@/lib/llm-server";
import { DEFAULT_RESUME_PAGE_THEME, mapResumePageRow, normalizeResumePageContent, type ResumePageContent } from "@/lib/resume-page";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

const systemPrompt = `你是一位资深职业顾问与个人品牌文案专家。根据用户简历文本（以及可选的目标岗位描述），为求职者生成一个可发布的个人求职主页内容。主页应像个人主页 / Portfolio，而不是复刻 PDF 简历：突出个人定位、核心优势、项目经历、技能、联系方式和行动按钮。
只输出 JSON，不要 Markdown，不要代码块。JSON 必须符合以下结构：
{
  "name": "姓名",
  "headline": "一句话职位定位，如「高级产品经理｜增长方向」",
  "positioning": "一句话个人定位（写给招聘方）",
  "bio": "80-160 字个人介绍，突出职业身份、核心价值与优势",
  "highlights": [{"title":"优势标题","description":"一句具体说明"}],
  "projects": [{"name":"项目/经历名称","role":"担任角色","summary":"80-160 字成果描述","tech":["技术或工具关键词"],"metrics":["2-4 个量化成果短语，如 转化率 +18%，信息不足可留空数组"],"link":"可空字符串"}],
  "skills": [{"category":"技能分类","items":["关键词"]}],
  "contact": {"email":"仅从简历提取的邮箱或空字符串","phone":"仅从简历提取的电话或空字符串","location":"城市/地区或空字符串","website":"个人网站或空字符串","socials":[{"label":"平台名","url":"链接"}]},
  "cta": {"label":"行动按钮文案","href":"链接（有邮箱则 mailto:邮箱，否则 #contact）"}
}
规则：highlights 输出 3-5 条；projects 输出 2-4 条；skills 输出 2-5 组；socials 最多 4 个；不得编造简历中不存在的事实、数字、职位或联系方式；信息不足时留空字符串，需要用户补充的内容在字段中写「待补充」；只保留与求职展示相关的经历；全部使用中文输出。`;

function readJsonObject(content: string): ResumePageContent {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) throw new Error("Model response did not contain a JSON object");
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as ResumePageContent;
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
    const model = process.env[providerConfig.modelEnv] || providerConfig.defaultModel;
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

    const { content } = await runChatCompletion({
      provider,
      model,
      temperature: 0.45,
      json: true,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `【简历文本】\n${resumeText.slice(0, 18000)}${jobContext ? `\n\n【目标岗位描述（用于定向）】\n${jobContext.slice(0, 12000)}` : ""}`,
        },
      ],
    });
    const normalized = normalizeResumePageContent(readJsonObject(content));
    const title = normalized.name ? `${normalized.name} · 在线简历` : "未命名在线简历页";

    const { data: page, error: insertError } = await admin
      .from("resume_pages")
      .insert({
        user_id: user.id,
        source_resume_id: sourceResumeId,
        source_analysis_run_id: sourceAnalysisRunId,
        title: title.slice(0, 120),
        theme_id: DEFAULT_RESUME_PAGE_THEME,
        content: normalized,
        pdf_download_enabled: true,
        status: "draft",
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
