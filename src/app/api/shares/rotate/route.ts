import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../server/auth/supabase";
import { rotateShareForUser } from "../../../../server/shares";

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
    const share = await rotateShareForUser(userId, request.nextUrl.origin);
    return NextResponse.json(share);
  } catch (error) {
    return jsonError(500, "share_rotate_failed", "Failed to rotate share");
  }
}
