import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/config";

const PUBLIC_PATHS = ["/", "/login", "/auth", "/demo", "/r"];
export const REF_COOKIE = "ln_ref";

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
}

/** Remember an invite code from `/?ref=CODE` until sign-up. */
function withReferral(request: NextRequest, response: NextResponse) {
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && /^[a-z0-9]{6,16}$/i.test(ref) && !request.cookies.has(REF_COOKIE)) {
    response.cookies.set(REF_COOKIE, ref.toLowerCase(), {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}

/** Refreshes the Supabase session cookie and gates private pages. */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Not set up yet: public pages and the demo still work; app pages explain what's missing.
  if (!supabaseConfigured()) {
    if (isPublic(pathname) || pathname.startsWith("/api/")) return withReferral(request, NextResponse.next({ request }));
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname) && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return withReferral(request, response);
}
