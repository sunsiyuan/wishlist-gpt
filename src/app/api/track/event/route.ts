import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../server/auth/supabase";
import { getRequestMeta } from "../../../../server/tracking/requestMeta";
import { trackBestEffort } from "../../../../server/tracking/trackBestEffort";

export async function POST(request: NextRequest) {
  let body: { event_name?: string; meta?: Record<string, unknown> } = {};
  try {
    body = (await request.json()) as { event_name?: string; meta?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const eventName = body.event_name;
  if (!eventName || typeof eventName !== "string") {
    return NextResponse.json({ ok: false, error: "event_name is required" }, { status: 400 });
  }

  const userId = await getSupabaseUserId(request);
  const requestMeta = getRequestMeta(request.headers);

  // Merge client-provided meta with server request meta
  // Client provides request_id in meta, server provides x_vercel_id
  // Other client fields (context, surface, intent, item_id, source_url) are preserved
  const clientMeta = body.meta ?? {};
  const finalMeta: Record<string, unknown> = {
    ...clientMeta,
    request_id: (clientMeta.request_id as string) ?? requestMeta.request_id,
    x_vercel_id: requestMeta.x_vercel_id,
  };

  // trackBestEffort expects RequestMeta, but database stores full meta as jsonb
  // We cast to RequestMeta for type compatibility, but the actual stored meta includes all fields
  trackBestEffort({
    event_name: eventName,
    user_id: userId,
    share_id: null,
    client_id: null,
    meta: finalMeta as typeof requestMeta,
  });

  return new NextResponse(null, { status: 204 });
}
