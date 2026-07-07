import { NextRequest, NextResponse } from "next/server";
import { consumeOauthCode } from "../../../../server/oauth/code-store";
import { createAccessToken } from "../../../../server/oauth/access-token";
import {
  isRedirectUriAllowedAsync,
  resolveClientRedirectUris,
} from "../../../../server/oauth/clients";
import { REFRESH_TOKEN_TTL_SECONDS } from "../../../../server/oauth/config";
import { findValidRefreshToken, insertRefreshToken } from "../../../../server/oauth/refresh-store";
import { generateRefreshToken, hashToken, verifyPkceS256 } from "../../../../server/oauth/tokens";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: "invalid_request", error_description: message }, { status });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return jsonError("content-type must be application/x-www-form-urlencoded", 415);
  }

  const formData = await request.formData();
  const grantType = formData.get("grant_type")?.toString();
  const clientId = formData.get("client_id")?.toString();

  if (!grantType) {
    return jsonError("grant_type is required");
  }
  if (!clientId) {
    return jsonError("client_id is required");
  }
  if (!(await resolveClientRedirectUris(clientId))) {
    return jsonError("unknown client_id");
  }

  if (grantType === "authorization_code") {
    const code = formData.get("code")?.toString();
    const redirectUri = formData.get("redirect_uri")?.toString();
    const codeVerifier = formData.get("code_verifier")?.toString();
    const resource = formData.get("resource")?.toString();

    if (!code) {
      return jsonError("code is required");
    }
    if (!redirectUri) {
      return jsonError("redirect_uri is required");
    }
    if (!(await isRedirectUriAllowedAsync(clientId, redirectUri))) {
      return jsonError("redirect_uri is not allowed");
    }

    const now = new Date().toISOString();
    const record = await consumeOauthCode({
      code,
      clientId,
      redirectUri,
      now,
    });

    if (!record) {
      return jsonError("invalid or expired code", 400);
    }

    // PKCE (RFC 7636): if the authorization request bound a code_challenge, a matching
    // S256 code_verifier is required here.
    if (record.code_challenge) {
      if (!codeVerifier) {
        return jsonError("code_verifier is required", 400);
      }
      if (!verifyPkceS256(codeVerifier, record.code_challenge)) {
        return jsonError("invalid code_verifier", 400);
      }
    }

    const accessToken = createAccessToken({
      userId: record.user_id,
      clientId,
      resource: resource ?? record.resource ?? undefined,
      scope: record.scope ?? undefined,
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();

    await insertRefreshToken({
      refresh_token_hash: refreshTokenHash,
      user_id: record.user_id,
      client_id: clientId,
      expires_at: refreshExpiresAt,
    });

    return NextResponse.json({
      access_token: accessToken.token,
      token_type: "Bearer",
      expires_in: accessToken.expiresIn,
      refresh_token: refreshToken,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = formData.get("refresh_token")?.toString();
    const resource = formData.get("resource")?.toString();
    if (!refreshToken) {
      return jsonError("refresh_token is required");
    }

    const refreshTokenHash = hashToken(refreshToken);
    const now = new Date().toISOString();
    const record = await findValidRefreshToken({
      refreshTokenHash,
      clientId,
      now,
    });

    if (!record) {
      return jsonError("invalid or expired refresh_token", 400);
    }

    const accessToken = createAccessToken({
      userId: record.user_id,
      clientId,
      resource,
    });

    return NextResponse.json({
      access_token: accessToken.token,
      token_type: "Bearer",
      expires_in: accessToken.expiresIn,
    });
  }

  return jsonError("unsupported grant_type", 400);
}
