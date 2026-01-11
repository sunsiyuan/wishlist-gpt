import "server-only";

import { after } from "next/server";
import type { DisplayFieldUpdate, ItemRecord } from "./store";
import {
  getItemForUser,
  updateItemDisplayFields,
  insertItemEnrichAttempt,
  insertItemEnrichFinal,
  safeJsonForDb,
} from "./store";
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
import { DEFAULT_PROFILE_CONTEXT, isProfileComplete } from "../../lib/profile";
import { getProfileForUserAdmin } from "../profiles/store";

const ENRICH_DEBUG = process.env.ENRICH_DEBUG === "1";
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.ENRICH_FETCH_TIMEOUT_MS ?? "4000", 10);
const OPENGRAPH_IO_TIMEOUT_MS = 2000;
const REDIRECT_LIMIT = 3;
const MAX_RESPONSE_BYTES = 1_000_000;
const SHOPIFY_BODY_PREFIX_BYTES = 500;
const BLOCKED_STATUS_CODES = new Set([403, 429, 503]);
const BLOCKED_BODY_KEYWORDS = [
  "captcha",
  "verify you are human",
  "access denied",
  "bot detection",
  "unusual traffic",
  "challenge",
];
const OPENGRAPH_IO_APP_ID = process.env.OPENGRAPH_IO_APP_ID;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 WishlistGPT/0.4";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAcceptLanguage(preferredLanguage?: string | null): string {
  const normalized = preferredLanguage?.trim();
  if (normalized) {
    return normalized;
  }
  return DEFAULT_PROFILE_CONTEXT.preferred_language;
}

// Enrich attempt type for logging
export type EnrichAttempt = {
  strategy: "gpts_input" | "shopify_js" | "html" | "opengraph_io";
  started_at: string;
  duration_ms: number;
  request?: {
    url?: string;
    headers?: Record<string, string>;
    source?: string;
    path?: string;
  };
  fetch?: {
    ok: boolean;
    status?: number;
    status_code?: number;
    redirects?: number;
    timed_out?: boolean;
    final_url?: string;
    response_content_type?: string;
    body_prefix?: string;
    latency_ms?: number;
    blocked?: boolean;
    blocked_reason?: string;
    blocked_keyword?: string;
  };
  details?: Record<string, unknown>;
  raw?: unknown;
  computed_updates?: DisplayFieldUpdate;
  error?: string;
};

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

  const attempts: EnrichAttempt[] = [];
  const runGroupId = crypto.randomUUID();
  // Working item view: start from DB item, apply updates in memory after each attempt
  let workingItem = { ...item };
  const profile = await getProfileForUserAdmin(params.userId);
  const acceptLanguage = getAcceptLanguage(
    isProfileComplete(profile) ? profile?.preferred_language : null,
  );

  const logAttempt = async (attempt: EnrichAttempt): Promise<void> => {
    attempts.push(attempt);
    await insertItemEnrichAttempt({
      userId: params.userId,
      itemId: params.itemId,
      sourceUrl: params.url,
      runGroupId,
      strategy: attempt.strategy,
      attempt,
    });
  };

  // Attempt 1: Shopify Product JS
  const shopifyInfo = isProbablyShopifyProductUrl(params.url);
  if (shopifyInfo) {
    const startedAt = new Date().toISOString();
    const attempt: EnrichAttempt = {
      strategy: "shopify_js",
      started_at: startedAt,
      duration_ms: 0,
      request: {
        url: `${shopifyInfo.origin}${shopifyInfo.localePrefix ? `/${shopifyInfo.localePrefix}` : ""}/products/${shopifyInfo.handle}.js`,
        headers: buildShopifyJsFetchHeaders(acceptLanguage),
      },
    };

    try {
      const fetchResult = await fetchShopifyProductJs(
        shopifyInfo.origin,
        shopifyInfo.localePrefix,
        shopifyInfo.handle,
        acceptLanguage,
      );
      const duration = Date.now() - new Date(startedAt).getTime();
      attempt.duration_ms = duration;

      if (!fetchResult.ok) {
        const failure = fetchResult as ShopifyJsFailureResult;
        attempt.fetch = {
          ok: false,
          status: failure.status,
          status_code: failure.status,
          final_url: failure.finalUrl,
          response_content_type: failure.contentType ?? "",
          body_prefix: failure.bodyPrefix,
          latency_ms: duration,
          blocked: failure.blocked,
          blocked_reason: failure.blockedReason,
          blocked_keyword: failure.blockedKeyword,
        };
        if (failure.blocked) {
          attempt.error = "blocked_or_rate_limited";
        } else if (failure.status) {
          attempt.error = failure.unexpectedContentType ? "unexpected_content_type" : "http_error";
        } else {
          attempt.error = "network_or_runtime_error";
        }
      } else {
        attempt.fetch = {
          ok: true,
          final_url: fetchResult.finalUrl,
          status: fetchResult.status,
          status_code: fetchResult.status,
          response_content_type: fetchResult.contentType ?? "",
          latency_ms: duration,
        };
        const extracted = extractFromShopifyProductJs(fetchResult.json, fetchResult.finalUrl);
        attempt.details = extracted.details;
        attempt.raw = extracted.raw;

        const updates = buildFillOnlyUpdates(workingItem, extracted.extractedFields, fetchResult.finalUrl);
        attempt.computed_updates = updates;
        if (Object.keys(updates).length > 0) {
          // Apply to working item
          Object.assign(workingItem, updates);
        }
      }
    } catch (error) {
      const duration = Date.now() - new Date(startedAt).getTime();
      attempt.duration_ms = duration;
      attempt.error = error instanceof Error ? error.message : "Unknown error";
    }

    await logAttempt(attempt);
  }

  // Attempt 2: HTML (always try)
  const htmlStartedAt = new Date().toISOString();
  const htmlAttempt: EnrichAttempt = {
    strategy: "html",
    started_at: htmlStartedAt,
    duration_ms: 0,
      request: {
        url: params.url,
        headers: buildHtmlFetchHeaders(acceptLanguage),
      },
    };

  try {
    const fetchResult = await fetchHtmlWithRedirects(params.url, acceptLanguage);
    const duration = Date.now() - new Date(htmlStartedAt).getTime();
    htmlAttempt.duration_ms = duration;

    if (fetchResult && (fetchResult.html || fetchResult.blocked)) {
      htmlAttempt.fetch = {
        ok: fetchResult.status ? fetchResult.status >= 200 && fetchResult.status < 300 : true,
        status: fetchResult.status,
        status_code: fetchResult.status,
        redirects: fetchResult.redirectCount,
        timed_out: fetchResult.timedOut ?? false,
        final_url: fetchResult.finalUrl,
        response_content_type: fetchResult.responseContentType ?? "",
        latency_ms: duration,
        blocked: fetchResult.blocked ?? false,
        blocked_reason: fetchResult.blockedReason,
        blocked_keyword: fetchResult.blockedKeyword,
      };

      if (fetchResult.blocked) {
        htmlAttempt.details = {
          blocked: {
            reason: fetchResult.blockedReason,
            keyword: fetchResult.blockedKeyword,
          },
        };
        htmlAttempt.error = "blocked_response";
      } else if (fetchResult.html) {
        const extracted = extractDisplayMetadata(fetchResult.html, fetchResult.finalUrl);
        htmlAttempt.details = extracted.details;
        // Do not store raw HTML, only parsed structures

        const updates = buildFillOnlyUpdates(workingItem, extracted.extractedFields, fetchResult.finalUrl);
        htmlAttempt.computed_updates = updates;
        if (Object.keys(updates).length > 0) {
          Object.assign(workingItem, updates);
        }
      }
    } else {
      htmlAttempt.fetch = {
        ok: false,
        status: fetchResult?.status ?? undefined,
        status_code: fetchResult?.status ?? undefined,
        redirects: fetchResult?.redirectCount ?? undefined,
        timed_out: fetchResult?.timedOut ?? false,
        final_url: fetchResult?.finalUrl ?? params.url,
        response_content_type: fetchResult?.responseContentType ?? "",
        latency_ms: duration,
        blocked: fetchResult?.blocked ?? false,
        blocked_reason: fetchResult?.blockedReason,
        blocked_keyword: fetchResult?.blockedKeyword,
      };
      htmlAttempt.error = "fetch_failed";
    }
  } catch (error) {
    const duration = Date.now() - new Date(htmlStartedAt).getTime();
    htmlAttempt.duration_ms = duration;
    htmlAttempt.error = error instanceof Error ? error.message : "Unknown error";
  }

  await logAttempt(htmlAttempt);

  // Determine if both attempts failed
  // Shopify failed if: not a shopify URL, fetch failed, or extracted no useful fields
  const shopifyAttempt = attempts.find((a) => a.strategy === "shopify_js");
  const shopifyExtracted = shopifyAttempt?.details?.shopify;
  const shopifyExtractedRecord = isRecord(shopifyExtracted) ? shopifyExtracted : null;
  const hasShopifyUsefulFields =
    shopifyExtractedRecord !== null &&
    (shopifyExtractedRecord.title ||
      shopifyExtractedRecord.image ||
      shopifyExtractedRecord.variants_sample);
  const shopifyFailed =
    !shopifyInfo ||
    shopifyAttempt?.error !== undefined ||
    !shopifyAttempt?.fetch?.ok ||
    !hasShopifyUsefulFields;

  // HTML failed if: fetch not ok OR extracted no fields
  const htmlExtracted = htmlAttempt.details;
  const hasHtmlUsefulFields = htmlExtracted && Object.keys(htmlExtracted).length > 0;
  const htmlFailed = htmlAttempt.error !== undefined || !htmlAttempt.fetch?.ok || !hasHtmlUsefulFields;

  // Attempt 3: opengraph.io (only if both failed)
  if (shopifyFailed && htmlFailed && OPENGRAPH_IO_APP_ID) {
    const ogStartedAt = new Date().toISOString();
    const ogAttempt: EnrichAttempt = {
      strategy: "opengraph_io",
      started_at: ogStartedAt,
      duration_ms: 0,
      request: {
        url: params.url,
      },
    };

    try {
      const fetchResult = await fetchOpenGraphIo(params.url);
      const duration = Date.now() - new Date(ogStartedAt).getTime();
      ogAttempt.duration_ms = duration;

      if (fetchResult) {
        ogAttempt.fetch = {
          ok: true,
          status_code: fetchResult.status,
          response_content_type: fetchResult.responseContentType ?? "",
          latency_ms: duration,
        };
        const extracted = extractFromOpenGraphIo(fetchResult.json, params.url);
        ogAttempt.details = extracted.details;
        ogAttempt.raw = extracted.raw;

        const updates = buildFillOnlyUpdates(workingItem, extracted.extractedFields, params.url);
        ogAttempt.computed_updates = updates;
        if (Object.keys(updates).length > 0) {
          Object.assign(workingItem, updates);
        }
      } else {
        ogAttempt.fetch = { ok: false, latency_ms: duration };
        ogAttempt.error = "fetch_failed";
      }
    } catch (error) {
      const duration = Date.now() - new Date(ogStartedAt).getTime();
      ogAttempt.duration_ms = duration;
      ogAttempt.error = error instanceof Error ? error.message : "Unknown error";
    }

    await logAttempt(ogAttempt);
  }

  // Compute final updates (delta from original item to working item)
  const finalUpdates: DisplayFieldUpdate = {};
  if (workingItem.display_product_title !== item.display_product_title) {
    finalUpdates.display_product_title = workingItem.display_product_title;
  }
  if (workingItem.display_cover_image_url !== item.display_cover_image_url) {
    finalUpdates.display_cover_image_url = workingItem.display_cover_image_url;
  }
  if (workingItem.display_merchant_domain !== item.display_merchant_domain) {
    finalUpdates.display_merchant_domain = workingItem.display_merchant_domain;
  }
  if (workingItem.display_merchant_logo_url !== item.display_merchant_logo_url) {
    finalUpdates.display_merchant_logo_url = workingItem.display_merchant_logo_url;
  }
  if (workingItem.display_price_amount_minor !== item.display_price_amount_minor) {
    finalUpdates.display_price_amount_minor = workingItem.display_price_amount_minor;
  }
  if (workingItem.display_currency !== item.display_currency) {
    finalUpdates.display_currency = workingItem.display_currency;
  }
  if (workingItem.display_price_text !== item.display_price_text) {
    finalUpdates.display_price_text = workingItem.display_price_text;
  }
  if (workingItem.display_price_updated_at !== item.display_price_updated_at) {
    finalUpdates.display_price_updated_at = workingItem.display_price_updated_at;
  }

  // Apply updates if any
  let finalApplied = false;
  if (Object.keys(finalUpdates).length > 0) {
    try {
      await updateItemDisplayFields({
        userId: params.userId,
        itemId: params.itemId,
        updates: finalUpdates,
      });
      finalApplied = true;

      if (ENRICH_DEBUG) {
        console.log("[enrich] updated", {
          item_id: params.itemId,
          step: "updated",
          keys: Object.keys(finalUpdates),
        });
      }
    } catch (error) {
      if (ENRICH_DEBUG) {
        console.warn("[enrich] update failed", {
          item_id: params.itemId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  if (finalApplied) {
    await insertItemEnrichFinal({
      userId: params.userId,
      itemId: params.itemId,
      sourceUrl: params.url,
      runGroupId,
      finalApplied,
      finalUpdates,
    });
  }
}

export type FetchResult = {
  finalUrl: string;
  html: string;
  status?: number;
  redirectCount?: number;
  timedOut?: boolean;
  responseContentType?: string;
  blocked?: boolean;
  blockedReason?: string;
  blockedKeyword?: string;
};

export async function fetchHtmlWithRedirects(
  urlValue: string,
  acceptLanguage: string,
): Promise<FetchResult | null> {
  let currentUrl = urlValue;
  let timedOut = false;
  for (let redirectCount = 0; redirectCount <= REDIRECT_LIMIT; redirectCount += 1) {
    const url = safeParseUrl(currentUrl);
    if (!url) {
      return {
        finalUrl: urlValue,
        html: "",
        status: 0,
        redirectCount,
        timedOut: false,
        responseContentType: "",
      };
    }

    const requestStart = Date.now();
    const deadline = requestStart + FETCH_TIMEOUT_MS;
    const headers = buildHtmlFetchHeaders(acceptLanguage);
    let responseResult = await fetchWithTimeout(url.toString(), headers, FETCH_TIMEOUT_MS);
    timedOut = responseResult.timedOut;

    if (!responseResult.response) {
      return {
        finalUrl: currentUrl,
        html: "",
        status: 0,
        redirectCount,
        timedOut,
        responseContentType: "",
      };
    }

    let response = responseResult.response;
    if ((response.status === 429 || response.status === 503) && !responseResult.timedOut) {
      const retryDelayMs = computeRetryDelayMs(response.headers.get("retry-after"));
      const remainingForDelay = deadline - Date.now();
      if (retryDelayMs > 0 && remainingForDelay > retryDelayMs) {
        await sleep(retryDelayMs);
        const remainingForRetry = deadline - Date.now();
        if (remainingForRetry > 0) {
          responseResult = await fetchWithTimeout(url.toString(), headers, remainingForRetry);
          timedOut = responseResult.timedOut;
          if (!responseResult.response) {
            return {
              finalUrl: currentUrl,
              html: "",
              status: 0,
              redirectCount,
              timedOut,
              responseContentType: "",
            };
          }
          response = responseResult.response;
        }
      }
    }

    if (isRedirectResponse(response)) {
      const location = response.headers.get("location");
      if (!location) {
        return {
          finalUrl: currentUrl,
          html: "",
          status: response.status,
          redirectCount,
          timedOut: false,
          responseContentType: response.headers.get("content-type") ?? "",
        };
      }
      if (redirectCount >= REDIRECT_LIMIT) {
        return {
          finalUrl: currentUrl,
          html: "",
          status: response.status,
          redirectCount,
          timedOut: false,
          responseContentType: response.headers.get("content-type") ?? "",
        };
      }
      const nextUrl = new URL(location, url);
      currentUrl = nextUrl.toString();
      continue;
    }

    if (!response.ok) {
      return {
        finalUrl: currentUrl,
        html: "",
        status: response.status,
        redirectCount,
        timedOut: false,
        responseContentType: response.headers.get("content-type") ?? "",
        ...getBlockedInfo(response.status, null),
      };
    }

    const html = await readResponseText(response);
    if (!html) {
      return {
        finalUrl: currentUrl,
        html: "",
        status: response.status,
        redirectCount,
        timedOut: false,
        responseContentType: response.headers.get("content-type") ?? "",
      };
    }

    // If this looks like a block/challenge page, skip deep parsing.
    const blockedInfo = getBlockedInfo(response.status, html);
    if (blockedInfo.blocked) {
      return {
        finalUrl: url.toString(),
        html: "",
        status: response.status,
        redirectCount,
        timedOut: false,
        responseContentType: response.headers.get("content-type") ?? "",
        ...blockedInfo,
      };
    }

    return {
      finalUrl: url.toString(),
      html,
      status: response.status,
      redirectCount,
      timedOut: false,
      responseContentType: response.headers.get("content-type") ?? "",
    };
  }
  return {
    finalUrl: currentUrl,
    html: "",
    status: 0,
    redirectCount: REDIRECT_LIMIT + 1,
    timedOut: false,
    responseContentType: "",
  };
}

function isRedirectResponse(response: Response): boolean {
  return [301, 302, 303, 307, 308].includes(response.status);
}

function buildHtmlFetchHeaders(acceptLanguage: string): Record<string, string> {
  return {
    "User-Agent": BROWSER_USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": acceptLanguage,
  };
}

function buildShopifyJsFetchHeaders(acceptLanguage: string): Record<string, string> {
  return {
    "User-Agent": BROWSER_USER_AGENT,
    Accept: "application/json,*/*;q=0.8",
    "Accept-Language": acceptLanguage,
  };
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  return contentType.toLowerCase().includes("application/json");
}

function computeRetryDelayMs(retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const parsed = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed * 1000, 5000);
    }
  }
  const base = 250 + Math.floor(Math.random() * 550);
  const jitter = Math.floor(Math.random() * 100);
  return base + jitter;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ response: Response | null; timedOut: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers,
    });
    return { response, timedOut: false };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { response: null, timedOut: true };
    }
    return { response: null, timedOut: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithTimeoutDetailed(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ response: Response | null; timedOut: boolean; error?: Error }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers,
    });
    return { response, timedOut: false };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { response: null, timedOut: true };
    }
    return { response: null, timedOut: false, error: error instanceof Error ? error : undefined };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getBlockedInfo(
  status: number | undefined,
  body: string | null,
): { blocked: boolean; blockedReason?: string; blockedKeyword?: string } {
  if (status && BLOCKED_STATUS_CODES.has(status)) {
    return { blocked: true, blockedReason: "status_code" };
  }
  if (!body) {
    return { blocked: false };
  }
  const haystack = body.toLowerCase();
  for (const keyword of BLOCKED_BODY_KEYWORDS) {
    if (haystack.includes(keyword)) {
      return { blocked: true, blockedReason: "body_keyword", blockedKeyword: keyword };
    }
  }
  return { blocked: false };
}

export function isBlockedResponse(status: number | undefined, body: string | null): boolean {
  return getBlockedInfo(status, body).blocked;
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

// Shopify Product JS detection and fetching
export function isProbablyShopifyProductUrl(url: string): {
  origin: string;
  localePrefix: string | null;
  handle: string;
} | null {
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch (error) {
    try {
      urlObj = new URL(url, "https://example.com");
    } catch (fallbackError) {
      return null;
    }
  }

  const segs = urlObj.pathname.split("/").filter(Boolean);
  const productsIndex = segs.indexOf("products");
  if (productsIndex < 0) {
    return null;
  }

  const handle = segs[productsIndex + 1];
  if (!handle) {
    return null;
  }

  const localePrefix =
    productsIndex > 0 && segs[0] !== "collections" ? segs[0] : null;

  return {
    origin: `${urlObj.protocol}//${urlObj.host}`,
    localePrefix,
    handle,
  };
}

type ShopifyJsFetchResult =
  | { ok: true; finalUrl: string; json: unknown; status: number; contentType?: string }
  | {
      ok: false;
      finalUrl: string;
      status?: number;
      contentType?: string;
      blocked?: boolean;
      blockedReason?: string;
      blockedKeyword?: string;
      bodyPrefix?: string;
      errorName?: string;
      errorMessage?: string;
      unexpectedContentType?: boolean;
    };

type ShopifyJsFailureResult = Extract<ShopifyJsFetchResult, { ok: false }>;

async function fetchShopifyProductJs(
  origin: string,
  localePrefix: string | null,
  handle: string,
  acceptLanguage: string,
): Promise<ShopifyJsFetchResult> {
  const endpoints = [
    localePrefix ? `${origin}/${localePrefix}/products/${handle}.js` : null,
    `${origin}/products/${handle}.js`,
  ].filter(Boolean) as string[];

  let lastFailure:
    | {
        ok: false;
        finalUrl: string;
        status?: number;
        contentType?: string;
        blocked?: boolean;
        blockedReason?: string;
        blockedKeyword?: string;
        bodyPrefix?: string;
        errorName?: string;
        errorMessage?: string;
        unexpectedContentType?: boolean;
      }
    | null = null;

  for (const endpoint of endpoints) {
    const requestStart = Date.now();
    const deadline = requestStart + FETCH_TIMEOUT_MS;
    const headers = buildShopifyJsFetchHeaders(acceptLanguage);
    let responseResult = await fetchWithTimeoutDetailed(endpoint, headers, FETCH_TIMEOUT_MS);

    if (!responseResult.response) {
      if (responseResult.timedOut) {
        lastFailure = {
          ok: false,
          finalUrl: endpoint,
          errorName: "AbortError",
          errorMessage: "Request timed out",
        };
      } else if (responseResult.error) {
        lastFailure = {
          ok: false,
          finalUrl: endpoint,
          errorName: responseResult.error.name,
          errorMessage: responseResult.error.message,
        };
      } else {
        lastFailure = { ok: false, finalUrl: endpoint, errorName: "FetchError", errorMessage: "Fetch failed" };
      }
      continue;
    }

    let response = responseResult.response;
    if (isRedirectResponse(response)) {
      const location = response.headers.get("location");
      if (!location) {
        const contentType = response.headers.get("content-type");
        const bodyPrefix = ENRICH_DEBUG
          ? await readResponsePrefix(response.clone(), SHOPIFY_BODY_PREFIX_BYTES)
          : undefined;
        lastFailure = {
          ok: false,
          finalUrl: endpoint,
          status: response.status,
          contentType: contentType ?? "",
          bodyPrefix,
          ...getBlockedInfo(response.status, bodyPrefix ?? null),
        };
        continue;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        lastFailure = {
          ok: false,
          finalUrl: endpoint,
          errorName: "AbortError",
          errorMessage: "Request timed out",
        };
        continue;
      }
      const nextUrl = new URL(location, endpoint).toString();
      responseResult = await fetchWithTimeoutDetailed(nextUrl, headers, remaining);
      if (!responseResult.response) {
        if (responseResult.timedOut) {
          lastFailure = {
            ok: false,
            finalUrl: nextUrl,
            errorName: "AbortError",
            errorMessage: "Request timed out",
          };
        } else if (responseResult.error) {
          lastFailure = {
            ok: false,
            finalUrl: nextUrl,
            errorName: responseResult.error.name,
            errorMessage: responseResult.error.message,
          };
        } else {
          lastFailure = { ok: false, finalUrl: nextUrl, errorName: "FetchError", errorMessage: "Fetch failed" };
        }
        continue;
      }
      response = responseResult.response;
    }

    const contentType = response.headers.get("content-type");
    if (!response.ok) {
      const bodyPrefix = ENRICH_DEBUG
        ? await readResponsePrefix(response.clone(), SHOPIFY_BODY_PREFIX_BYTES)
        : undefined;
      lastFailure = {
        ok: false,
        finalUrl: response.url || endpoint,
        status: response.status,
        contentType: contentType ?? "",
        bodyPrefix,
        ...getBlockedInfo(response.status, bodyPrefix ?? null),
      };
      continue;
    }

    if (!isJsonContentType(contentType)) {
      const bodyPrefix = ENRICH_DEBUG
        ? await readResponsePrefix(response.clone(), SHOPIFY_BODY_PREFIX_BYTES)
        : undefined;
      lastFailure = {
        ok: false,
        finalUrl: response.url || endpoint,
        status: response.status,
        contentType: contentType ?? "",
        bodyPrefix,
        unexpectedContentType: true,
        ...getBlockedInfo(response.status, bodyPrefix ?? null),
      };
      continue;
    }

    try {
      const json = await response.json();
      return {
        ok: true,
        finalUrl: response.url || endpoint,
        json,
        status: response.status,
        contentType: contentType ?? "",
      };
    } catch (error) {
      lastFailure = {
        ok: false,
        finalUrl: response.url || endpoint,
        status: response.status,
        contentType: contentType ?? "",
        errorName: error instanceof Error ? error.name : "ParseError",
        errorMessage: error instanceof Error ? error.message : "Failed to parse JSON",
      };
      continue;
    }
  }

  return (
    lastFailure ?? {
      ok: false,
      finalUrl: `${origin}/products/${handle}.js`,
      errorName: "FetchError",
      errorMessage: "No Shopify endpoints attempted",
    }
  );
}

function extractFromShopifyProductJs(
  json: unknown,
  finalUrl: string,
): {
  extractedFields: ExtractedMetadata;
  details: Record<string, unknown>;
  raw: unknown;
} {
  const extractedFields: ExtractedMetadata = {};
  const details: Record<string, unknown> = {};

  if (!isRecord(json)) {
    return { extractedFields, details, raw: json };
  }

  const product = json;
  const shopifyDetails: Record<string, unknown> = {};

  // Extract title
  if (typeof product.title === "string") {
    const title = sanitizeDisplayTitle(product.title);
    if (title) {
      extractedFields.display_product_title = title;
      shopifyDetails.title = product.title;
    }
  }

  // Extract image
  if (isRecord(product.image)) {
    const image = product.image;
    if (typeof image.src === "string") {
      const imageUrl = resolveImageUrl(image.src, finalUrl);
      if (imageUrl) {
        extractedFields.display_cover_image_url = imageUrl;
        shopifyDetails.image = image.src;
      }
    }
  } else if (Array.isArray(product.images) && product.images.length > 0) {
    const firstImage = product.images[0];
    if (isRecord(firstImage)) {
      const image = firstImage;
      if (typeof image.src === "string") {
        const imageUrl = resolveImageUrl(image.src, finalUrl);
        if (imageUrl) {
          extractedFields.display_cover_image_url = imageUrl;
          shopifyDetails.image = image.src;
        }
      }
    } else if (typeof firstImage === "string") {
      const imageUrl = resolveImageUrl(firstImage, finalUrl);
      if (imageUrl) {
        extractedFields.display_cover_image_url = imageUrl;
        shopifyDetails.image = firstImage;
      }
    }
  }

  // Extract price from first variant
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const firstVariant = product.variants[0];
    if (isRecord(firstVariant)) {
      shopifyDetails.variants_sample = [
        {
          id: firstVariant.id,
          price: firstVariant.price,
          available: firstVariant.available,
        },
      ];

      if (typeof firstVariant.price === "string") {
        const priceFloat = parseFloat(firstVariant.price);
        if (Number.isFinite(priceFloat)) {
          extractedFields.display_price_amount_minor = Math.round(priceFloat * 100);
        } else {
          const priceText = sanitizePriceText(firstVariant.price);
          if (priceText) {
            extractedFields.display_price_text = priceText;
          }
        }
      }

      if (typeof firstVariant.price_currency === "string") {
        const currency = sanitizeCurrency(firstVariant.price_currency);
        if (currency) {
          extractedFields.display_currency = currency;
        }
      }
    }
  }

  // Extract merchant domain
  const domain = deriveMerchantDomainFromUrl(finalUrl);
  if (domain) {
    extractedFields.display_merchant_domain = domain;
  }

  shopifyDetails.id = product.id;
  shopifyDetails.handle = product.handle;
  if (Array.isArray(product.images)) {
    shopifyDetails.images_sample = product.images
      .slice(0, 3)
      .map((img: unknown) => {
        if (typeof img === "string") return img;
        if (isRecord(img)) {
          return img.src ?? img;
        }
        return img;
      });
  }

  details.shopify = shopifyDetails;

  // Cap raw JSON for DB storage
  const raw = safeJsonForDb(product);

  return { extractedFields, details, raw };
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

async function readResponsePrefix(response: Response, maxBytes: number): Promise<string | null> {
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        const remaining = maxBytes - received;
        const slice = value.length > remaining ? value.slice(0, remaining) : value;
        received += slice.length;
        chunks.push(slice);
      }
    }

    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    return buffer.toString("utf-8");
  }

  try {
    const text = await response.text();
    return text.slice(0, maxBytes);
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

export function extractDisplayMetadata(
  html: string,
  finalUrl: string,
): {
  extractedFields: ExtractedMetadata;
  details: Record<string, unknown>;
} {
  const metadata = parseMetaTags(html);
  const jsonLd = parseJsonLd(html);
  const icons = parseIconLinks(html, finalUrl);

  // Group metadata for details
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const meta: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith("og:")) {
      og[key] = value;
    } else if (key.startsWith("twitter:")) {
      twitter[key] = value;
    } else {
      meta[key] = value;
    }
  }

  const titleTag = extractTitleTag(html);
  if (titleTag) {
    meta.title_tag = titleTag;
  }

  const canonical = extractCanonicalUrl(html);
  if (canonical) {
    meta.canonical = canonical;
  }

  if (metadata.description) {
    meta.description = metadata.description;
  }

  const extractedFields: ExtractedMetadata = {};

  // Extract title
  const ogTitle = sanitizeDisplayTitle(metadata["og:title"] ?? metadata["twitter:title"]);
  const jsonLdTitle = sanitizeDisplayTitle(jsonLd.product?.name ?? undefined);
  const displayTitle = ogTitle ?? jsonLdTitle ?? sanitizeDisplayTitle(titleTag ?? undefined);
  if (displayTitle) {
    extractedFields.display_product_title = displayTitle;
  }

  // Extract image (Priority: og:image:secure_url > og:image > twitter:image > twitter:image:src > jsonLd.image)
  const ogImageSecure = metadata["og:image:secure_url"];
  const ogImage = metadata["og:image"];
  const twitterImage = metadata["twitter:image"];
  const twitterImageSrc = metadata["twitter:image:src"];
  const jsonLdImage = jsonLd.product?.image ?? undefined;
  const imageCandidate = ogImageSecure ?? ogImage ?? twitterImage ?? twitterImageSrc ?? jsonLdImage;
  const displayImage = resolveImageUrl(imageCandidate ?? undefined, finalUrl);
  if (displayImage) {
    extractedFields.display_cover_image_url = displayImage;
  }

  // Extract price from JSON-LD
  const priceAmountMinor = sanitizePriceAmountMinor(jsonLd.product?.priceAmountMinor ?? null);
  const priceCurrency = sanitizeCurrency(jsonLd.product?.priceCurrency ?? null);
  const priceText = sanitizePriceText(jsonLd.product?.priceText ?? null);
  if (priceAmountMinor !== null) {
    extractedFields.display_price_amount_minor = priceAmountMinor;
  }
  if (priceCurrency) {
    extractedFields.display_currency = priceCurrency;
  }
  if (priceText) {
    extractedFields.display_price_text = priceText;
  }

  // Extract domain
  const domain = deriveMerchantDomainFromUrl(finalUrl) ?? undefined;
  if (domain) {
    extractedFields.display_merchant_domain = domain;
  }

  // Extract icon (best icon from HTML, no fallback here)
  if (icons.bestIconUrl) {
    extractedFields.display_merchant_logo_url = icons.bestIconUrl;
  }

  const details: Record<string, unknown> = {
    og,
    twitter,
    meta,
    json_ld: jsonLd.all,
    icons: icons.candidates,
  };

  return { extractedFields, details };
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

function extractCanonicalUrl(html: string): string | null {
  const match = /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html);
  if (!match) {
    return null;
  }
  return match[1].trim();
}

type IconCandidate = {
  rel: string;
  href: string;
  sizes?: string;
};

function parseIconLinks(html: string, baseUrl: string): {
  candidates: IconCandidate[];
  bestIconUrl: string | null;
} {
  const candidates: IconCandidate[] = [];
  const linkRegex = /<link[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html))) {
    const tag = match[0];
    const relMatch = /rel=["']([^"']+)["']/i.exec(tag);
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    const sizesMatch = /sizes=["']([^"']+)["']/i.exec(tag);

    if (!relMatch || !hrefMatch) continue;

    const rel = relMatch[1].toLowerCase();
    const href = hrefMatch[1];

    if (
      rel.includes("apple-touch-icon") ||
      rel === "icon" ||
      rel === "shortcut icon"
    ) {
      let resolved: string;
      try {
        resolved = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }

      const sanitized = sanitizeDisplayUrl(resolved);
      if (!sanitized) continue;

      candidates.push({
        rel,
        href: sanitized,
        sizes: sizesMatch ? sizesMatch[1] : undefined,
      });
    }
  }

  // Priority: apple-touch-icon > icon (prefer larger sizes) > shortcut icon
  let bestIconUrl: string | null = null;

  // First try apple-touch-icon
  const appleTouchIcon = candidates.find((c) => c.rel.includes("apple-touch-icon"));
  if (appleTouchIcon) {
    bestIconUrl = appleTouchIcon.href;
  } else {
    // Then try regular icon, prefer larger sizes
    const icons = candidates.filter((c) => c.rel === "icon");
    if (icons.length > 0) {
      // Sort by size (extract number from sizes like "32x32" or "192x192")
      icons.sort((a, b) => {
        const aSize = a.sizes ? parseInt(a.sizes.match(/(\d+)/)?.[1] ?? "0", 10) : 0;
        const bSize = b.sizes ? parseInt(b.sizes.match(/(\d+)/)?.[1] ?? "0", 10) : 0;
        return bSize - aSize;
      });
      bestIconUrl = icons[0].href;
    } else {
      // Fallback to shortcut icon
      const shortcutIcon = candidates.find((c) => c.rel === "shortcut icon");
      if (shortcutIcon) {
        bestIconUrl = shortcutIcon.href;
      }
    }
  }

  return { candidates, bestIconUrl };
}

type JsonLdProduct = {
  name?: string | null;
  image?: string | null;
  priceAmountMinor?: number | null;
  priceCurrency?: string | null;
  priceText?: string | null;
};

function parseJsonLd(html: string): {
  product: JsonLdProduct | null;
  all: unknown[];
} {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const all: unknown[] = [];
  let product: JsonLdProduct | null = null;

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

    // Collect all parsed JSON-LD nodes
    const nodes = collectJsonLdNodes(data);
    for (const node of nodes) {
      // Cap individual node size for storage
      const nodeStr = JSON.stringify(node);
      if (nodeStr.length > 10000) {
        // Truncate large nodes
        all.push({
          truncated: true,
          preview: nodeStr.substring(0, 500),
        });
      } else {
        all.push(node);
      }
    }

    // Also try to find Product for backward compatibility
    if (!product) {
      product = findProductInJsonLd(data);
    }
  }

  // Cap total array size
  if (all.length > 50) {
    return {
      product,
      all: all.slice(0, 50).concat([{ note: "truncated", total_count: all.length }]),
    };
  }

  return { product, all };
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
  if (isRecord(data)) {
    const record = data;
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
  if (isRecord(value)) {
    const obj = value;
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
  if (!isRecord(value)) {
    return { amountMinor: null, currency: null, text: null };
  }
  const record = value;
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

  if (isRecord(priceSpecification)) {
    const spec = priceSpecification;
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

async function fetchOpenGraphIo(
  url: string,
): Promise<{ json: unknown; status?: number; responseContentType?: string } | null> {
  if (!OPENGRAPH_IO_APP_ID) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENGRAPH_IO_TIMEOUT_MS);

  try {
    const apiUrl = `https://opengraph.io/api/1.1/site/${encodeURIComponent(url)}?app_id=${OPENGRAPH_IO_APP_ID}&auto_proxy=true`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return {
      json,
      status: response.status,
      responseContentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      return null;
    }
    return null;
  }
}

function extractFromOpenGraphIo(json: unknown, finalUrl: string): {
  extractedFields: ExtractedMetadata;
  details: Record<string, unknown>;
  raw: unknown;
} {
  const extractedFields: ExtractedMetadata = {};
  const details: Record<string, unknown> = {};

  if (!isRecord(json)) {
    return { extractedFields, details, raw: json };
  }

  const response = json;
  const hybridGraph = isRecord(response.hybridGraph) ? response.hybridGraph : undefined;
  const openGraph = isRecord(response.openGraph) ? response.openGraph : undefined;
  const requestInfo = isRecord(response.requestInfo) ? response.requestInfo : undefined;

  const opengraphDetails: Record<string, unknown> = {};

  // Extract title
  if (hybridGraph?.title && typeof hybridGraph.title === "string") {
    const title = sanitizeDisplayTitle(hybridGraph.title);
    if (title) {
      extractedFields.display_product_title = title;
      opengraphDetails.hybridGraph_title = hybridGraph.title;
    }
  } else if (openGraph?.title && typeof openGraph.title === "string") {
    const title = sanitizeDisplayTitle(openGraph.title);
    if (title) {
      extractedFields.display_product_title = title;
      opengraphDetails.openGraph_title = openGraph.title;
    }
  }

  // Extract image (prefer secure)
  if (hybridGraph?.imageSecureUrl && typeof hybridGraph.imageSecureUrl === "string") {
    const imageUrl = resolveImageUrl(hybridGraph.imageSecureUrl, finalUrl);
    if (imageUrl) {
      extractedFields.display_cover_image_url = imageUrl;
      opengraphDetails.hybridGraph_image = hybridGraph.imageSecureUrl;
    }
  } else if (openGraph?.image) {
    if (typeof openGraph.image === "string") {
      const imageUrl = resolveImageUrl(openGraph.image, finalUrl);
      if (imageUrl) {
        extractedFields.display_cover_image_url = imageUrl;
        opengraphDetails.openGraph_image = openGraph.image;
      }
    } else if (isRecord(openGraph.image)) {
      const imageObj = openGraph.image;
      const secureUrl = imageObj.secure_url ?? imageObj.url;
      if (typeof secureUrl === "string") {
        const imageUrl = resolveImageUrl(secureUrl, finalUrl);
        if (imageUrl) {
          extractedFields.display_cover_image_url = imageUrl;
          opengraphDetails.openGraph_image = secureUrl;
        }
      }
    }
  }

  // Extract favicon (prefer https)
  if (hybridGraph?.favicon && typeof hybridGraph.favicon === "string") {
    const faviconUrl = resolveImageUrl(hybridGraph.favicon, finalUrl);
    if (faviconUrl && faviconUrl.startsWith("https://")) {
      extractedFields.display_merchant_logo_url = faviconUrl;
      opengraphDetails.hybridGraph_favicon = hybridGraph.favicon;
    }
  }

  // Extract domain
  const domain = deriveMerchantDomainFromUrl(finalUrl);
  if (domain) {
    extractedFields.display_merchant_domain = domain;
  }

  // Store details
  if (hybridGraph) {
    opengraphDetails.hybridGraph = {
      title: hybridGraph.title,
      image: hybridGraph.image,
      imageSecureUrl: hybridGraph.imageSecureUrl,
      favicon: hybridGraph.favicon,
    };
  }
  if (openGraph) {
    opengraphDetails.openGraph = {
      title: openGraph.title,
      image: openGraph.image,
      url: openGraph.url, // Note: we don't use this to replace item.url
    };
  }
  if (requestInfo) {
    opengraphDetails.requestInfo = {
      redirects: requestInfo.redirects,
      finalUrl: requestInfo.finalUrl,
    };
  }

  details.opengraph = opengraphDetails;

  // Cap raw JSON for DB storage
  const raw = safeJsonForDb(response);

  return { extractedFields, details, raw };
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
  // Merchant logo with upgrade logic
  const domain =
    extracted.display_merchant_domain ?? updates.display_merchant_domain ?? item.display_merchant_domain;
  const currentLogo = item.display_merchant_logo_url;
  const fallbackLogo = domain ? buildFaviconUrl(domain) : null;

  if (isMissingDisplayValue(currentLogo)) {
    // Missing: fill with extracted logo or fallback
    if (extracted.display_merchant_logo_url) {
      updates.display_merchant_logo_url = extracted.display_merchant_logo_url;
    } else if (fallbackLogo) {
      updates.display_merchant_logo_url = fallbackLogo;
    }
  } else if (
    currentLogo === fallbackLogo &&
    extracted.display_merchant_logo_url &&
    extracted.display_merchant_logo_url.startsWith("https://")
  ) {
    // Upgrade: current is fallback, extracted is better (https)
    updates.display_merchant_logo_url = extracted.display_merchant_logo_url;
  }
  // Else: do nothing (keep existing logo)

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
