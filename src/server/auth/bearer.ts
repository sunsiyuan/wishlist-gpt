import { getSigningSecret } from "../oauth/config";
import { verifyJwt } from "../oauth/jwt";

export type AccessTokenClaims = {
  userId: string;
  clientId: string;
};

export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export function verifyAccessToken(token: string): AccessTokenClaims | null {
  const secret = getSigningSecret();
  const payload = verifyJwt(token, secret);
  if (!payload) {
    return null;
  }
  return {
    userId: payload.sub,
    clientId: payload.aud,
  };
}
