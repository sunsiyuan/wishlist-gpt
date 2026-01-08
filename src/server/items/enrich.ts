import "server-only";

import { after } from "next/server";
import type { DisplayFieldUpdate, ItemRecord } from "./store";
import { getItemForUser, updateItemDisplayFields } from "./store";
import {
  buildFaviconUrl,
  deriveMerchantDomainFromUrl,
  isMissingDisplayValue,
  sanitizeCurrency,
  sanitizeDisplayTitle,
  sanitizeDisplayUrl,
  sanitizePriceAmountMinor,
  sanitizePriceText,
} from "./displayFields";

const FETCH_TIMEOUT_MS = 1500;
const REDIRECT_LIMIT = 3;
const MAX_RESPONSE_BYTES = 1_000_000;

export function enrichItemBestEffort(params: {
  userId: string;
  itemId: string;
  url: string;
}): void {
  after(async () => {
    try {
      await enrichItem(params);
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.warn("Item enrichment failed", {
        item_id: params.itemId,
        error_name: errorName,
        error_message: errorMessage,
      });
    }
  });
}

async function enrichItem(params: {
  userId: string;
  itemId: string;
  url: string;
}): Promise<void> {
  const item = await getItemForUser({ userId: params.userId, itemId: params.itemId });
  if (!item) {
    return;
  }

  const response = await fetchHtmlWithRedirects(params.url);
  if (!response) {
    return;
  }

  const extracted = extractDisplayMetadata(response.html, response.finalUrl);
  if (Object.keys(extracted).length === 0) {
    return;
  }

  const updates = buildFillOnlyUpdates(item, extracted, response.finalUrl);
  if (Object.keys(updates).length === 0) {
    return;
  }

  await updateItemDisplayFields({
    userId: params.userId,
    itemId: params.itemId,
    updates,
  });
}

type FetchResult = {
  finalUrl: string;
  html: string;
};

async function fetchHtmlWithRedirects(urlValue: string): Promise<FetchResult | null> {
  let currentUrl = urlValue;
  for (let redirectCount = 0; redirectCount <= REDIRECT_LIMIT; redirectCount += 1) {
    const url = safeParseUrl(currentUrl);
    if (!url) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "WishlistGPT/0.4",
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      return null;
    }
    clearTimeout(timeoutId);

    if (isRedirectResponse(response)) {
      const location = response.headers.get("location");
      if (!location) {
        return null;
      }
      if (redirectCount >= REDIRECT_LIMIT) {
        return null;
      }
      const nextUrl = new URL(location, url);
      currentUrl = nextUrl.toString();
      continue;
    }

    if (!response.ok) {
      return null;
    }

    const html = await readResponseText(response);
    if (!html) {
      return null;
    }

    return { finalUrl: url.toString(), html };
  }
  return null;
}

function isRedirectResponse(response: Response): boolean {
  return [301, 302, 303, 307, 308].includes(response.status);
}

function safeParseUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (sanitizeDisplayUrl(url.toString()) === null) {
    return null;
  }
  return url;
}

async function readResponseText(response: Response): Promise<string | null> {
  if (!response.body) {
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      return null;
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      received += value.length;
      if (received > MAX_RESPONSE_BYTES) {
        return null;
      }
      chunks.push(value);
    }
  }

  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return buffer.toString("utf-8");
}

type ExtractedMetadata = {
  display_cover_image_url?: string;
  display_product_title?: string;
  display_price_amount_minor?: number;
  display_currency?: string;
  display_price_text?: string;
  display_merchant_domain?: string;
  display_merchant_logo_url?: string;
};

function extractDisplayMetadata(html: string, finalUrl: string): ExtractedMetadata {
  const metadata = parseMetaTags(html);
  const jsonLd = parseJsonLd(html);

  const ogTitle = sanitizeDisplayTitle(metadata["og:title"] ?? metadata["twitter:title"]);
  const jsonLdTitle = sanitizeDisplayTitle(jsonLd?.name ?? undefined);
  const titleTag = sanitizeDisplayTitle(extractTitleTag(html));
  const displayTitle = ogTitle ?? jsonLdTitle ?? titleTag ?? undefined;

  const ogImage = metadata["og:image"] ?? metadata["twitter:image"];
  const jsonLdImage = jsonLd?.image ?? undefined;
  const displayImage = resolveImageUrl(ogImage ?? jsonLdImage ?? undefined, finalUrl);

  const priceAmountMinor = sanitizePriceAmountMinor(jsonLd?.priceAmountMinor ?? null);
  const priceCurrency = sanitizeCurrency(jsonLd?.priceCurrency ?? null);
  const priceText = sanitizePriceText(jsonLd?.priceText ?? null);

  const domain = deriveMerchantDomainFromUrl(finalUrl) ?? undefined;

  const updates: ExtractedMetadata = {};
  if (displayTitle) {
    updates.display_product_title = displayTitle;
  }
  if (displayImage) {
    updates.display_cover_image_url = displayImage;
  }
  if (priceAmountMinor !== null) {
    updates.display_price_amount_minor = priceAmountMinor;
  }
  if (priceCurrency) {
    updates.display_currency = priceCurrency;
  }
  if (priceText) {
    updates.display_price_text = priceText;
  }
  if (domain) {
    updates.display_merchant_domain = domain;
    updates.display_merchant_logo_url = buildFaviconUrl(domain);
  }
  return updates;
}

function resolveImageUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) {
    return null;
  }
  let resolved: string;
  try {
    resolved = new URL(value, baseUrl).toString();
  } catch (error) {
    return null;
  }
  return sanitizeDisplayUrl(resolved);
}

function parseMetaTags(html: string): Record<string, string> {
  const metaRegex = /<meta\s+[^>]*>/gi;
  const attrRegex = /([^\s=]+)\s*=\s*(["'])(.*?)\2/g;
  const results: Record<string, string> = {};
  let match: RegExpExecArray | null;

  while ((match = metaRegex.exec(html))) {
    const tag = match[0];
    const attrs: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(tag))) {
      attrs[attrMatch[1].toLowerCase()] = attrMatch[3];
    }
    const key = attrs.property ?? attrs.name;
    if (!key) {
      continue;
    }
    const content = attrs.content;
    if (!content) {
      continue;
    }
    results[key.toLowerCase()] = content;
  }

  return results;
}

function extractTitleTag(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) {
    return null;
  }
  return match[1].replace(/\s+/g, " ").trim();
}

type JsonLdProduct = {
  name?: string | null;
  image?: string | null;
  priceAmountMinor?: number | null;
  priceCurrency?: string | null;
  priceText?: string | null;
};

function parseJsonLd(html: string): JsonLdProduct | null {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html))) {
    const raw = match[1].trim();
    if (!raw) {
      continue;
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      continue;
    }
    const product = findProductInJsonLd(data);
    if (product) {
      return product;
    }
  }
  return null;
}

function findProductInJsonLd(data: unknown): JsonLdProduct | null {
  const nodes = collectJsonLdNodes(data);
  for (const node of nodes) {
    const typeValue = node["@type"];
    const types = Array.isArray(typeValue) ? typeValue : [typeValue];
    if (!types.filter(Boolean).some((type) => String(type).toLowerCase() === "product")) {
      continue;
    }
    const name = typeof node.name === "string" ? node.name : null;
    const image = extractJsonLdImage(node.image);
    const offers = node.offers;
    const offerNode = Array.isArray(offers) ? offers[0] : offers;
    const price = extractJsonLdPrice(offerNode);

    return {
      name,
      image,
      priceAmountMinor: price.amountMinor,
      priceCurrency: price.currency,
      priceText: price.text,
    };
  }
  return null;
}

function collectJsonLdNodes(data: unknown): Record<string, unknown>[] {
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data.flatMap((entry) => collectJsonLdNodes(entry));
  }
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    const graph = record["@graph"];
    if (Array.isArray(graph)) {
      return graph.flatMap((entry) => collectJsonLdNodes(entry));
    }
    return [record];
  }
  return [];
}

function extractJsonLdImage(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string");
    return typeof first === "string" ? first : null;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === "string") {
      return obj.url;
    }
  }
  return null;
}

type ExtractedPrice = {
  amountMinor: number | null;
  currency: string | null;
  text: string | null;
};

function extractJsonLdPrice(value: unknown): ExtractedPrice {
  if (!value || typeof value !== "object") {
    return { amountMinor: null, currency: null, text: null };
  }
  const record = value as Record<string, unknown>;
  const priceValue = record.price ?? record.lowPrice ?? record.highPrice ?? null;
  const currencyValue = record.priceCurrency ?? null;
  const priceSpecification = record.priceSpecification;
  let priceText: string | null = null;
  let amountMinor: number | null = null;

  if (typeof priceValue === "number") {
    amountMinor = Math.round(priceValue * 100);
  } else if (typeof priceValue === "string") {
    const parsed = Number(priceValue.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed)) {
      amountMinor = Math.round(parsed * 100);
    } else {
      priceText = priceValue;
    }
  }

  if (priceSpecification && typeof priceSpecification === "object") {
    const spec = priceSpecification as Record<string, unknown>;
    const specPrice = spec.price ?? null;
    if (amountMinor === null && typeof specPrice === "number") {
      amountMinor = Math.round(specPrice * 100);
    }
  }

  if (!priceText && typeof priceValue === "string") {
    priceText = priceValue;
  }

  return {
    amountMinor,
    currency: typeof currencyValue === "string" ? currencyValue : null,
    text: priceText,
  };
}

function buildFillOnlyUpdates(
  item: ItemRecord,
  extracted: ExtractedMetadata,
  finalUrl: string,
): DisplayFieldUpdate {
  const updates: DisplayFieldUpdate = {};

  if (isMissingDisplayValue(item.display_product_title) && extracted.display_product_title) {
    updates.display_product_title = extracted.display_product_title;
  }
  if (isMissingDisplayValue(item.display_cover_image_url) && extracted.display_cover_image_url) {
    updates.display_cover_image_url = extracted.display_cover_image_url;
  }
  if (isMissingDisplayValue(item.display_merchant_domain)) {
    const domain = extracted.display_merchant_domain ?? deriveMerchantDomainFromUrl(finalUrl);
    if (domain) {
      updates.display_merchant_domain = domain;
    }
  }
  if (isMissingDisplayValue(item.display_merchant_logo_url)) {
    const domain =
      extracted.display_merchant_domain ?? updates.display_merchant_domain ?? item.display_merchant_domain;
    if (domain) {
      updates.display_merchant_logo_url = buildFaviconUrl(domain);
    }
  }

  const shouldSetPriceAmount =
    item.display_price_amount_minor === null &&
    extracted.display_price_amount_minor !== undefined;
  if (shouldSetPriceAmount) {
    updates.display_price_amount_minor = extracted.display_price_amount_minor ?? null;
  }
  if (isMissingDisplayValue(item.display_currency) && extracted.display_currency) {
    updates.display_currency = extracted.display_currency;
  }
  if (isMissingDisplayValue(item.display_price_text) && extracted.display_price_text) {
    updates.display_price_text = extracted.display_price_text;
  }

  const hasPriceUpdate =
    updates.display_price_amount_minor !== undefined ||
    updates.display_currency !== undefined ||
    updates.display_price_text !== undefined;
  if (hasPriceUpdate) {
    updates.display_price_updated_at = new Date().toISOString();
  }

  return updates;
}
