import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../../server/auth/supabase";
import { revokeShareForUser } from "../../../../../server/shares";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("authorization")) {
    return NextResponse.json({ ok: false, error: "bearer_not_allowed" }, { status: 401 });
  }

  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  try {
    const { id } = await params;
    const revoked = await revokeShareForUser(id, userId);
    if (!revoked) {
      return jsonError(404, "not_found", "Share not found");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(500, "share_revoke_failed", "Failed to revoke share");
  }
}
