import { NextRequest, NextResponse } from "next/server";
import { sanitizeNextPath } from "../../../server/auth/next-path";
import { createSupabaseRouteClient } from "../../../lib/supabase/server";
import { trackBestEffort } from "../../../server/tracking/trackBestEffort";
import { getRequestMeta } from "../../../server/tracking/requestMeta";
import { getProfileForUser } from "../../../server/profiles/store";
import { DEFAULT_PROFILE_CONTEXT, POLICY_VERSION } from "../../../lib/profile";
import { supabaseAdminFetch } from "../../../server/supabase/admin";

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

  // Track login success event and ensure profile exists
  if (data.session && data.user) {
    const userId = data.user.id;
    const isNewUser =
      data.user.created_at &&
      new Date(data.user.created_at).getTime() > Date.now() - 60 * 60 * 1000; // 1 hour
    
    // Determine auth method from user metadata or email
    const authMethod = data.user.app_metadata?.provider === "google" ? "google" : 
                      data.user.email ? "email_otp" : "unknown";

    // Ensure profile exists for new users or users without profile
    const existingProfile = await getProfileForUser(supabase, userId);
    if (!existingProfile) {
      // Create default profile for new user
      const now = new Date().toISOString();
      const profileData = {
        user_id: userId,
        country_code: DEFAULT_PROFILE_CONTEXT.country_code,
        preferred_language: DEFAULT_PROFILE_CONTEXT.preferred_language,
        preferred_currency: DEFAULT_PROFILE_CONTEXT.preferred_currency,
        accepted_at: now,
        policy_version: POLICY_VERSION,
        nickname: "Nickname", // Default nickname (will be updated in onboarding)
        avatar_name: "default", // Default avatar (will be updated in onboarding)
      };

      const profileResponse = await supabaseAdminFetch("/rest/v1/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(profileData),
      });

      if (!profileResponse.ok) {
        console.error("[auth/callback] Failed to create profile", {
          user_id: userId,
          status: profileResponse.status,
        });
        // Continue anyway - profile creation is best-effort
      }
    }

    const requestMeta = getRequestMeta(request.headers);
    trackBestEffort({
      event_name: "web.auth.login_success",
      user_id: userId,
      share_id: null,
      client_id: null,
      meta: {
        auth_method: authMethod,
        is_new_user: isNewUser,
        request_id: requestMeta.request_id,
        x_vercel_id: requestMeta.x_vercel_id,
      },
    });
  }

  return response;
}
