import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyAccessToken } from "../../../server/auth/bearer";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }
  const claims = verifyAccessToken(token);
  if (!claims) {
    return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
  }
  return NextResponse.json({
    user_id: claims.userId,
    client_id: claims.clientId,
  });
}
