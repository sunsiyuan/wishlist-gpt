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

const ENRICH_DEBUG = process.env.ENRICH_DEBUG === "1";
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.ENRICH_FETCH_TIMEOUT_MS ?? "4000", 10);
const REDIRECT_LIMIT = 3;
const MAX_RESPONSE_BYTES = 1_000_000;

export function enrichItemBestEffort(params: {
  userId: string;
  itemId: string;
  url: string;
}): void {
  if (ENRICH_DEBUG) {
    console.log("[enrich] scheduled", {
      item_id: params.itemId,
      has_after: true,
    });
  }
  after(async () => {
    if (ENRICH_DEBUG) {
      console.log("[enrich] after_start", {
        item_id: params.itemId,
        step: "after_start",
      });
    }
    try {
      await enrichItem(params);
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.warn("[enrich] enrichment failed", {
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
    if (ENRICH_DEBUG) {
      console.log("[enrich] return_item_not_found", {
        item_id: params.itemId,
        step: "return_item_not_found",
      });
    }
    return;
  }

  const fetchResult = await fetchHtmlWithRedirects(params.url);
  if (!fetchResult || !fetchResult.html) {
    if (ENRICH_DEBUG) {
      console.log("[enrich] return_fetch_failed", {
        item_id: params.itemId,
        step: "return_fetch_failed",
        status: fetchResult?.status ?? null,
        final_url: fetchResult?.finalUrl ?? null,
        redirect_count: fetchResult?.redirectCount ?? null,
        timed_out: fetchResult?.timedOut ?? null,
      });
    }
    return;
  }

  const extracted = extractDisplayMetadata(fetchResult.html, fetchResult.finalUrl);
  if (Object.keys(extracted).length === 0) {
    if (ENRICH_DEBUG) {
      console.log("[enrich] return_extracted_empty", {
        item_id: params.itemId,
        step: "return_extracted_empty",
      });
    }
    return;
  }

  const updates = buildFillOnlyUpdates(item, extracted, fetchResult.finalUrl);
  if (Object.keys(updates).length === 0) {
    if (ENRICH_DEBUG) {
      const missingFields: string[] = [];
      const extractedFields: string[] = [];
      if (isMissingDisplayValue(item.display_product_title) && extracted.display_product_title) {
        missingFields.push("display_product_title");
      }
      if (isMissingDisplayValue(item.display_cover_image_url) && extracted.display_cover_image_url) {
        missingFields.push("display_cover_image_url");
      }
      if (isMissingDisplayValue(item.display_merchant_domain) && extracted.display_merchant_domain) {
        missingFields.push("display_merchant_domain");
      }
      if (isMissingDisplayValue(item.display_merchant_logo_url) && extracted.display_merchant_logo_url) {
        missingFields.push("display_merchant_logo_url");
      }
      if (item.display_price_amount_minor === null && extracted.display_price_amount_minor !== undefined) {
        missingFields.push("display_price_amount_minor");
      }
      if (isMissingDisplayValue(item.display_currency) && extracted.display_currency) {
        missingFields.push("display_currency");
      }
      if (isMissingDisplayValue(item.display_price_text) && extracted.display_price_text) {
        missingFields.push("display_price_text");
      }
      if (extracted.display_product_title) extractedFields.push("display_product_title");
      if (extracted.display_cover_image_url) extractedFields.push("display_cover_image_url");
      if (extracted.display_merchant_domain) extractedFields.push("display_merchant_domain");
      if (extracted.display_merchant_logo_url) extractedFields.push("display_merchant_logo_url");
      if (extracted.display_price_amount_minor !== undefined) extractedFields.push("display_price_amount_minor");
      if (extracted.display_currency) extractedFields.push("display_currency");
      if (extracted.display_price_text) extractedFields.push("display_price_text");

      console.log("[enrich] return_updates_empty", {
        item_id: params.itemId,
        step: "return_updates_empty",
        missing_fields: missingFields,
        extracted_fields: extractedFields,
      });
    }
    return;
  }

  await updateItemDisplayFields({
    userId: params.userId,
    itemId: params.itemId,
    updates,
  });

  if (ENRICH_DEBUG) {
    console.log("[enrich] updated", {
      item_id: params.itemId,
      step: "updated",
      keys: Object.keys(updates),
    });
  }
}

export type FetchResult = {
  finalUrl: string;
  html: string;
  status?: number;
  redirectCount?: number;
  timedOut?: boolean;
};

export async function fetchHtmlWithRedirects(urlValue: string): Promise<FetchResult | null> {
  let currentUrl = urlValue;
  let timedOut = false;
  for (let redirectCount = 0; redirectCount <= REDIRECT_LIMIT; redirectCount += 1) {
    const url = safeParseUrl(currentUrl);
    if (!url) {
      return { finalUrl: urlValue, html: "", status: 0, redirectCount, timedOut: false };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      timedOut = true;
    }, FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      // 构建更真实的浏览器 headers，避免被识别为 bot
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      };

      // 根据是否是第一次请求设置不同的 headers
      if (redirectCount === 0) {
        // 第一次请求：模拟从 Google 搜索点击进入
        headers["Referer"] = "https://www.google.com/";
        headers["Sec-Fetch-Site"] = "cross-site";
      } else {
        // 重定向后的请求：使用前一个 URL 作为 Referer
        headers["Referer"] = currentUrl;
        headers["Sec-Fetch-Site"] = "same-site";
      }

      response = await fetch(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        return { finalUrl: currentUrl, html: "", status: 0, redirectCount, timedOut: true };
      }
      return { finalUrl: currentUrl, html: "", status: 0, redirectCount, timedOut: false };
    }
    clearTimeout(timeoutId);

    if (isRedirectResponse(response)) {
      const location = response.headers.get("location");
      if (!location) {
        return { finalUrl: currentUrl, html: "", status: response.status, redirectCount, timedOut: false };
      }
      if (redirectCount >= REDIRECT_LIMIT) {
        return { finalUrl: currentUrl, html: "", status: response.status, redirectCount, timedOut: false };
      }
      const nextUrl = new URL(location, url);
      currentUrl = nextUrl.toString();
      continue;
    }

    if (!response.ok) {
      return { finalUrl: currentUrl, html: "", status: response.status, redirectCount, timedOut: false };
    }

    const html = await readResponseText(response);
    if (!html) {
      return { finalUrl: currentUrl, html: "", status: response.status, redirectCount, timedOut: false };
    }

    return { finalUrl: url.toString(), html, status: response.status, redirectCount, timedOut: false };
  }
  return { finalUrl: currentUrl, html: "", status: 0, redirectCount: REDIRECT_LIMIT + 1, timedOut: false };
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
  if (response.body) {
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

  // Fallback: if body is null, try text() method
  try {
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

export type ExtractedMetadata = {
  display_cover_image_url?: string;
  display_product_title?: string;
  display_price_amount_minor?: number;
  display_currency?: string;
  display_price_text?: string;
  display_merchant_domain?: string;
  display_merchant_logo_url?: string;
};

export function extractDisplayMetadata(html: string, finalUrl: string): ExtractedMetadata {
  const metadata = parseMetaTags(html);
  const jsonLd = parseJsonLd(html);

  const ogTitle = sanitizeDisplayTitle(metadata["og:title"] ?? metadata["twitter:title"]);
  const jsonLdTitle = sanitizeDisplayTitle(jsonLd?.name ?? undefined);
  const titleTag = sanitizeDisplayTitle(extractTitleTag(html));
  const displayTitle = ogTitle ?? jsonLdTitle ?? titleTag ?? undefined;

  // Priority: og:image:secure_url > og:image > twitter:image > twitter:image:src > jsonLd.image
  const ogImageSecure = metadata["og:image:secure_url"];
  const ogImage = metadata["og:image"];
  const twitterImage = metadata["twitter:image"];
  const twitterImageSrc = metadata["twitter:image:src"];
  const jsonLdImage = jsonLd?.image ?? undefined;
  const imageCandidate = ogImageSecure ?? ogImage ?? twitterImage ?? twitterImageSrc ?? jsonLdImage;
  const displayImage = resolveImageUrl(imageCandidate ?? undefined, finalUrl);

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

export function buildFillOnlyUpdates(
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
