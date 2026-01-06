import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../server/auth/supabase";
import { isValidShareId } from "../../../../server/shares";
import { getRequestMeta } from "../../../../server/tracking/requestMeta";
import { trackEvent } from "../../../../server/tracking/trackEvent";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { share_id?: string };
  const shareId = body.share_id;

  if (!shareId || !isValidShareId(shareId)) {
    return NextResponse.json({ ok: false, error: "invalid_share_id" }, { status: 400 });
  }

  const viewerId = await getSupabaseUserId(request);
  const meta = getRequestMeta(request.headers);

  try {
    const result = await trackEvent({
      event_name: "web.share.page_view",
      user_id: viewerId,
      share_id: shareId,
      client_id: null,
      meta,
    });
    return NextResponse.json({ ok: true, deduped: result.deduped });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
