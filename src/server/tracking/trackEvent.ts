import "server-only";

import { supabaseAdminFetch } from "../supabase/admin";
import type { RequestMeta, TrackEventInput, TrackEventResult } from "./types";

function buildEventMeta(meta: RequestMeta): RequestMeta {
  return {
    request_id: meta.request_id || crypto.randomUUID(),
    x_vercel_id: meta.x_vercel_id ?? null,
  };
}

export async function trackEvent(params: TrackEventInput): Promise<TrackEventResult> {
  const meta = buildEventMeta(params.meta);
  const response = await supabaseAdminFetch("/rest/v1/events", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      event_name: params.event_name,
      occurred_at: new Date().toISOString(),
      user_id: params.user_id,
      share_id: params.share_id,
      client_id: params.client_id,
      meta,
    }),
  });

  if (response.ok) {
    return { ok: true, deduped: false };
  }

  let errorBody: { code?: string } | null = null;
  try {
    errorBody = (await response.json()) as { code?: string };
  } catch {
    errorBody = null;
  }

  if (errorBody?.code === "23505") {
    return { ok: true, deduped: true };
  }

  throw new Error(`Failed to track event: ${response.status}`);
}
