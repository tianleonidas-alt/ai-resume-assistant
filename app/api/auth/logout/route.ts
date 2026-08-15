import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";

export async function POST(request: NextRequest) {
  const { supabase, applySessionCookies } = createRouteSupabaseClient(request);
  await supabase.auth.signOut();
  return applySessionCookies(new NextResponse(null, { status: 204 }));
}
