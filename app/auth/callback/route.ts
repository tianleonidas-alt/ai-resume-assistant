import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") ? next : "/";
  const { supabase, applySessionCookies } = createRouteSupabaseClient(request);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return applySessionCookies(NextResponse.redirect(new URL(safeNext, requestUrl.origin)));
  }

  return applySessionCookies(NextResponse.redirect(new URL("/?auth=error", requestUrl.origin)));
}
