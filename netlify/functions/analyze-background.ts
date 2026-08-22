import { createClient } from "@supabase/supabase-js";
import { isLlmProvider, readJsonObject, runChatCompletion } from "../../lib/llm-core";
import { ANALYSIS_SYSTEM_PROMPT } from "../../lib/analysis-core";
import { normalizeAnalysisResult, type AnalysisResult } from "../../lib/analysis";

export const config = { background: true };

const promptVersion = "resume-analysis-v1";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase 服务端配置缺失。");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function providerFromModelKey(modelKey: string) {
  const [providerPart, ...rest] = modelKey.split(":");
  const provider = isLlmProvider(providerPart) ? providerPart : "deepseek";
  const model = rest.join(":");
  return { provider, model: model || undefined };
}

export default async function analyzeBackground(request: Request) {
  const admin = adminClient();
  let runId: string | null = null;

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return new Response(null, { status: 400 });
    }
    runId = typeof body.runId === "string" ? body.runId : null;
    if (!runId) return new Response(null, { status: 400 });

    // Atomically claim the pending run so duplicate/retry invocations are no-ops.
    const { data: run, error: claimError } = await admin
      .from("analysis_runs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("status", "pending")
      .select("id, user_id, model, input_snapshot")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!run) return new Response(null, { status: 202 });

    const snapshot = (run.input_snapshot ?? {}) as {
      resume_text?: unknown;
      job_description?: unknown;
    };
    const resumeText = typeof snapshot.resume_text === "string" ? snapshot.resume_text : "";
    const jobDescription = typeof snapshot.job_description === "string" ? snapshot.job_description : "";
    if (!resumeText || !jobDescription) {
      throw new Error("分析所需材料缺失，请重新提交。");
    }

    const { provider, model } = providerFromModelKey(String(run.model || ""));
    const { content } = await runChatCompletion({
      provider,
      model,
      temperature: 0.45,
      json: true,
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `【简历文本】\n${resumeText.slice(0, 18000)}\n\n【目标岗位描述】\n${jobDescription.slice(0, 12000)}`,
        },
      ],
    });
    const result = normalizeAnalysisResult(readJsonObject(content) as AnalysisResult);

    const { error: resultError } = await admin.from("analysis_results").insert({
      analysis_run_id: runId,
      score: result.score,
      result_json: result,
      prompt_version: promptVersion,
    });
    if (resultError) throw resultError;

    const completedAt = new Date().toISOString();
    const { error: completeError } = await admin
      .from("analysis_runs")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", runId)
      .eq("user_id", run.user_id);
    if (completeError) throw completeError;

    await admin.from("usage_events").insert({
      user_id: run.user_id,
      analysis_run_id: runId,
      event_type: "analysis_completed",
    });
  } catch (error) {
    console.error("Analysis background failed", error);
    const message = error instanceof Error ? error.message : "分析未完成，请稍后重试。";
    if (runId) {
      const completedAt = new Date().toISOString();
      await admin
        .from("analysis_runs")
        .update({ status: "failed", completed_at: completedAt, error_message: message.slice(0, 500) })
        .eq("id", runId);
      const { data: run } = await admin
        .from("analysis_runs")
        .select("user_id")
        .eq("id", runId)
        .maybeSingle();
      if (run?.user_id) {
        await admin.from("usage_events").insert({
          user_id: run.user_id,
          analysis_run_id: runId,
          event_type: "analysis_failed",
        });
      }
    }
  }

  return new Response(null, { status: 202 });
}
