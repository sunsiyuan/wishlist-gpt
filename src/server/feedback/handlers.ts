import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getRequestMeta } from "../tracking/requestMeta";
import { sendTelegramFeedback } from "./notify";
import { checkRateLimit, createFeedback } from "./store";

const MAX_MESSAGE_LENGTH = 1000;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

function parseContext(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export async function handleFeedbackRequest(params: {
  request: NextRequest;
  userId: string;
}): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await params.request.json();
  } catch (error) {
    return jsonError(400, "invalid_json");
  }

  if (!body || typeof body !== "object") {
    return jsonError(400, "invalid_body");
  }

  const messageValue = (body as { message?: unknown }).message;
  if (typeof messageValue !== "string") {
    return jsonError(400, "invalid_message");
  }

  const message = messageValue.trim();
  if (!message) {
    return jsonError(400, "invalid_message");
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonError(400, "message_too_long");
  }

  const context = parseContext((body as { context?: unknown }).context);

  const allowed = await checkRateLimit({
    userId: params.userId,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!allowed) {
    return jsonError(429, "rate_limited");
  }

  const requestMeta = getRequestMeta(params.request.headers);
  const meta: Record<string, unknown> = {
    request_id: requestMeta.request_id,
    x_vercel_id: requestMeta.x_vercel_id,
    ua: params.request.headers.get("user-agent"),
  };

  if (context) {
    meta.context = context;
  }

  const result = await createFeedback({
    userId: params.userId,
    message,
    meta,
  });

  after(async () => {
    try {
      await sendTelegramFeedback({
        feedbackId: result.id,
        userId: params.userId,
        message,
        context,
      });
    } catch (error) {
      // Best-effort only.
    }
  });

  return NextResponse.json({ ok: true });
}
