import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import { buildShareUrl, createOrReuseShare } from "../../../server/shares";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("authorization")) {
    return NextResponse.json({ ok: false, error: "bearer_not_allowed" }, { status: 401 });
  }

  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  try {
    const share = await createOrReuseShare(userId);
    return NextResponse.json({
      share_id: share.id,
      share_url: buildShareUrl(request.nextUrl.origin, share.id),
    });
  } catch (error) {
    return jsonError(500, "share_create_failed", "Failed to create share");
  }
}
