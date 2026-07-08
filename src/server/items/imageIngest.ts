import "server-only";

import { supabaseAdminFetch } from "../supabase/admin";
import { isPrivateIpLiteral, normalizeHostname } from "./displayFields";

const BUCKET = "item-images";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB — high-res product PDP images run large
const FETCH_TIMEOUT_MS = 5000;
// A realistic browser UA — many sites 403 unknown bots but serve pages/images to browsers.
const IMAGE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

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
  // Cache-bust so a re-add (same object path, upsert) shows the new image immediately.
  return `${supabaseBaseUrl()}/storage/v1/object/public/${BUCKET}/${objectPath}?v=${Date.now()}`;
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
 * Fetch the agent-provided cover image once and re-host it to durable storage so the wishlist
 * doesn't depend on expiring/hotlink-protected merchant URLs (and so the widget only ever loads
 * images from our own domain — CSP-safe).
 *
 * Runs synchronously as part of add-item so the returned item already carries the stable URL.
 * Returns the new public URL on success, or null to signal "keep the current image_url"
 * (already re-hosted, unsafe/unreachable source, wrong type, too large, or upload failed).
 */
export async function rehostItemImage(params: {
  userId: string;
  itemId: string;
  imageUrl: string;
}): Promise<string | null> {
  const { userId, itemId, imageUrl } = params;
  if (!supabaseBaseUrl() || isAlreadyRehosted(imageUrl)) {
    return null;
  }
  const safeUrl = toSafeRemoteUrl(imageUrl);
  if (!safeUrl) {
    return null;
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
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    return null;
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) {
    return null;
  }
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength && declaredLength > MAX_IMAGE_BYTES) {
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return null;
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
    return null;
  }

  return publicImageUrl(objectPath);
}

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB — og tags live in <head>, near the top

/**
 * Extract the first usable social-preview image from a page's HTML:
 * og:image (or its secure_url/url variants), then twitter:image, then link rel=image_src.
 */
function extractOgImage(html: string): string | null {
  const patterns: RegExp[] = [
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["']/i,
    /<meta[^>]+(?:name|property)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Fallback used only when the calling agent didn't supply an image: fetch the product page
 * (SSRF-guarded), pull its Open Graph / Twitter card image, and return an absolute URL.
 * Best-effort — returns null on any failure. The returned URL is then re-hosted like any other.
 */
export async function fetchOgImageUrl(pageUrl: string): Promise<string | null> {
  const safeUrl = toSafeRemoteUrl(pageUrl);
  if (!safeUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const response = await fetch(safeUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": IMAGE_USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });
    if (!response.ok) {
      return null;
    }
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("html")) {
      return null;
    }
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength && declaredLength > MAX_HTML_BYTES * 4) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    html = buffer.subarray(0, MAX_HTML_BYTES).toString("utf8");
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  const candidate = extractOgImage(html);
  if (!candidate) {
    return null;
  }
  try {
    // Resolve protocol-relative / relative image URLs against the page, and upgrade http -> https
    // (og:image is often declared http even though the CDN serves https, and re-hosting is https-only).
    const resolved = new URL(candidate, safeUrl);
    if (resolved.protocol === "http:") {
      resolved.protocol = "https:";
    }
    return resolved.toString();
  } catch {
    return null;
  }
}
