import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import { SiteNav } from "@/components/site-nav";
import { RESUME_PAGE_THEMES, mapResumePageRow, publicResumePageUrl, type ResumePageDTO } from "@/lib/resume-page";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function themeName(themeId: string) {
  return RESUME_PAGE_THEMES.find((theme) => theme.id === themeId)?.name || "主题";
}

export default async function ResumePagesPage() {
  if (!hasPublicSupabaseConfig()) {
    return <main className="pages-shell"><Link href="/" className="back-link">← 返回分析页</Link><p className="history-empty">尚未配置 Supabase，无法读取在线简历页。</p></main>;
  }

  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !userId) {
    return <main className="pages-shell"><SiteNav /><AuthGate message="登录后即可创建、管理你的在线简历页。" /></main>;
  }

  const { data, error } = await supabase
    .from("resume_pages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const pages = (data || []).map((row) => mapResumePageRow(row as Record<string, unknown>));

  return <main className="pages-shell">
    <SiteNav />
    <header className="pages-header">
      <div className="section-no">YOUR PUBLIC PAGES</div>
      <h1>把经历，变成<br />可分享的<em>主页。</em></h1>
      <p>从 PDF 简历或历史分析出发，生成、编辑并发布你的个人求职主页。公开页无需登录即可访问。</p>
      <Link className="pages-create" href="/resume-pages/new">创建在线简历页 →</Link>
    </header>
    {error ? <p className="history-error">在线简历页暂时无法读取，请稍后重试。</p>
      : pages.length ? <section className="pages-list">{pages.map((page: ResumePageDTO) => (
          <article className="pages-card" key={page.id}>
            <div className="pages-card-main">
              <div className="section-no">{page.status === "published" ? "PUBLISHED" : "DRAFT"}</div>
              <h2>{page.title}</h2>
              <p>{themeName(page.themeId)} · {page.status === "published" ? `发布于 ${formatDate(page.publishedAt || page.updatedAt)}` : `更新于 ${formatDate(page.updatedAt)}`}</p>
              {page.status === "published" && page.slug && <a className="pages-link" href={publicResumePageUrl(page.slug)} target="_blank" rel="noreferrer">/p/{page.slug} ↗</a>}
            </div>
            <Link className="pages-edit" href={`/resume-pages/${page.id}`}>{page.status === "published" ? "编辑页面 →" : "继续编辑 →"}</Link>
          </article>
        ))}</section>
      : <section className="history-empty"><div className="section-no">FIRST PAGE</div><h2>还没有在线简历页。</h2><p>从你的 PDF 简历或历史分析生成第一个求职主页。</p><Link href="/resume-pages/new" className="history-cta">去创建 →</Link></section>}
  </main>;
}
