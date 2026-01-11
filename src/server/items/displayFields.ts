import "server-only";

import { isIP } from "node:net";

const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 300;
const MAX_DOMAIN_LENGTH = 255;
const MAX_PRICE_TEXT_LENGTH = 120;
const MAX_CURRENCY_LENGTH = 10;

export type DisplayHintFields = {
  display_cover_image_url?: string;
  display_product_title?: string;
  display_merchant_logo_url?: string;
  display_merchant_domain?: string;
  display_price_amount_minor?: number;
  display_currency?: string;
  display_price_text?: string;
};

export function extractDisplayHints(body: Record<string, unknown>): DisplayHintFields {
  const displayHints: DisplayHintFields = {};

  const coverUrl = sanitizeDisplayUrl(body.display_cover_image_url);
  if (coverUrl) {
    displayHints.display_cover_image_url = coverUrl;
  }

  const title = sanitizeDisplayTitle(body.display_product_title);
  if (title) {
    displayHints.display_product_title = title;
  }

  const merchantLogoUrl = sanitizeDisplayUrl(body.display_merchant_logo_url);
  if (merchantLogoUrl) {
    displayHints.display_merchant_logo_url = merchantLogoUrl;
  }

  const merchantDomain = sanitizeDisplayDomain(body.display_merchant_domain);
  if (merchantDomain) {
    displayHints.display_merchant_domain = merchantDomain;
  }

  const priceAmountMinor = sanitizePriceAmountMinor(body.display_price_amount_minor);
  if (priceAmountMinor !== null) {
    displayHints.display_price_amount_minor = priceAmountMinor;
  }

  const currency = sanitizeCurrency(body.display_currency);
  if (currency) {
    displayHints.display_currency = currency;
  }

  const priceText = sanitizePriceText(body.display_price_text);
  if (priceText) {
    displayHints.display_price_text = priceText;
  }

  return displayHints;
}

export function deriveDisplayDefaults(params: {
  url: string;
  existing: DisplayHintFields;
}): DisplayHintFields {
  const updates: DisplayHintFields = {};
  if (!params.existing.display_merchant_domain) {
    const domain = deriveMerchantDomainFromUrl(params.url);
    if (domain) {
      updates.display_merchant_domain = domain;
    }
  }

  const domainForLogo =
    params.existing.display_merchant_domain ?? updates.display_merchant_domain ?? null;
  if (!params.existing.display_merchant_logo_url && domainForLogo) {
    updates.display_merchant_logo_url = buildFaviconUrl(domainForLogo);
  }

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
