import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyAccessToken } from "../../server/auth/bearer";
import { getSupabaseUserId } from "../../server/auth/supabase";
import { buildShareUrl, createOrReuseShare } from "../../server/shares";

function resolveOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

async function authenticate(request: NextRequest) {
  const supabaseUserId = await getSupabaseUserId(request);
  if (supabaseUserId) {
    return { userId: supabaseUserId };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ ok: false, error: "missing_auth" }, { status: 401 }) };
  }
  const claims = verifyAccessToken(token);
  if (!claims) {
    return { error: NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 }) };
  }
  return { userId: claims.userId };
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const share = await createOrReuseShare(auth.userId);
    const origin = resolveOrigin(request);
    return NextResponse.json({
      share_id: share.id,
      share_url: buildShareUrl(origin, share.id),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "share_create_failed" }, { status: 500 });
  }
}
