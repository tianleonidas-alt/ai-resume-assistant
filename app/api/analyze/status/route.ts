import { NextRequest, NextResponse } from "next/server";
import { normalizeAnalysisResult, type AnalysisResult } from "@/lib/analysis";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

type StatusRow = {
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  analysis_results?:
    | { result_json: unknown; created_at: string }
    | { result_json: unknown; created_at: string }[]
    | null;
};

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "缺少 runId。" }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("analysis_runs")
    .select("status, started_at, completed_at, error_message, analysis_results(result_json, created_at)")
    .eq("id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "未找到该分析记录。" }, { status: 404 });
  }

  const run = data as unknown as StatusRow;
  const resultRow = Array.isArray(run.analysis_results) ? run.analysis_results[0] : run.analysis_results;

  if (run.status === "completed" && resultRow?.result_json) {
    return NextResponse.json({
      status: "completed",
      runId,
      completedAt: run.completed_at || resultRow.created_at,
      result: normalizeAnalysisResult(resultRow.result_json as AnalysisResult),
    });
  }

  if (run.status === "failed") {
    return NextResponse.json({
      status: "failed",
      runId,
      error: run.error_message || "分析未完成，请稍后重试。",
    });
  }

  const stale = run.status === "pending"
    && typeof run.started_at === "string"
    && Date.now() - new Date(run.started_at).getTime() > 90_000;

  return NextResponse.json({ status: run.status, runId, stale });
}
