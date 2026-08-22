import {
  normalizeResumePageContent,
  safeExternalUrl,
  type ResumePageContent,
  type ResumePageThemeId,
} from "@/lib/resume-page";

const THEME_FONTS: Record<ResumePageThemeId, string[]> = {
  "clean-pro": [
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Noto+Serif+SC:wght@600;700&display=swap",
  ],
  "product-home": [
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Noto+Sans+SC:wght@400;600&display=swap",
  ],
  "creative-portfolio": [
    "https://fonts.googleapis.com/css2?family=LXGW+WenKai:wght@400;700&family=IBM+Plex+Mono:wght@500&family=Noto+Serif+SC:wght@400&display=swap",
  ],
  "enterprise-tech": [
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Noto+Sans+SC:wght@400;600&display=swap",
  ],
};

type ResumePageViewProps = {
  content: ResumePageContent;
  themeId: ResumePageThemeId;
  downloadUrl?: string | null;
  isPreview?: boolean;
};

type ContactItem = { key: string; label: string; value: string; href: string | null };

function buildContactItems(content: ResumePageContent): ContactItem[] {
  const items: ContactItem[] = [];
  if (content.contact.email) items.push({ key: "email", label: "邮箱", value: content.contact.email, href: `mailto:${content.contact.email}` });
  if (content.contact.phone) items.push({ key: "phone", label: "电话", value: content.contact.phone, href: `tel:${content.contact.phone.replace(/[^\d+]/g, "")}` });
  if (content.contact.location) items.push({ key: "location", label: "所在地", value: content.contact.location, href: null });
  if (content.contact.website) items.push({ key: "website", label: "网站", value: content.contact.website, href: safeExternalUrl(content.contact.website) });
  return items;
}

function CtaActions({ content, downloadUrl }: { content: ResumePageContent; downloadUrl?: string | null }) {
  return (
    <div className="rp-actions">
      <a className="rp-cta" href={safeExternalUrl(content.cta.href)}>{content.cta.label || "联系我"}</a>
      {downloadUrl && <a className="rp-ghost" href={downloadUrl} target="_blank" rel="noreferrer">下载 PDF 简历</a>}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return <div className="rp-chips">{items.map((item) => <span className="rp-chip" key={item}>{item}</span>)}</div>;
}

function ContactItems({ content, layout = "grid" }: { content: ResumePageContent; layout?: "grid" | "list" }) {
  const items = buildContactItems(content);
  if (items.length === 0 && content.contact.socials.length === 0) return null;
  return (
    <div className={layout === "grid" ? "rp-contact-grid" : "rp-contact-list"}>
      {items.map((item) => (
        item.href
          ? <a className="rp-contact-item" href={item.href} key={item.key}>{item.label}<b>{item.value}</b></a>
          : <span className="rp-contact-item" key={item.key}>{item.label}<b>{item.value}</b></span>
      ))}
      {content.contact.socials.map((social, index) => (
        <a className="rp-contact-item" href={safeExternalUrl(social.url)} target="_blank" rel="noreferrer" key={`${social.label}-${index}`}>{social.label}<b>查看资料 ↗</b></a>
      ))}
    </div>
  );
}

function Footer({ isPreview }: { isPreview?: boolean }) {
  return <footer className="rp-footer">由履历 · Career Intelligence 生成{isPreview ? " · 实时预览" : ""}</footer>;
}

/* ---------- 1. 清爽专业：双栏简历主页 ---------- */
function CleanProLayout({ content, downloadUrl, isPreview }: ResumePageViewProps) {
  return (
    <main className="resume-page theme-clean-pro" key="clean-pro">
      <header className="rp-hero">
        <p className="rp-eyebrow">{content.positioning}</p>
        <h1>{content.name || "未命名"}</h1>
        {content.headline && <p className="rp-headline">{content.headline}</p>}
        {content.bio && <p className="rp-bio">{content.bio}</p>}
        <CtaActions content={content} downloadUrl={downloadUrl} />
      </header>
      <div className="rp-body">
        <aside className="rp-side">
          {content.skills.length > 0 && (
            <section className="rp-block rp-skills">
              <h2 className="rp-block-title">技能</h2>
              {content.skills.map((group, index) => (
                <div className="rp-skill-group" key={`${group.category}-${index}`}>
                  <h3>{group.category}</h3>
                  <Chips items={group.items} />
                </div>
              ))}
            </section>
          )}
        </aside>
        <div className="rp-main">
          {content.highlights.length > 0 && (
            <section className="rp-block rp-highlights">
              <h2 className="rp-block-title">核心优势</h2>
              <ol className="rp-highlight-list">
                {content.highlights.map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    <span className="rp-hl-index">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      {item.title && <h3>{item.title}</h3>}
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {content.projects.length > 0 && (
            <section className="rp-block rp-projects">
              <h2 className="rp-block-title">项目经历</h2>
              <div className="rp-project-list">
                {content.projects.map((project, index) => (
                  <article className="rp-project" key={`${project.name}-${index}`}>
                    <div className="rp-project-head">
                      <div>
                        <h3>{project.name || "未命名项目"}</h3>
                        {project.role && <span className="rp-project-role">{project.role}</span>}
                      </div>
                      {project.link && <a className="rp-project-link" href={safeExternalUrl(project.link)} target="_blank" rel="noreferrer">查看 ↗</a>}
                    </div>
                    {project.summary && <p className="rp-project-summary">{project.summary}</p>}
                    <Chips items={project.tech} />
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      <section className="rp-side-contact">
        <h2 className="rp-block-title">联系方式</h2>
        <ContactItems content={content} layout="list" />
      </section>
      <Footer isPreview={isPreview} />
    </main>
  );
}

/* ---------- 2. 产品主页风：个人 SaaS 官网 ---------- */
function ProductHomeLayout({ content, downloadUrl, isPreview }: ResumePageViewProps) {
  return (
    <main className="resume-page theme-product-home" key="product-home">
      <header className="rp-hero">
        <div className="rp-hero-card">
          <p className="rp-eyebrow">{content.positioning}</p>
          <h1>{content.name || "未命名"}</h1>
          {content.headline && <p className="rp-headline">{content.headline}</p>}
          {content.bio && <p className="rp-bio">{content.bio}</p>}
          <CtaActions content={content} downloadUrl={downloadUrl} />
          <div className="rp-hero-facts">
            {content.contact.location && <span>{content.contact.location}</span>}
            {content.contact.email && <span>{content.contact.email}</span>}
            {content.contact.phone && <span>{content.contact.phone}</span>}
          </div>
        </div>
      </header>

      {content.highlights.length > 0 && (
        <section className="rp-section rp-features">
          <div className="rp-section-head"><p className="rp-eyebrow">VALUE PROPOSITION</p><h2>我能带来什么</h2></div>
          <div className="rp-features-grid">
            {content.highlights.map((item, index) => (
              <article className="rp-feature" key={`${item.title}-${index}`}>
                <span className="rp-feature-index">{String(index + 1).padStart(2, "0")}</span>
                {item.title && <h3>{item.title}</h3>}
                {item.description && <p>{item.description}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {content.projects.length > 0 && (
        <section className="rp-section rp-cases">
          <div className="rp-section-head"><p className="rp-eyebrow">CASE STUDIES</p><h2>项目案例</h2></div>
          <div className="rp-cases-list">
            {content.projects.map((project, index) => (
              <article className="rp-case" key={`${project.name}-${index}`}>
                <span className="rp-case-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="rp-case-body">
                  <div className="rp-case-title">
                    <h3>{project.name || "未命名项目"}</h3>
                    {project.role && <span className="rp-project-role">{project.role}</span>}
                  </div>
                  {project.summary && <p>{project.summary}</p>}
                  <Chips items={project.tech} />
                </div>
                {project.link && <a className="rp-case-link" href={safeExternalUrl(project.link)} target="_blank" rel="noreferrer">查看 ↗</a>}
              </article>
            ))}
          </div>
        </section>
      )}

      {content.skills.length > 0 && (
        <section className="rp-section rp-skills-band">
          <div className="rp-section-head"><p className="rp-eyebrow">SKILLS</p><h2>技能栈</h2></div>
          <div className="rp-skills-band-grid">
            {content.skills.map((group, index) => (
              <div className="rp-skill-group" key={`${group.category}-${index}`}>
                <h3>{group.category}</h3>
                <Chips items={group.items} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rp-cta-band">
        <p className="rp-eyebrow">LET&apos;S WORK TOGETHER</p>
        <h2>把这份履历，变成一次对话。</h2>
        <CtaActions content={content} downloadUrl={downloadUrl} />
      </section>

      <section className="rp-section rp-contact">
        <div className="rp-section-head"><p className="rp-eyebrow">CONTACT</p><h2>联系方式</h2></div>
        <ContactItems content={content} />
      </section>
      <Footer isPreview={isPreview} />
    </main>
  );
}

/* ---------- 3. 创意作品集风：项目为主角 ---------- */
function CreativePortfolioLayout({ content, downloadUrl, isPreview }: ResumePageViewProps) {
  return (
    <main className="resume-page theme-creative-portfolio" key="creative-portfolio">
      <header className="rp-hero">
        <p className="rp-kicker">PORTFOLIO · {content.name || "未命名"}</p>
        <h1>{content.name || "未命名"}</h1>
        {content.headline && <p className="rp-headline">{content.headline}</p>}
        {content.bio && <p className="rp-bio">{content.bio}</p>}
        <CtaActions content={content} downloadUrl={downloadUrl} />
      </header>

      {content.projects.length > 0 && (
        <section className="rp-section rp-work">
          <div className="rp-section-head"><span className="rp-num">01</span><div><p className="rp-eyebrow">SELECTED WORK</p><h2>项目</h2></div></div>
          <div className="rp-work-grid">
            {content.projects.map((project, index) => (
              <article className={`rp-work-card${index === 0 ? " rp-featured" : ""}`} key={`${project.name}-${index}`}>
                <span className="rp-work-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{project.name || "未命名项目"}</h3>
                {project.role && <span className="rp-project-role">{project.role}</span>}
                {project.summary && <p>{project.summary}</p>}
                <Chips items={project.tech} />
                {project.link && <a className="rp-project-link" href={safeExternalUrl(project.link)} target="_blank" rel="noreferrer">查看项目 ↗</a>}
              </article>
            ))}
          </div>
        </section>
      )}

      {content.highlights.length > 0 && (
        <section className="rp-section rp-about">
          <div className="rp-section-head"><span className="rp-num">02</span><div><p className="rp-eyebrow">ABOUT</p><h2>核心优势</h2></div></div>
          <div className="rp-about-grid">
            {content.highlights.map((item, index) => (
              <div className="rp-about-line" key={`${item.title}-${index}`}>
                <span className="rp-about-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  {item.title && <h3>{item.title}</h3>}
                  {item.description && <p>{item.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.skills.length > 0 && (
        <section className="rp-section rp-skills">
          <div className="rp-section-head"><span className="rp-num">03</span><div><p className="rp-eyebrow">TOOLS</p><h2>技能</h2></div></div>
          <div className="rp-skills-tape">
            {content.skills.map((group, index) => (
              <div className="rp-skill-group" key={`${group.category}-${index}`}>
                <h3>{group.category}</h3>
                <Chips items={group.items} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rp-section rp-contact">
        <div className="rp-section-head"><span className="rp-num">04</span><div><p className="rp-eyebrow">CONTACT</p><h2>联系我</h2></div></div>
        <ContactItems content={content} />
      </section>
      <Footer isPreview={isPreview} />
    </main>
  );
}

/* ---------- 4. 企业科技风：深色系统感 ---------- */
function EnterpriseTechLayout({ content, downloadUrl, isPreview }: ResumePageViewProps) {
  return (
    <main className="resume-page theme-enterprise-tech" key="enterprise-tech">
      <header className="rp-hero">
        <p className="rp-eyebrow">{content.positioning ? `// ${content.positioning}` : "// OPEN TO WORK"}</p>
        <h1>{content.name || "未命名"}</h1>
        {content.headline && <p className="rp-headline">{content.headline}</p>}
        {content.bio && <p className="rp-bio">{content.bio}</p>}
        <CtaActions content={content} downloadUrl={downloadUrl} />
      </header>

      {content.highlights.length > 0 && (
        <section className="rp-section rp-matrix">
          <div className="rp-section-head"><p className="rp-eyebrow">CAPABILITY MATRIX</p><h2>核心能力矩阵</h2></div>
          <div className="rp-matrix-grid">
            {content.highlights.map((item, index) => (
              <article className="rp-matrix-cell" key={`${item.title}-${index}`}>
                <span className="rp-cell-index">{String(index + 1).padStart(2, "0")}</span>
                {item.title && <h3>{item.title}</h3>}
                {item.description && <p>{item.description}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {content.skills.length > 0 && (
        <section className="rp-section rp-stack">
          <div className="rp-section-head"><p className="rp-eyebrow">TECH STACK</p><h2>技术栈</h2></div>
          <div className="rp-stack-grid">
            {content.skills.map((group, index) => (
              <div className="rp-stack-group" key={`${group.category}-${index}`}>
                <h3>{group.category}</h3>
                <Chips items={group.items} />
              </div>
            ))}
          </div>
        </section>
      )}

      {content.projects.length > 0 && (
        <section className="rp-section rp-projects">
          <div className="rp-section-head"><p className="rp-eyebrow">PROJECTS</p><h2>项目与指标</h2></div>
          <div className="rp-projects-grid">
            {content.projects.map((project, index) => (
              <article className="rp-tech-project" key={`${project.name}-${index}`}>
                <div className="rp-tech-project-head">
                  <span className="rp-project-index">P-{String(index + 1).padStart(2, "0")}</span>
                  {project.link && <a className="rp-project-link" href={safeExternalUrl(project.link)} target="_blank" rel="noreferrer">↗</a>}
                </div>
                <h3>{project.name || "未命名项目"}</h3>
                {project.role && <span className="rp-project-role">{project.role}</span>}
                {project.summary && <p>{project.summary}</p>}
                {project.metrics.length > 0 && <div className="rp-metrics">{project.metrics.map((metric) => <span className="rp-metric" key={metric}>{metric}</span>)}</div>}
                <Chips items={project.tech} />
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rp-section rp-contact">
        <div className="rp-section-head"><p className="rp-eyebrow">CONTACT</p><h2>联系方式</h2></div>
        <ContactItems content={content} />
      </section>
      <Footer isPreview={isPreview} />
    </main>
  );
}

export function ResumePageView({ content: rawContent, themeId, downloadUrl, isPreview = false }: ResumePageViewProps) {
  const content = normalizeResumePageContent(rawContent);
  const props: ResumePageViewProps = { content, themeId, downloadUrl, isPreview };
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {THEME_FONTS[themeId].map((href) => <link key={href} rel="stylesheet" href={href} />)}
      {themeId === "clean-pro" && <CleanProLayout {...props} />}
      {themeId === "product-home" && <ProductHomeLayout {...props} />}
      {themeId === "creative-portfolio" && <CreativePortfolioLayout {...props} />}
      {themeId === "enterprise-tech" && <EnterpriseTechLayout {...props} />}
    </>
  );
}
