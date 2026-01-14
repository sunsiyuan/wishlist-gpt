"use server-only";

/**
 * Tracking parameter configuration for URL cleaning.
 * Removes mainstream ad platform tracking params, but keeps affiliate/ref/coupon params.
 */
export const TRACKING_PARAM_CONFIG = {
  prefixes: ["utm_", "mkt_", "ga_", "icid"],
  exact: [
    // Google
    "gclid",
    "dclid",
    "wbraid",
    "gbraid",
    "gclsrc",
    "gad_source",
    "srsltid",
    // Meta
    "fbclid",
    // Microsoft
    "msclkid",
    // TikTok
    "ttclid",
    // X (Twitter)
    "twclid",
    // LinkedIn
    "li_fat_id",
    // Snap
    "scclid",
    // Pinterest
    "epik",
    // Taboola
    "tblci",
    // Outbrain
    "ob_click_id",
    "obclickid",
    // Yandex
    "yclid",
    // Instagram
    "igshid",
    // Mailchimp
    "mc_cid",
    "mc_eid",
  ],
  keep: [] as string[],
  maxParams: 64,
} as const;

export type TrackingParamConfig = typeof TRACKING_PARAM_CONFIG;

/**
 * Sanitizes a URL by removing tracking parameters and handling fragments.
 *
 * Rules:
 * - All schemes: remove tracking query params
 * - http/https: drop fragment (#...)
 * - non-http(s): keep fragment (safer for app routing)
 * - intent://: keep fragment (explicit)
 * - maxParams: if query params exceed limit, keep first 64 (deterministic)
 *
 * @param input - URL string to sanitize
 * @param config - Tracking parameter configuration (defaults to TRACKING_PARAM_CONFIG)
 * @returns Sanitized URL string, or null if parsing fails
 */
export function sanitizeSourceUrl(
  input: string,
  config: TrackingParamConfig = TRACKING_PARAM_CONFIG,
): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    // Try parsing as-is first
    url = new URL(trimmed);
  } catch {
    // If that fails, try with a dummy base URL for relative URLs
    try {
      url = new URL(trimmed, "https://example.com");
    } catch {
      return null;
    }
  }

  const scheme = url.protocol.toLowerCase();
  const isHttp = scheme === "http:" || scheme === "https:";
  const isIntent = scheme === "intent:";

  // Remove tracking query parameters
  const searchParams = url.searchParams;
  const keysToRemove: string[] = [];

  // Check each query parameter
  for (const [key, value] of searchParams.entries()) {
    const keyLower = key.toLowerCase();

    // Check exact matches
    if (config.exact.includes(keyLower)) {
      keysToRemove.push(key);
      continue;
    }

    // Check prefix matches
    for (const prefix of config.prefixes) {
      if (keyLower.startsWith(prefix)) {
        keysToRemove.push(key);
        break;
      }
    }

    // Check keep list (escape hatch)
    if (config.keep.includes(keyLower)) {
      // Don't remove
      continue;
    }
  }

  // Remove tracking params
  for (const key of keysToRemove) {
    searchParams.delete(key);
  }

  // Handle maxParams limit: if params exceed limit, keep first 64 (deterministic)
  // Note: URLSearchParams maintains insertion order, so we can iterate and keep first N
  if (searchParams.size > config.maxParams) {
    const entries: [string, string][] = [];
    let count = 0;
    for (const [key, value] of searchParams.entries()) {
      if (count < config.maxParams) {
        entries.push([key, value]);
        count++;
      }
    }
    // Clear and rebuild with limited params
    url.search = "";
    for (const [key, value] of entries) {
      url.searchParams.set(key, value);
    }
  }

  // Handle fragment based on scheme
  if (isHttp) {
    // http/https: drop fragment
    url.hash = "";
  } else if (isIntent) {
    // intent://: keep fragment (explicit)
    // No change needed
  } else {
    // non-http(s): keep fragment (safer for app routing)
    // No change needed
  }

  return url.toString();
}
