import { createClient } from "@supabase/supabase-js";
import { getAdminSupabaseConfig } from "./config";

export function createAdminSupabaseClient() {
  const { url, serviceRoleKey } = getAdminSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
