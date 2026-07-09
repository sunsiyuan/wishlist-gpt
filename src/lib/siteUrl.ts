/**
 * Canonical, absolute origin for this deployment (no trailing slash).
 *
 * `||`, not `??`: BASE_URL is set-but-empty in some environments, and an empty SITE_URL
 * makes `new URL(...)` throw at build time.
 */
export function getSiteUrl(): string {
  return process.env.BASE_URL?.replace(/\/+$/, "") || "https://wishlistgpt.com";
}
