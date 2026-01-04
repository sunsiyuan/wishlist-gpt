import { NextRequest, NextResponse } from "next/server";

const FIXED_COOKIE_NAMES = ["sb-access-token", "sb-refresh-token", "supabase-auth-token"] as const;

function shouldUseSecureCookie(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = request.nextUrl.protocol ?? "";
  return forwardedProto === "https" || protocol === "https:";
}

function matchesSupabaseAuthCookie(name: string): boolean {
  if (!name.startsWith("sb-")) {
    return false;
  }
  const lowerName = name.toLowerCase();
  return lowerName.includes("token") || lowerName.includes("auth");
}

export function clearAuthCookies(request: NextRequest, response: NextResponse): NextResponse {
  const secureCookie = shouldUseSecureCookie(request);
  const names = new Set<string>(FIXED_COOKIE_NAMES);

  for (const cookie of request.cookies.getAll()) {
    if (matchesSupabaseAuthCookie(cookie.name)) {
      names.add(cookie.name);
    }
  }

  for (const name of names) {
    response.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
    });
  }

  return response;
}
