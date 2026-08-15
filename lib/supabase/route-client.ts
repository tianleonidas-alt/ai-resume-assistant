import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "./config";

type CookieUpdate = { name: string; value: string; options: CookieOptions };

export function createRouteSupabaseClient(request: NextRequest) {
  const { url, key } = getPublicSupabaseConfig();
  const cookieUpdates: CookieUpdate[] = [];
  const responseHeaders = new Headers();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookieUpdates.push(...cookiesToSet);
        Object.entries(headers).forEach(([name, value]) => responseHeaders.set(name, value));
      },
    },
  });

  function applySessionCookies(response: NextResponse) {
    cookieUpdates.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    responseHeaders.forEach((value, name) => response.headers.set(name, value));
    return response;
  }

  return { supabase, applySessionCookies };
}
