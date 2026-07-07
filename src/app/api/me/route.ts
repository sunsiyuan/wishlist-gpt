import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../server/auth/supabase";

// Web-only endpoint: authenticated by the Supabase session cookie. (The MCP surface authenticates
// via its own OAuth bearer verifier in src/server/mcp/auth.ts, not this route.)
export async function GET(request: NextRequest) {
  const supabaseUserId = await getSupabaseUserId(request);
  if (!supabaseUserId) {
    return NextResponse.json({ error: "missing session" }, { status: 401 });
  }
  return NextResponse.json({ user_id: supabaseUserId, client_id: "supabase" });
}
