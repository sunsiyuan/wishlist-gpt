import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import { handleFeedbackRequest } from "../../../server/feedback/handlers";

export async function POST(request: NextRequest) {
  const supabaseUserId = await getSupabaseUserId(request);
  if (!supabaseUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return handleFeedbackRequest({ request, userId: supabaseUserId });
}
