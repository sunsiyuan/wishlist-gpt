import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../../server/auth/supabase";
import { revokeShareForUser } from "../../../../../server/shares";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  try {
    const revoked = await revokeShareForUser(params.id, userId);
    if (!revoked) {
      return jsonError(404, "not_found", "Share not found");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(500, "share_revoke_failed", "Failed to revoke share");
  }
}
