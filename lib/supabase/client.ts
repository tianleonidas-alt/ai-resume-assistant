import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "./config";

export function createBrowserSupabaseClient() {
  const { url, key } = getPublicSupabaseConfig();
  return createBrowserClient(url, key);
}
