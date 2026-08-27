import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { AnalysisReport } from "@/components/analysis-report";
import { normalizeAnalysisResult, type AnalysisResult } from "@/lib/analysis";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HistoryDetail = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  job_descriptions: { job_title: string } | null;
  analysis_results: { result_json: AnalysisResult; created_at: string } | null;
};

export default async function HistoryDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  if (!hasPublicSupabaseConfig()) redirect("/history");

  const { runId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !userId) {
    return <main className="history-shell"><nav className="history-nav"><Link href="/history" className="back-link">← 返回历史分析结果</Link><span>履历 · ANALYSIS ARCHIVE</span></nav><AuthGate message="登录后查看分析详情。" /></main>;
  }

  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, status, created_at, completed_at, job_descriptions(job_title), analysis_results(result_json, created_at)")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();

  const detail = data as unknown as HistoryDetail | null;
  if (error || !detail || detail.status !== "completed" || !detail.analysis_results) redirect("/history");

  return <main className="history-shell history-detail-shell">
    <nav className="history-nav"><Link href="/history" className="back-link">← 返回历史分析结果</Link><Link href="/" className="history-continue">继续分析 →</Link></nav>
    <AnalysisReport
      result={normalizeAnalysisResult(detail.analysis_results.result_json)}
      jobTitle={detail.job_descriptions?.job_title || "目标岗位"}
      generatedAt={detail.completed_at || detail.analysis_results.created_at || detail.created_at}
    />
  </main>;
}
