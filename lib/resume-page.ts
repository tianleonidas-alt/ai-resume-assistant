export type ResumePageThemeId = "clean-pro" | "product-home" | "creative-portfolio" | "enterprise-tech";

export type ResumePageTheme = {
  id: ResumePageThemeId;
  name: string;
  description: string;
};

export const RESUME_PAGE_THEMES: ResumePageTheme[] = [
  { id: "clean-pro", name: "清爽专业", description: "双栏简历主页，克制可信，适合传统企业与通用岗位" },
  { id: "product-home", name: "产品主页风", description: "个人 SaaS 官网风：强 Hero、卖点、案例与行动号召" },
  { id: "creative-portfolio", name: "创意作品集风", description: "项目为主角的作品集：大卡片、不规则网格与编号分区" },
  { id: "enterprise-tech", name: "企业科技风", description: "深色系统感：能力矩阵、技术栈与项目指标" },
];

export const DEFAULT_RESUME_PAGE_THEME: ResumePageThemeId = "clean-pro";

export function isResumePageThemeId(value: string): value is ResumePageThemeId {
  return RESUME_PAGE_THEMES.some((theme) => theme.id === value);
}

export type ResumePageStatus = "draft" | "published";

export type ResumePageHighlight = { title: string; description: string };
export type ResumePageProject = {
  name: string;
  role: string;
  summary: string;
  tech: string[];
  metrics: string[];
  link: string;
};
export type ResumePageSkillGroup = { category: string; items: string[] };
export type ResumePageSocial = { label: string; url: string };

export type ResumePageContent = {
  name: string;
  headline: string;
  positioning: string;
  bio: string;
  highlights: ResumePageHighlight[];
  projects: ResumePageProject[];
  skills: ResumePageSkillGroup[];
  contact: {
    email: string;
    phone: string;
    location: string;
    website: string;
    socials: ResumePageSocial[];
  };
  cta: { label: string; href: string };
};

export const emptyResumePageContent: ResumePageContent = {
  name: "",
  headline: "",
  positioning: "",
  bio: "",
  highlights: [],
  projects: [],
  skills: [],
  contact: { email: "", phone: "", location: "", website: "", socials: [] },
  cta: { label: "联系我", href: "#contact" },
};

export type ResumePageDTO = {
  id: string;
  title: string;
  themeId: ResumePageThemeId;
  status: ResumePageStatus;
  content: ResumePageContent;
  pdfDownloadEnabled: boolean;
  sourceResumeId: string | null;
  sourceAnalysisRunId: string | null;
  slug: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function clampString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function clampParagraph(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => clampString(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function objectAt(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function mapHighlight(value: unknown): ResumePageHighlight | null {
  const record = objectAt(value);
  const title = clampString(record.title, 40);
  const description = clampParagraph(record.description, 200);
  if (!title && !description) return null;
  return { title, description };
}

function mapProject(value: unknown): ResumePageProject | null {
  const record = objectAt(value);
  const name = clampString(record.name, 80);
  const role = clampString(record.role, 40);
  const summary = clampParagraph(record.summary, 500);
  if (!name && !summary) return null;
  return {
    name,
    role,
    summary,
    tech: stringArray(record.tech, 8, 30),
    metrics: stringArray(record.metrics, 5, 40),
    link: clampString(record.link, 300),
  };
}

function mapSkillGroup(value: unknown): ResumePageSkillGroup | null {
  const record = objectAt(value);
  const category = clampString(record.category, 40);
  const items = stringArray(record.items, 20, 30);
  if (!category && items.length === 0) return null;
  return { category: category || "技能", items };
}

function mapSocial(value: unknown): ResumePageSocial | null {
  const record = objectAt(value);
  const label = clampString(record.label, 40);
  const url = clampString(record.url, 300);
  if (!label && !url) return null;
  return { label: label || "链接", url };
}

export function normalizeResumePageContent(input: unknown): ResumePageContent {
  const raw = objectAt(input);
  const contact = objectAt(raw.contact);
  const cta = objectAt(raw.cta);
  const email = clampString(contact.email, 120);
  const ctaLabel = clampString(cta.label, 20) || "联系我";
  const ctaHref = clampString(cta.href, 300) || (email ? `mailto:${email}` : "#contact");

  return {
    name: clampString(raw.name, 60),
    headline: clampString(raw.headline, 80),
    positioning: clampString(raw.positioning, 120),
    bio: clampParagraph(raw.bio, 1000),
    highlights: Array.isArray(raw.highlights) ? raw.highlights.map(mapHighlight).filter((item): item is ResumePageHighlight => Boolean(item)).slice(0, 6) : [],
    projects: Array.isArray(raw.projects) ? raw.projects.map(mapProject).filter((item): item is ResumePageProject => Boolean(item)).slice(0, 6) : [],
    skills: Array.isArray(raw.skills) ? raw.skills.map(mapSkillGroup).filter((item): item is ResumePageSkillGroup => Boolean(item)).slice(0, 8) : [],
    contact: {
      email,
      phone: clampString(contact.phone, 40),
      location: clampString(contact.location, 80),
      website: clampString(contact.website, 300),
      socials: Array.isArray(contact.socials) ? contact.socials.map(mapSocial).filter((item): item is ResumePageSocial => Boolean(item)).slice(0, 8) : [],
    },
    cta: { label: ctaLabel, href: ctaHref },
  };
}

export function mapResumePageRow(row: Record<string, unknown>): ResumePageDTO {
  const themeId = typeof row.theme_id === "string" && isResumePageThemeId(row.theme_id) ? row.theme_id : DEFAULT_RESUME_PAGE_THEME;
  return {
    id: String(row.id),
    title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : "未命名在线简历页",
    themeId,
    status: row.status === "published" ? "published" : "draft",
    content: normalizeResumePageContent(row.content),
    pdfDownloadEnabled: row.pdf_download_enabled !== false,
    sourceResumeId: typeof row.source_resume_id === "string" ? row.source_resume_id : null,
    sourceAnalysisRunId: typeof row.source_analysis_run_id === "string" ? row.source_analysis_run_id : null,
    slug: typeof row.slug === "string" ? row.slug : null,
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateSlug(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let slug = "";
  for (let index = 0; index < length; index++) {
    slug += SLUG_ALPHABET[bytes[index] % SLUG_ALPHABET.length];
  }
  return slug;
}

export function publicResumePageUrl(slug: string): string {
  return `/p/${slug}`;
}

export function initialsForName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "履";
  if (/[\u4e00-\u9fff]/.test(trimmed)) return trimmed.slice(0, 2);
  return trimmed.split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase() || "履";
}

/** Reject javascript: and other unsafe URL schemes before rendering links. */
export function safeExternalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("#")) return trimmed;
  return "#";
}
