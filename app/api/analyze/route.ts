import { NextResponse } from "next/server";
import { normalizeAnalysisResult, type AnalysisResult } from "@/lib/analysis";
import { getLlmProvider, isLlmProvider, type LlmProvider } from "@/lib/llm";
import { readJsonObject } from "@/lib/llm-core";
import { ANALYSIS_SYSTEM_PROMPT } from "@/lib/analysis-core";
import { runChatCompletion } from "@/lib/llm-server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";
import { reserveCredit, releaseCredit, recordLlmUsage } from "@/lib/billing";

export const runtime = "nodejs";

function titleFromJobDescription(jobDescription: string) {
  const firstLine = jobDescription.split("\n").map((line) => line.trim()).find(Boolean) || "目标岗位";
  return firstLine.split(/[｜|—–-]/)[0].trim().slice(0, 120) || "目标岗位";
}

function publicError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let runId: string | null = null;
  let userId: string | null = null;
  let admin: ReturnType<typeof createAdminSupabaseClient> | null = null;

  try {
    const user = await getAuthenticatedRequestUser(request);
    if (!user) return publicError("请先登录后再开始分析。", 401);
    userId = user.id;

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

    // 原子预扣 1 点：成功则保留（即本次消耗），失败/异常由 catch 释放。
    runId = crypto.randomUUID();
    const reserved = await reserveCredit(user.id, runId, "简历分析 · 完整流程");
    if (!reserved) return publicError("可用次数不足，请先充值后继续。", 402);

    const jobDescriptionId = crypto.randomUUID();
    const { error: jobError } = await admin.from("job_descriptions").insert({
      id: jobDescriptionId,
      user_id: user.id,
      job_title: titleFromJobDescription(cleanJobDescription),
      source_text: cleanJobDescription,
    });
    if (jobError) throw jobError;

    const { error: runError } = await admin.from("analysis_runs").insert({
      id: runId,
      user_id: user.id,
      resume_id: resume.id,
      job_description_id: jobDescriptionId,
      status: "pending",
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

    // Netlify 仅在构建期注入 NETLIFY，运行时只有 URL 可靠；两者都判断，确保线上走后台函数分支。
    const isNetlifyRuntime = process.env.NETLIFY === "true" || Boolean(process.env.URL);
    if (isNetlifyRuntime) {
      // The browser fires the background function directly (same-origin) and
      // then polls /api/analyze/status. Netlify blocks same-site self-calls
      // from within the server handler, so we never trigger it server-side.
      return NextResponse.json({ runId, status: "processing" }, { status: 202 });
    }

    const { content, model: usedModel, usage } = await runChatCompletion({
      provider,
      model,
      temperature: 0.45,
      json: true,
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: `【简历文本】\n${resume.parsed_text.slice(0, 18000)}\n\n【目标岗位描述】\n${cleanJobDescription.slice(0, 12000)}` },
      ],
    });
    const result = normalizeAnalysisResult(readJsonObject(content) as AnalysisResult);

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

    try {
      await recordLlmUsage({
        userId: user.id,
        provider,
        model: usedModel,
        purpose: "analysis",
        eventRef: runId,
        usage,
      });
    } catch (billingError) {
      console.error("Usage record failed", billingError);
    }

    return NextResponse.json({ result, runId, completedAt });
  } catch (error) {
    console.error("Analysis failed", error);
    if (runId && userId) {
      await releaseCredit(userId, runId);
    }
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
