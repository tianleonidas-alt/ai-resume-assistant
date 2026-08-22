import { NextRequest, NextResponse } from "next/server";
import { generateSlug, mapResumePageRow } from "@/lib/resume-page";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const { id } = await context.params;
  const admin = createAdminSupabaseClient();
  const { data: existing, error: findError } = await admin
    .from("resume_pages")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (findError || !existing) return NextResponse.json({ error: "未找到该在线简历页。" }, { status: 404 });

  if (existing.status === "published" && existing.slug) {
    return NextResponse.json({ page: mapResumePageRow(existing as Record<string, unknown>) });
  }

  let page: Record<string, unknown> | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = generateSlug(10);
    const { data, error } = await admin
      .from("resume_pages")
      .update({ slug, status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (!error && data) {
      page = data as Record<string, unknown>;
      break;
    }
    lastError = error;
    const code = typeof error?.code === "string" ? error.code : "";
    if (code !== "23505") break;
  }

  if (!page) {
    console.error("Resume page publish failed", lastError);
    return NextResponse.json({ error: "发布失败，请稍后重试。" }, { status: 500 });
  }

  return NextResponse.json({ page: mapResumePageRow(page) });
}
