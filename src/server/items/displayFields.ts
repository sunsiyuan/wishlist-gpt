import "server-only";

import { isIP } from "node:net";

const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 300;
const MAX_DOMAIN_LENGTH = 255;
const MAX_PRICE_TEXT_LENGTH = 120;
const MAX_CURRENCY_LENGTH = 10;

export type DisplayHintFields = {
  image_url?: string;
  title?: string;
  merchant_domain?: string;
  price_amount_minor?: number;
  currency?: string;
  price_text?: string;
  category?: string;
  options?: Record<string, string>;
  variant_url?: string;
};

/** Sanitize the agent-provided variant selection: string->string, trimmed, capped. */
export function sanitizeOptions(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [rawKey, rawVal] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawVal !== "string") continue;
    const key = rawKey.trim().slice(0, 40);
    const val = rawVal.trim().slice(0, 80);
    if (key && val) out[key] = val;
    if (Object.keys(out).length >= 8) break;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function extractDisplayHints(body: Record<string, unknown>): DisplayHintFields {
  const displayHints: DisplayHintFields = {};

  const coverUrl = sanitizeDisplayUrl(body.image_url);
  if (coverUrl) {
    displayHints.image_url = coverUrl;
  }

  const title = sanitizeDisplayTitle(body.title);
  if (title) {
    displayHints.title = title;
  }

  const merchantDomain = sanitizeDisplayDomain(body.merchant_domain);
  if (merchantDomain) {
    displayHints.merchant_domain = merchantDomain;
  }

  const category = sanitizeDisplayTitle(body.category);
  if (category) {
    displayHints.category = category;
  }

  const priceAmountMinor = sanitizePriceAmountMinor(body.price_amount_minor);
  if (priceAmountMinor !== null) {
    displayHints.price_amount_minor = priceAmountMinor;
  }

  const currency = sanitizeCurrency(body.currency);
  if (currency) {
    displayHints.currency = currency;
  }

  const priceText = sanitizePriceText(body.price_text);
  if (priceText) {
    displayHints.price_text = priceText;
  }

  const options = sanitizeOptions(body.options);
  if (options) {
    displayHints.options = options;
  }

  const variantUrl = sanitizeDisplayUrl(body.variant_url);
  if (variantUrl) {
    displayHints.variant_url = variantUrl;
  }

  return displayHints;
}

export function deriveDisplayDefaults(params: {
  url: string;
  existing: DisplayHintFields;
}): DisplayHintFields {
  const updates: DisplayHintFields = {};
  if (!params.existing.merchant_domain) {
    const domain = deriveMerchantDomainFromUrl(params.url);
    if (domain) {
      updates.merchant_domain = domain;
    }
  }
  // Merchant logo is no longer stored — it's derived from merchant_domain on read.
  return updates;
}

export function deriveMerchantDomainFromUrl(urlValue: string): string | null {
  try {
    const url = new URL(urlValue);
    if (!isHttpUrl(url)) {
      return null;
    }
    const host = normalizeHostname(url.hostname);
    if (!host || isBlockedHostname(host) || isPrivateIpLiteral(host)) {
      return null;
    }
    return host;
  } catch (error) {
    return null;
  }
}

export function buildFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

export function normalizeHostname(hostname: string): string {
  return hostname.replace(/\.$/, "").replace(/^www\./i, "").toLowerCase();
}

export function sanitizeDisplayUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch (error) {
    return null;
  }
  if (!isHttpUrl(url)) {
    return null;
  }
  if (url.username || url.password) {
    return null;
  }
  const host = normalizeHostname(url.hostname);
  if (!host || isBlockedHostname(host) || isPrivateIpLiteral(host)) {
    return null;
  }
  return url.toString();
}

export function sanitizeDisplayTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TITLE_LENGTH) {
    return null;
  }
  return trimmed;
}

export function sanitizeDisplayDomain(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_DOMAIN_LENGTH) {
    return null;
  }
  if (/[\s/:]/.test(trimmed)) {
    return null;
  }
  if (trimmed.includes("://")) {
    return null;
  }
  const host = normalizeHostname(trimmed);
  if (!host || isBlockedHostname(host) || isPrivateIpLiteral(host)) {
    return null;
  }
  return host;
}

export function sanitizePriceAmountMinor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

export function sanitizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed.length > MAX_CURRENCY_LENGTH) {
    return null;
  }
  if (!/^[A-Z]{3}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function sanitizePriceText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PRICE_TEXT_LENGTH) {
    return null;
  }
  return trimmed;
}

export function isMissingDisplayValue(value: string | number | null): boolean {
  if (value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return false;
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function isBlockedHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

export function isPrivateIpLiteral(hostname: string): boolean {
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    return isPrivateIPv4(hostname);
  }
  if (ipVersion === 6) {
    return isPrivateIPv6(hostname);
  }
  return false;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  const [a, b, c] = parts;
  if (a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 0) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 192 && b === 0 && c === 0) {
    return true;
  }
  if (a === 192 && b === 0 && c === 2) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  if (a === 198 && b === 51 && c === 100) {
    return true;
  }
  if (a === 203 && b === 0 && c === 113) {
    return true;
  }
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.replace("::ffff:", "");
    return isPrivateIPv4(mapped);
  }
  return false;
}
