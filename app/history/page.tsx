import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HistoryItem = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  job_descriptions: { job_title: string; company_name: string | null } | null;
  analysis_results: { score: number } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function HistoryPage() {
  if (!hasPublicSupabaseConfig()) {
    return <main className="history-shell"><Link href="/" className="back-link">← 返回分析页</Link><p className="history-empty">尚未配置 Supabase，无法读取分析历史。</p></main>;
  }

  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !userId) redirect("/?auth=required");

  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, status, created_at, job_descriptions(job_title, company_name), analysis_results(score)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const items = (data || []) as unknown as HistoryItem[];

  return <main className="history-shell">
    <nav className="history-nav"><Link href="/" className="back-link">← 返回分析页</Link><span>履历 · ANALYSIS ARCHIVE</span></nav>
    <header className="history-header"><div className="section-no">YOUR PERSONAL ARCHIVE</div><h1>每一次认真准备，<br />都有迹可循。</h1><p>这里保存你专属的岗位分析记录。简历和结果仅对你的账户可见。</p></header>
    {error ? <p className="history-error">历史记录暂时无法读取，请稍后重试。</p> : items.length ? <section className="history-list">{items.map((item) => {
      const score = item.analysis_results?.score;
      return <article className="history-card" key={item.id}><div><div className="section-no">{item.status === "completed" ? "ANALYSIS COMPLETE" : "ANALYSIS STATUS"}</div><h2>{item.job_descriptions?.job_title || "目标岗位"}</h2><p>{item.job_descriptions?.company_name || "未填写公司"} · {formatDate(item.created_at)}</p></div><div className="history-score">{typeof score === "number" ? <><b>{score}</b><small>/ 100</small></> : <span>{item.status === "failed" ? "未完成" : "处理中"}</span>}</div></article>;
    })}</section> : <section className="history-empty"><div className="section-no">FIRST RECORD</div><h2>你的分析档案，<br />会从第一次投递开始。</h2><p>上传简历并完成一次岗位分析后，记录会出现在这里。</p><Link href="/" className="history-cta">去开始分析 →</Link></section>}
  </main>;
}
