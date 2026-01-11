import "server-only";

import { supabaseAdminFetch } from "../supabase/admin";

export type FeedbackRecord = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  meta: Record<string, unknown>;
};

export async function createFeedback(params: {
  userId: string;
  message: string;
  meta: Record<string, unknown>;
}): Promise<{ id: string }> {
  const response = await supabaseAdminFetch("/rest/v1/feedback", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: params.userId,
      message: params.message,
      meta: params.meta,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create feedback: ${response.status}`);
  }

  const data = (await response.json()) as FeedbackRecord[];
  if (!data[0]) {
    throw new Error("No feedback returned");
  }

  return { id: data[0].id };
}

export async function checkRateLimit(params: {
  userId: string;
  windowSeconds: number;
}): Promise<boolean> {
  const search = new URLSearchParams({
    user_id: `eq.${params.userId}`,
    select: "created_at",
    order: "created_at.desc",
    limit: "1",
  });

  const response = await supabaseAdminFetch(`/rest/v1/feedback?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to check feedback rate limit: ${response.status}`);
  }

  const data = (await response.json()) as Array<{ created_at?: string }>;
  const latest = data[0]?.created_at;
  if (!latest) {
    return true;
  }

  const latestTime = Date.parse(latest);
  if (Number.isNaN(latestTime)) {
    return true;
  }

  return Date.now() - latestTime >= params.windowSeconds * 1000;
}
