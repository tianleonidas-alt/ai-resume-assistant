import { NextResponse } from "next/server";
import { normalizeAnalysisResult, type AnalysisResult } from "@/lib/analysis";
import { getLlmProvider, isLlmProvider, type LlmProvider } from "@/lib/llm";
import { runChatCompletion } from "@/lib/llm-server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

const systemPrompt = `你是一位资深中文职业顾问。根据用户简历文本和目标岗位描述，提供具体、诚实、可执行的求职材料优化建议。只输出 JSON，不要 Markdown。JSON 必须符合以下结构：
{
  "score": 0-100 的整数,
  "summary": "一句匹配度结论",
  "insightTitle": "一句核心洞察",
  "insight": "80-150 字的匹配分析",
  "strengths": ["最多 5 个优势关键词"],
  "gaps": ["最多 4 个待补足关键词"],
  "suggestions": [{"priority":"高|中|低","title":"建议标题","original":"简历中可替换的原表述或概括","suggested":"可直接参考的改写"}],
  "coverLetter": "完整中文求职信正文，含称呼与署名、不得含任何日期，约 300-500 字",
  "interviewQuestions": [{"question":"问题","answer":"回答要点正文，不得包含‘参考’、‘参考回答’等前缀"}]
}
suggestions 输出 3 条；interviewQuestions 严格输出 10 条。求职信的日期由系统统一添加，绝不能输出年份、月日或“日期”字段。不要编造简历中没有的事实或数字；若信息不足，请在建议中明确标记待补充。`;

function readJson(content: string): AnalysisResult {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) throw new Error("Model response did not contain a JSON object");
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as AnalysisResult;
}

function titleFromJobDescription(jobDescription: string) {
  const firstLine = jobDescription.split("\n").map((line) => line.trim()).find(Boolean) || "目标岗位";
  return firstLine.split(/[｜|—–-]/)[0].trim().slice(0, 120) || "目标岗位";
}

function publicError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let runId: string | null = null;
  let admin: ReturnType<typeof createAdminSupabaseClient> | null = null;

  try {
    const user = await getAuthenticatedRequestUser(request);
    if (!user) return publicError("请先登录后再开始分析。", 401);

    const { resumeId, jobDescription, provider: providerInput } = await request.json() as {
      resumeId?: string;
      jobDescription?: string;
      provider?: string;
    };
    const cleanJobDescription = jobDescription?.trim() || "";
    if (!resumeId || cleanJobDescription.length < 20 || cleanJobDescription.length > 20000) {
      return publicError("请上传简历并填写 20–20,000 字的完整岗位描述。", 400);
    }
    const providerRaw = typeof providerInput === "string" ? providerInput : "";
    const provider: LlmProvider = isLlmProvider(providerRaw) ? providerRaw : "deepseek";
    const providerConfig = getLlmProvider(provider);
    if (!providerConfig) return publicError("不支持的模型提供方。", 400);
    const model = process.env[providerConfig.modelEnv] || providerConfig.defaultModel;
    const modelKey = `${provider}:${model}`;

    admin = createAdminSupabaseClient();
    const { data: resume, error: resumeError } = await admin
      .from("resumes")
      .select("id, parsed_text")
      .eq("id", resumeId)
      .eq("user_id", user.id)
      .single();
    if (resumeError || !resume?.parsed_text) return publicError("未找到可用的简历文本，请重新上传。", 404);

    const jobDescriptionId = crypto.randomUUID();
    const { error: jobError } = await admin.from("job_descriptions").insert({
      id: jobDescriptionId,
      user_id: user.id,
      job_title: titleFromJobDescription(cleanJobDescription),
      source_text: cleanJobDescription,
    });
    if (jobError) throw jobError;

    runId = crypto.randomUUID();
    const { error: runError } = await admin.from("analysis_runs").insert({
      id: runId,
      user_id: user.id,
      resume_id: resume.id,
      job_description_id: jobDescriptionId,
      status: "processing",
      model: modelKey,
      input_snapshot: { resume_text: resume.parsed_text, job_description: cleanJobDescription },
      started_at: new Date().toISOString(),
    });
    if (runError) throw runError;

    await admin.from("usage_events").insert({
      user_id: user.id,
      analysis_run_id: runId,
      event_type: "analysis_requested",
    });

    const { content } = await runChatCompletion({
      provider,
      model,
      temperature: 0.45,
      json: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `【简历文本】\n${resume.parsed_text.slice(0, 18000)}\n\n【目标岗位描述】\n${cleanJobDescription.slice(0, 12000)}` },
      ],
    });
    const result = normalizeAnalysisResult(readJson(content));

    const { error: resultError } = await admin.from("analysis_results").insert({
      analysis_run_id: runId,
      score: result.score,
      result_json: result,
      prompt_version: "resume-analysis-v1",
    });
    if (resultError) throw resultError;

    const completedAt = new Date().toISOString();
    const { error: completeError } = await admin
      .from("analysis_runs")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", runId)
      .eq("user_id", user.id);
    if (completeError) throw completeError;

    await admin.from("usage_events").insert({
      user_id: user.id,
      analysis_run_id: runId,
      event_type: "analysis_completed",
    });

    return NextResponse.json({ result, runId, completedAt });
  } catch (error) {
    console.error("Analysis failed", error);
    if (runId && admin) {
      const completedAt = new Date().toISOString();
      await admin.from("analysis_runs").update({
        status: "failed",
        completed_at: completedAt,
        error_message: "分析未完成，请稍后重试。",
      }).eq("id", runId);
      const { data: run } = await admin.from("analysis_runs").select("user_id").eq("id", runId).maybeSingle();
      if (run?.user_id) {
        await admin.from("usage_events").insert({ user_id: run.user_id, analysis_run_id: runId, event_type: "analysis_failed" });
      }
    }
    const message = error instanceof Error ? error.message : "分析失败，请稍后重试。";
    return publicError(message, 502);
  }
}
