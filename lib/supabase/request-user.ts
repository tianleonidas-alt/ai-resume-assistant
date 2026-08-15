import { createServerSupabaseClient } from "./server";

export async function getAuthenticatedRequestUser(request: Request): Promise<{ id: string } | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const path = new URL(request.url).pathname;

  if (error || !userId) {
    console.info("[auth] Cookie 会话缺失或验证失败", { path });
    return null;
  }

  console.info("[auth] Cookie 会话已验证", { path });
  return { id: userId };
}
