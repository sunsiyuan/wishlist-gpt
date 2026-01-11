import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyAccessToken } from "../../../server/auth/bearer";
import { getSupabaseUserId } from "../../../server/auth/supabase";

export async function GET(request: NextRequest) {
  const supabaseUserId = await getSupabaseUserId(request);
  if (supabaseUserId) {
    return NextResponse.json({
      user_id: supabaseUserId,
      client_id: "supabase",
    });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "missing session or bearer token" }, { status: 401 });
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
