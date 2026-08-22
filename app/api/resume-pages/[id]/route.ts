import { NextRequest, NextResponse } from "next/server";
import { isResumePageThemeId, mapResumePageRow, normalizeResumePageContent } from "@/lib/resume-page";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const { id } = await context.params;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("resume_pages")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "未找到该在线简历页。" }, { status: 404 });

  const row = data as Record<string, unknown>;
  return NextResponse.json({
    page: mapResumePageRow(row),
    generationStatus: typeof row.generation_status === "string" ? row.generation_status : "idle",
    generationError: typeof row.generation_error === "string" ? row.generation_error : null,
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const { id } = await context.params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: existing, error: findError } = await admin
    .from("resume_pages")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (findError || !existing) return NextResponse.json({ error: "未找到该在线简历页。" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    update.title = body.title.trim().slice(0, 120) || "未命名在线简历页";
  }
  if (typeof body.themeId === "string" && isResumePageThemeId(body.themeId)) {
    update.theme_id = body.themeId;
  }
  if (body.content !== undefined) {
    update.content = normalizeResumePageContent(body.content);
  }
  if (typeof body.pdfDownloadEnabled === "boolean") {
    update.pdf_download_enabled = body.pdfDownloadEnabled;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "没有可更新的内容。" }, { status: 400 });
  }

  const { data: page, error: updateError } = await admin
    .from("resume_pages")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (updateError) {
    console.error("Resume page update failed", updateError);
    return NextResponse.json({ error: "保存失败，请稍后重试。" }, { status: 500 });
  }

  return NextResponse.json({ page: mapResumePageRow(page as Record<string, unknown>) });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const { id } = await context.params;
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("resume_pages").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    console.error("Resume page delete failed", error);
    return NextResponse.json({ error: "删除失败，请稍后重试。" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
