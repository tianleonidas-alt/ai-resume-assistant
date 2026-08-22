import { HomeClient } from "@/components/home-client";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InitialUser = { id: string; email: string | null };

export default async function HomePage() {
  let initialUser: InitialUser | null = null;

  if (hasPublicSupabaseConfig()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims;
      const userId = typeof claims?.sub === "string" ? claims.sub : null;
      if (userId && claims) {
        initialUser = {
          id: userId,
          email: typeof claims.email === "string" ? claims.email : null,
        };
      }
    } catch {
      // Fall back to the client-side session check when server claims fail.
    }
  }

  return <HomeClient initialUser={initialUser} />;
}
