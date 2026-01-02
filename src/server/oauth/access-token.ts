import { ACCESS_TOKEN_TTL_SECONDS, getSigningSecret } from "./config";
import { signJwt } from "./jwt";

export function createAccessToken(params: { userId: string; clientId: string }): { token: string; expiresIn: number } {
  const token = signJwt({ sub: params.userId, aud: params.clientId }, getSigningSecret(), ACCESS_TOKEN_TTL_SECONDS);
  return {
    token,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}
