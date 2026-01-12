import "server-only";

export type RequestMeta = {
  request_id: string;
  x_vercel_id: string | null;
  [key: string]: unknown; // Allow additional fields in meta
};

export type TrackEventResult = {
  ok: true;
  deduped: boolean;
};
