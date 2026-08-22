import { notFound } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { ResumePageEditor } from "@/components/resume-page-editor";
import { mapResumePageRow } from "@/lib/resume-page";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResumePageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!hasPublicSupabaseConfig()) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !userId) {
    return <main className="editor-shell"><AuthGate message="登录后即可编辑在线简历页。" /></main>;
  }

  const { data, error } = await supabase
    .from("resume_pages")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) notFound();

  return <ResumePageEditor page={mapResumePageRow(data as Record<string, unknown>)} />;
}
