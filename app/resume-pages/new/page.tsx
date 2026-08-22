import { AuthGate } from "@/components/auth-gate";
import { NewResumePageWizard, type WizardHistoryRun } from "@/components/new-resume-page-wizard";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HistoryRun = {
  id: string;
  created_at: string;
  status: string;
  resumes: { name: string } | null;
  job_descriptions: { job_title: string } | null;
  analysis_results: { score: number } | null;
};

export default async function NewResumePage() {
  if (!hasPublicSupabaseConfig()) {
    return <main className="wizard-shell"><p className="history-empty">尚未配置 Supabase，无法创建在线简历页。</p></main>;
  }

  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !userId) {
    return <main className="wizard-shell"><AuthGate message="登录后即可创建在线简历页。" /></main>;
  }

  const { data } = await supabase
    .from("analysis_runs")
    .select("id, created_at, status, resumes(name), job_descriptions(job_title), analysis_results(score)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const history: WizardHistoryRun[] = ((data || []) as unknown as HistoryRun[]).map((run) => ({
    id: run.id,
    jobTitle: run.job_descriptions?.job_title || "目标岗位",
    resumeName: run.resumes?.name || null,
    score: typeof run.analysis_results?.score === "number" ? run.analysis_results.score : null,
    createdAt: run.created_at,
    status: run.status,
  }));

  return <NewResumePageWizard history={history} />;
}
