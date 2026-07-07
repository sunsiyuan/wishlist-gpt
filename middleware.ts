import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./src/lib/supabase/config";
import { getProfileForUser } from "./src/server/profiles/store";
import { sanitizeNextPath } from "./src/server/auth/next-path";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { url, key } = getSupabaseConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  // Check profile completeness for /app routes
  const pathname = request.nextUrl.pathname;
  if (userId && pathname.startsWith("/app")) {
    const profile = await getProfileForUser(supabase, userId);
    // Check if profile is missing nickname or avatar_name
    if (!profile?.nickname || !profile?.avatar_name) {
      const nextPath = sanitizeNextPath(pathname + request.nextUrl.search, "/app");
      const redirectUrl = new URL("/onboarding/profile", request.url);
      redirectUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api/mcp|\\.well-known|_next/static|_next/image|favicon.ico|favicon.png|apple-touch-icon.png|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$).*)",
  ],
};
