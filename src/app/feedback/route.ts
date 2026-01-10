import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyAccessToken } from "../../server/auth/bearer";
import { handleFeedbackRequest } from "../../server/feedback/handlers";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_auth" }, { status: 401 });
  }

  const claims = verifyAccessToken(token);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  return handleFeedbackRequest({ request, userId: claims.userId });
}
