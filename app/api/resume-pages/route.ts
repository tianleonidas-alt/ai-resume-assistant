import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_RESUME_PAGE_THEME, mapResumePageRow, normalizeResumePageContent } from "@/lib/resume-page";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("resume_pages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Resume pages list failed", error);
    return NextResponse.json({ error: "读取失败，请稍后重试。" }, { status: 500 });
  }

  return NextResponse.json({ pages: (data || []).map((row) => mapResumePageRow(row as Record<string, unknown>)) });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("resume_pages")
    .insert({
      user_id: user.id,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "未命名在线简历页",
      theme_id: DEFAULT_RESUME_PAGE_THEME,
      content: normalizeResumePageContent(body.content),
      pdf_download_enabled: body.pdfDownloadEnabled !== false,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Resume page create failed", error);
    return NextResponse.json({ error: "创建失败，请稍后重试。" }, { status: 500 });
  }

  return NextResponse.json({ page: mapResumePageRow(data as Record<string, unknown>) }, { status: 201 });
}
