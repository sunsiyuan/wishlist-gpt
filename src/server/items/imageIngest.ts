import "server-only";

import { after } from "next/server";
import { supabaseAdminFetch } from "../supabase/admin";
import { isPrivateIpLiteral, normalizeHostname } from "./displayFields";
import { updateItemDisplayFields } from "./store";

const BUCKET = "item-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 5000;
const IMAGE_USER_AGENT =
  "Mozilla/5.0 (compatible; WishlistGPT/1.0; +https://wishlist-gpt.vercel.app)";

// content-type -> file extension for the formats we accept.
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function supabaseBaseUrl(): string {
  return (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
}

function publicImageUrl(objectPath: string): string {
  return `${supabaseBaseUrl()}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

function isAlreadyRehosted(imageUrl: string): boolean {
  const base = supabaseBaseUrl();
  return !!base && imageUrl.startsWith(`${base}/storage/v1/object/public/${BUCKET}/`);
}

/**
 * Validate an agent-provided image URL before we fetch it server-side (SSRF guard):
 * https only, and never a private/loopback/internal host.
 */
function toSafeRemoteUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") {
    return null;
  }
  const host = normalizeHostname(url.hostname);
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return null;
  }
  if (isPrivateIpLiteral(host)) {
    return null;
  }
  return url;
}

/**
 * Best-effort: fetch the agent-provided cover image once and re-host it to durable
 * storage so the wishlist doesn't depend on expiring/hotlink-protected merchant URLs.
 * Runs after the response; failures are swallowed and the original URL is kept.
 */
export function rehostItemImageBestEffort(params: {
  userId: string;
  itemId: string;
  imageUrl: string;
}): void {
  after(async () => {
    try {
      await rehostItemImage(params);
    } catch (error) {
      console.warn("[image] rehost failed", {
        item_id: params.itemId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

async function rehostItemImage(params: {
  userId: string;
  itemId: string;
  imageUrl: string;
}): Promise<void> {
  const { userId, itemId, imageUrl } = params;
  if (!supabaseBaseUrl() || isAlreadyRehosted(imageUrl)) {
    return;
  }
  const safeUrl = toSafeRemoteUrl(imageUrl);
  if (!safeUrl) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(safeUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": IMAGE_USER_AGENT, accept: "image/*" },
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    return;
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) {
    return;
  }
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength && declaredLength > MAX_IMAGE_BYTES) {
    return;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return;
  }

  const objectPath = `${userId}/${itemId}.${ext}`;
  const upload = await supabaseAdminFetch(`/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-upsert": "true",
      "cache-control": "max-age=31536000",
    },
    body: bytes,
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  if (!upload.ok) {
    console.warn("[image] storage upload failed", { item_id: itemId, status: upload.status });
    return;
  }

  await updateItemDisplayFields({
    userId,
    itemId,
    updates: { display_cover_image_url: publicImageUrl(objectPath) },
  });
}
