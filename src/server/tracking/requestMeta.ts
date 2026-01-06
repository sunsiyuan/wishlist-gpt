import "server-only";

import type { RequestMeta } from "./types";

type HeaderGetter = {
  get(name: string): string | null;
};

export function getRequestMeta(headers: HeaderGetter): RequestMeta {
  const requestId = crypto.randomUUID();
  const xVercelId = headers.get("x-vercel-id");
  return {
    request_id: requestId,
    x_vercel_id: xVercelId ?? null,
  };
}
