import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../server/auth/supabase";
import { isRedirectUriAllowed } from "../../../../server/oauth/clients";
import { CODE_TTL_SECONDS, OAUTH_STATE_COOKIE } from "../../../../server/oauth/config";
import { insertOauthCode } from "../../../../server/oauth/code-store";
import { generateOauthCode } from "../../../../server/oauth/tokens";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: "invalid_request", error_description: message }, { status });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const responseType = searchParams.get("response_type");
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const state = searchParams.get("state");

  if (!responseType || responseType !== "code") {
    return jsonError("response_type must be code");
  }
  if (!clientId) {
    return jsonError("client_id is required");
  }
  if (!redirectUri) {
    return jsonError("redirect_uri is required");
  }
  if (!state) {
    return jsonError("state is required");
  }
  if (!isRedirectUriAllowed(clientId, redirectUri)) {
    return jsonError("redirect_uri is not allowed", 400);
  }

  const existingState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (existingState && existingState !== state) {
    const response = jsonError("state mismatch", 400);
    response.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  }
  if (!existingState) {
    const response = NextResponse.redirect(request.url);
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: CODE_TTL_SECONDS,
      path: "/",
    });
    return response;
  }

  const userId = await getSupabaseUserId(request);
  if (!userId) {
    const response = jsonError("login required", 401);
    return response;
  }

  const code = generateOauthCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

  await insertOauthCode({
    code,
    user_id: userId,
    client_id: clientId,
    redirect_uri: redirectUri,
    expires_at: expiresAt,
    used_at: null,
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
