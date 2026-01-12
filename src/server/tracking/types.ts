import "server-only";

export type RequestMeta = {
  request_id: string;
  x_vercel_id: string | null;
  [key: string]: unknown; // Allow additional fields in meta
};

export type TrackEventInput = {
  event_name: string;
  user_id: string | null;
  share_id: string | null;
  client_id: string | null;
  meta: RequestMeta;
};

export type TrackEventResult = {
  ok: true;
  deduped: boolean;
};
