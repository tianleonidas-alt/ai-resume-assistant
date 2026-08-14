import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "请先登录后再保存简历。" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");
    const parsedText = String(formData.get("parsedText") || "").trim();

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "未收到简历 PDF。" }, { status: 400 });
    }
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "仅支持 PDF 格式的简历。" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "简历文件需大于 0 且不超过 20 MB。" }, { status: 400 });
    }
    if (parsedText.length < 30 || parsedText.length > 60000) {
      return NextResponse.json({ error: "简历文字内容异常，请更换可选中文本的 PDF。" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const resumeId = crypto.randomUUID();
    const filePath = `${user.id}/${resumeId}.pdf`;
    const { data: defaultResume, error: defaultError } = await admin
      .from("resumes")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .maybeSingle();

    if (defaultError) throw defaultError;

    const { error: uploadError } = await admin.storage
      .from("resume-files")
      .upload(filePath, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    const { data: resume, error: insertError } = await admin
      .from("resumes")
      .insert({
        id: resumeId,
        user_id: user.id,
        name: file.name.replace(/\.pdf$/i, "").slice(0, 120),
        file_path: filePath,
        file_name: file.name,
        mime_type: "application/pdf",
        file_size: file.size,
        parsed_text: parsedText,
        parse_status: "ready",
        is_default: !defaultResume,
      })
      .select("id, name, file_name, is_default, created_at")
      .single();

    if (insertError) {
      await admin.storage.from("resume-files").remove([filePath]);
      throw insertError;
    }

    return NextResponse.json({ resume });
  } catch (error) {
    console.error("Resume save failed", error);
    return NextResponse.json(
      { error: "简历保存失败。请确认 Supabase 已配置且数据库迁移已执行。" },
      { status: 500 },
    );
  }
}
