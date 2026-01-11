import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../server/auth/supabase";
import { isValidShareId } from "../../../../server/shares";
import { getRequestMeta } from "../../../../server/tracking/requestMeta";
import { trackBestEffort } from "../../../../server/tracking/trackBestEffort";

export async function POST(request: NextRequest) {
  let body: { share_id?: string } = {};
  try {
    body = (await request.json()) as { share_id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const shareId = body.share_id;

  if (!shareId || !isValidShareId(shareId)) {
    return NextResponse.json({ ok: false, error: "invalid_share_id" }, { status: 400 });
  }

  const viewerId = await getSupabaseUserId(request);
  const meta = getRequestMeta(request.headers);

  trackBestEffort({
    event_name: "web.share.page_view",
    user_id: viewerId,
    share_id: shareId,
    client_id: null,
    meta,
  });

  return new NextResponse(null, { status: 204 });
}
