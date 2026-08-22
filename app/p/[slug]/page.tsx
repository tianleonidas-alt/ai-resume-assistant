import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResumePageView } from "@/components/resume-page-view";
import { mapResumePageRow } from "@/lib/resume-page";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function findPublishedPage(slug: string) {
  if (!hasPublicSupabaseConfig()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("resume_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data ? mapResumePageRow(data as Record<string, unknown>) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await findPublishedPage(slug);
  if (!page) return { title: "简历页不存在" };
  const description = page.content.positioning || page.content.bio.slice(0, 120) || "个人求职主页";
  return {
    title: `${page.title} · 在线简历`,
    description,
    openGraph: { title: page.title, description },
  };
}

export default async function PublicResumePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await findPublishedPage(slug);
  if (!page) notFound();

  let downloadUrl: string | null = null;
  if (page.pdfDownloadEnabled && page.sourceResumeId) {
    try {
      const admin = createAdminSupabaseClient();
      const { data: resume } = await admin
        .from("resumes")
        .select("file_path")
        .eq("id", page.sourceResumeId)
        .maybeSingle();
      if (resume?.file_path) {
        const { data: signed } = await admin.storage.from("resume-files").createSignedUrl(String(resume.file_path), 15 * 60);
        downloadUrl = signed?.signedUrl || null;
      }
    } catch (signedError) {
      console.error("Resume page signed URL failed", signedError);
    }
  }

  return <ResumePageView content={page.content} themeId={page.themeId} downloadUrl={downloadUrl} />;
}
