import crypto from "crypto";

export function generateOauthCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateClientId(): string {
  return `mcp_${crypto.randomBytes(24).toString("base64url")}`;
}

/**
 * Verify a PKCE code_verifier against a stored S256 code_challenge (RFC 7636).
 * Only S256 is supported (plain is rejected).
 */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const digest = crypto.createHash("sha256").update(codeVerifier).digest();
  const expected = Buffer.from(digest.toString("base64url"));
  const actual = Buffer.from(codeChallenge);
  if (expected.length !== actual.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, actual);
}
