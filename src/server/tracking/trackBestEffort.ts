import "server-only";

import { after } from "next/server";
import { TRACKING_TIMEOUT_MS, trackEvent } from "./trackEvent";
import type { TrackEventInput } from "./types";

type TrackingLogContext = {
  event_name: string;
  share_id: string | null;
  request_id: string | null;
};

function getLogContext(params: TrackEventInput): TrackingLogContext {
  return {
    event_name: params.event_name,
    share_id: params.share_id,
    request_id: params.meta?.request_id ?? null,
  };
}

export function trackBestEffort(params: TrackEventInput): void {
  after(async () => {
    try {
      await trackEvent(params, { timeoutMs: TRACKING_TIMEOUT_MS });
    } catch (error) {
      const context = getLogContext(params);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.warn("Tracking failed", {
        ...context,
        error_name: errorName,
        error_message: errorMessage,
      });
    }
  });
}
