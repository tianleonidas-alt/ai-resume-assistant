import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";

function publicUserFromClaims(claims: Record<string, unknown>) {
  const id = typeof claims.sub === "string" ? claims.sub : null;
  if (!id) return null;
  return { id, email: typeof claims.email === "string" ? claims.email : null };
}

export async function GET(request: NextRequest) {
  const { supabase, applySessionCookies } = createRouteSupabaseClient(request);
  const { data, error } = await supabase.auth.getClaims();
  const user = data?.claims ? publicUserFromClaims(data.claims) : null;

  if (error || !user) {
    return applySessionCookies(NextResponse.json({ user: null }, { status: 401 }));
  }

  return applySessionCookies(NextResponse.json({ user }));
}
