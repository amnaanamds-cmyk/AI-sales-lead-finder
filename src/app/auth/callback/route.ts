import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REF_COOKIE } from "@/lib/supabase/proxy";
import { createClient } from "@/lib/supabase/server";

/** Google OAuth lands here with a `code` to exchange for a session. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/search";
  // Only allow same-site relative redirects.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/search";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("service_type")
        .eq("id", user!.id)
        .single();
      // New account from an invite link: credit the referrer (the database checks it's fresh and not self).
      const jar = await cookies();
      const ref = jar.get(REF_COOKIE)?.value;
      if (ref && !profile?.service_type) await supabase.rpc("claim_referral", { code: ref });
      const dest = profile?.service_type ? safeNext : "/onboarding";
      const response = NextResponse.redirect(`${origin}${dest}`);
      if (ref) response.cookies.delete(REF_COOKIE);
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
