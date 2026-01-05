import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import { createOrReuseShare } from "../../../server/shares";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  try {
    const share = await createOrReuseShare(userId);
    const origin = request.nextUrl.origin;
    return NextResponse.json({
      share_id: share.id,
      share_url: `${origin}/s/${share.id}`,
    });
  } catch (error) {
    return jsonError(500, "share_create_failed", "Failed to create share");
  }
}
