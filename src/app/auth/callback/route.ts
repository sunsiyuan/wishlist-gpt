import { NextRequest, NextResponse } from "next/server";
import { sanitizeNextPath } from "../../../server/auth/next-path";
import { createSupabaseRouteClient } from "../../../lib/supabase/server";

const DEFAULT_REDIRECT = "/app";

function buildLoginRedirect(request: NextRequest, nextPath: string, reason: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);
  loginUrl.searchParams.set("error", reason);
  return NextResponse.redirect(loginUrl, 302);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = sanitizeNextPath(searchParams.get("next"), DEFAULT_REDIRECT);

  if (!code) {
    return buildLoginRedirect(request, nextPath, "missing_code");
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), 302);
  const supabase = createSupabaseRouteClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return buildLoginRedirect(request, nextPath, "oauth_exchange_failed");
  }

  return response;
}
