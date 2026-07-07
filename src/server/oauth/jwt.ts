import crypto from "crypto";

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export type JwtPayload = {
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  client_id?: string;
  scope?: string;
};

export function signJwt(payload: Omit<JwtPayload, "exp" | "iat">, secret: string, expiresInSeconds: number): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest();
  const signatureEncoded = base64UrlEncode(signature);
  return `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest();
  const expected = Buffer.from(signatureEncoded, "base64url");
  if (expected.length !== signature.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(signature, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as JwtPayload;
    if (!payload.exp || !payload.sub || !payload.aud) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
