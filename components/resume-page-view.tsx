import {
  initialsForName,
  normalizeResumePageContent,
  safeExternalUrl,
  type ResumePageContent,
  type ResumePageThemeId,
} from "@/lib/resume-page";

type ResumePageViewProps = {
  content: ResumePageContent;
  themeId: ResumePageThemeId;
  downloadUrl?: string | null;
  isPreview?: boolean;
};

export function ResumePageView({ content: rawContent, themeId, downloadUrl, isPreview = false }: ResumePageViewProps) {
  const content = normalizeResumePageContent(rawContent);
  const ctaHref = safeExternalUrl(content.cta.href);
  const ctaLabel = content.cta.label || "联系我";
  const contactItems = [
    content.contact.email ? { key: "email", label: "邮箱", value: content.contact.email, href: `mailto:${content.contact.email}` } : null,
    content.contact.phone ? { key: "phone", label: "电话", value: content.contact.phone, href: `tel:${content.contact.phone.replace(/[^\d+]/g, "")}` } : null,
    content.contact.location ? { key: "location", label: "所在地", value: content.contact.location, href: null } : null,
    content.contact.website ? { key: "website", label: "网站", value: content.contact.website, href: safeExternalUrl(content.contact.website) } : null,
  ].filter((item): item is { key: string; label: string; value: string; href: string | null } => Boolean(item));

  return (
    <main className={`resume-page theme-${themeId}`}>
      <header className="rp-hero">
        <div className="rp-monogram" aria-hidden="true">{initialsForName(content.name)}</div>
        {content.positioning && <p className="rp-eyebrow">{content.positioning}</p>}
        <h1>{content.name || "未命名"}</h1>
        {content.headline && <p className="rp-headline">{content.headline}</p>}
        {content.bio && <p className="rp-bio">{content.bio}</p>}
        <div className="rp-actions">
          <a className="rp-cta" href={ctaHref}>{ctaLabel}</a>
          {downloadUrl && <a className="rp-ghost" href={downloadUrl} target="_blank" rel="noreferrer">下载 PDF 简历</a>}
        </div>
      </header>

      {content.highlights.length > 0 && (
        <section className="rp-section rp-highlights">
          <h2 className="rp-section-title">核心优势</h2>
          <div className="rp-grid rp-highlights-grid">
            {content.highlights.map((item, index) => (
              <article className="rp-highlight-card" key={`${item.title}-${index}`}>
                <span className="rp-card-index">{String(index + 1).padStart(2, "0")}</span>
                {item.title && <h3>{item.title}</h3>}
                {item.description && <p>{item.description}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {content.projects.length > 0 && (
        <section className="rp-section rp-projects">
          <h2 className="rp-section-title">项目经历</h2>
          <div className="rp-projects-list">
            {content.projects.map((project, index) => (
              <article className="rp-project-card" key={`${project.name}-${index}`}>
                <div className="rp-project-head">
                  <div>
                    <h3>{project.name || "未命名项目"}</h3>
                    {project.role && <span className="rp-project-role">{project.role}</span>}
                  </div>
                  {project.link && <a className="rp-project-link" href={safeExternalUrl(project.link)} target="_blank" rel="noreferrer">查看链接 ↗</a>}
                </div>
                {project.summary && <p>{project.summary}</p>}
                {project.tech.length > 0 && <div className="rp-chips">{project.tech.map((item) => <span className="rp-chip" key={item}>{item}</span>)}</div>}
              </article>
            ))}
          </div>
        </section>
      )}

      {content.skills.length > 0 && (
        <section className="rp-section rp-skills">
          <h2 className="rp-section-title">技能</h2>
          <div className="rp-skills-grid">
            {content.skills.map((group, index) => (
              <article className="rp-skill-group" key={`${group.category}-${index}`}>
                <h3>{group.category}</h3>
                <div className="rp-chips">{group.items.map((item) => <span className="rp-chip" key={item}>{item}</span>)}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rp-section rp-contact" id="contact">
        <h2 className="rp-section-title">联系方式</h2>
        <div className="rp-contact-grid">
          {contactItems.map((item) => (
            item.href
              ? <a className="rp-contact-item" href={item.href} key={item.key}>{item.label}<b>{item.value}</b></a>
              : <span className="rp-contact-item" key={item.key}>{item.label}<b>{item.value}</b></span>
          ))}
          {content.contact.socials.map((social, index) => (
            <a className="rp-contact-item" href={safeExternalUrl(social.url)} target="_blank" rel="noreferrer" key={`${social.label}-${index}`}>{social.label}<b>查看资料 ↗</b></a>
          ))}
        </div>
        <div className="rp-actions rp-contact-actions">
          <a className="rp-cta" href={ctaHref}>{ctaLabel}</a>
          {downloadUrl && <a className="rp-ghost" href={downloadUrl} target="_blank" rel="noreferrer">下载 PDF 简历</a>}
        </div>
      </section>

      <footer className="rp-footer">由履历 · Career Intelligence 生成{isPreview ? " · 实时预览" : ""}</footer>
    </main>
  );
}
