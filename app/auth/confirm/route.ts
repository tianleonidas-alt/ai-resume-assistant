import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";

function safeNext(value: string | null) {
  return value?.startsWith("/") ? value : "/";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));
  const { supabase, applySessionCookies } = createRouteSupabaseClient(request);

  if (tokenHash && (type === "email" || type === "signup")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const destination = new URL(next, requestUrl.origin);
      destination.searchParams.set("auth", "confirmed");
      return applySessionCookies(NextResponse.redirect(destination));
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = new URL(next, requestUrl.origin);
      destination.searchParams.set("auth", "confirmed");
      return applySessionCookies(NextResponse.redirect(destination));
    }
  }

  return applySessionCookies(NextResponse.redirect(new URL("/?auth=error", requestUrl.origin)));
}
