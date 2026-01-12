import { NextRequest, NextResponse } from "next/server";
import { sanitizeNextPath } from "../../../server/auth/next-path";
import { createSupabaseRouteClient } from "../../../lib/supabase/server";
import { trackBestEffort } from "../../../server/tracking/trackBestEffort";
import { getRequestMeta } from "../../../server/tracking/requestMeta";

const DEFAULT_REDIRECT = "/onboarding";

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
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return buildLoginRedirect(request, nextPath, "oauth_exchange_failed");
  }

  // Track Google login success event
  if (data.session && data.user) {
    const isNewUser =
      data.user.created_at &&
      new Date(data.user.created_at).getTime() > Date.now() - 60 * 60 * 1000; // 1 hour
    const requestMeta = getRequestMeta(request.headers);
    trackBestEffort({
      event_name: "web.auth.login_success",
      user_id: data.user.id,
      share_id: null,
      client_id: null,
      meta: {
        auth_method: "google",
        is_new_user: isNewUser,
        request_id: requestMeta.request_id,
        x_vercel_id: requestMeta.x_vercel_id,
      },
    });
  }

  return response;
}
