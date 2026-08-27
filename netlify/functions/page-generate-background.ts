import { createClient } from "@supabase/supabase-js";
import { isLlmProvider, readJsonObject, runChatCompletion } from "../../lib/llm-core";
import { RESUME_PAGE_SYSTEM_PROMPT } from "../../lib/page-generate-core";
import { normalizeResumePageContent } from "../../lib/resume-page";
import { releaseCredit, recordLlmUsage } from "../../lib/billing";

export const config = { background: true };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase 服务端配置缺失。");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function pageGenerateBackground(request: Request) {
  const admin = adminClient();
  let pageId: string | null = null;

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return new Response(null, { status: 400 });
    }
    pageId = typeof body.pageId === "string" ? body.pageId : null;
    if (!pageId) return new Response(null, { status: 400 });

    // Atomically claim the pending page so duplicate/retry invocations are no-ops.
    const { data: page, error: claimError } = await admin
      .from("resume_pages")
      .update({ generation_status: "processing" })
      .eq("id", pageId)
      .eq("generation_status", "pending")
      .select("id, user_id, source_resume_id, source_analysis_run_id")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!page) return new Response(null, { status: 202 });

    const providerRaw = typeof body.provider === "string" ? body.provider : "";
    const provider = isLlmProvider(providerRaw) ? providerRaw : "deepseek";
    const resumeText = typeof body.resumeText === "string" ? body.resumeText.trim() : "";
    const jobContext = typeof body.jobContext === "string" ? body.jobContext.trim() : "";
    if (resumeText.length < 30) {
      throw new Error("生成所需的简历文本缺失，请重新提交。");
    }

    const { content, model: usedModel, usage } = await runChatCompletion({
      provider,
      temperature: 0.45,
      json: true,
      messages: [
        { role: "system", content: RESUME_PAGE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `【简历文本】\n${resumeText.slice(0, 18000)}${jobContext ? `\n\n【目标岗位描述（用于定向）】\n${jobContext.slice(0, 12000)}` : ""}`,
        },
      ],
    });
    const normalized = normalizeResumePageContent(readJsonObject(content));
    const title = normalized.name ? `${normalized.name} · 在线简历` : "未命名在线简历页";

    const { error: updateError } = await admin
      .from("resume_pages")
      .update({
        title: title.slice(0, 120),
        content: normalized,
        generation_status: "completed",
      })
      .eq("id", pageId)
      .eq("user_id", page.user_id);
    if (updateError) throw updateError;

    try {
      await recordLlmUsage({
        userId: page.user_id,
        provider,
        model: usedModel,
        purpose: "resume_page",
        eventRef: pageId,
        usage,
      });
    } catch (usageError) {
      console.error("Usage record failed", usageError);
    }
  } catch (error) {
    console.error("Resume page background generation failed", error);
    const message = error instanceof Error ? error.message : "生成失败，请稍后重试。";
    if (pageId) {
      await admin
        .from("resume_pages")
        .update({ generation_status: "failed", generation_error: message.slice(0, 500) })
        .eq("id", pageId);
      const { data: page } = await admin
        .from("resume_pages")
        .select("user_id, source_analysis_run_id")
        .eq("id", pageId)
        .maybeSingle();
      if (page?.user_id && !page.source_analysis_run_id) {
        // 直传来源页面的预扣由 /api/resume-pages/generate 生成，失败释放。
        await releaseCredit(page.user_id, pageId);
      }
    }
  }

  return new Response(null, { status: 202 });
}
