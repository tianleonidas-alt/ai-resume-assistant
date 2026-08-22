import { NextRequest, NextResponse } from "next/server";
import { mapResumePageRow } from "@/lib/resume-page";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const { id } = await context.params;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("resume_pages")
    .update({ status: "draft", slug: null, published_at: null })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Resume page unpublish failed", error);
    return NextResponse.json({ error: "取消发布失败，请稍后重试。" }, { status: 500 });
  }

  return NextResponse.json({ page: mapResumePageRow(data as Record<string, unknown>) });
}
