import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../../server/auth/supabase";
import { getBearerToken, verifyAccessToken } from "../../../../server/auth/bearer";
import {
  fetchHtmlWithRedirects,
  extractDisplayMetadata,
  buildFillOnlyUpdates,
  type FetchResult,
  type ExtractedMetadata,
} from "../../../../server/items/enrich";
import { getItemForUser, updateItemDisplayFields } from "../../../../server/items/store";
import type { DisplayFieldUpdate } from "../../../../server/items/store";

function isDevMode(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DEV_TOOLS === "1";
}

async function authenticate(request: NextRequest): Promise<{ userId: string } | null> {
  const supabaseUserId = await getSupabaseUserId(request);
  if (supabaseUserId) {
    return { userId: supabaseUserId };
  }

  const token = getBearerToken(request);
  if (!token) {
    return null;
  }
  const claims = verifyAccessToken(token);
  if (!claims) {
    return null;
  }
  return { userId: claims.userId };
}

export async function GET(request: NextRequest) {
  if (!isDevMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const itemId = searchParams.get("item_id");
  const apply = searchParams.get("apply") === "1";

  if (!url || !url.trim()) {
    return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
  }

  let fetchResult: FetchResult | null = null;
  let extracted: ExtractedMetadata = {};
  let extractedDetails: Record<string, unknown> = {};
  let computedUpdates: DisplayFieldUpdate = {};
  let applied = false;
  let error: string | null = null;

  try {
    fetchResult = await fetchHtmlWithRedirects(url.trim());
    if (!fetchResult || !fetchResult.html) {
      error = "Failed to fetch HTML";
      return NextResponse.json({
        finalUrl: fetchResult?.finalUrl ?? url,
        fetch: {
          ok: false,
          status: fetchResult?.status ?? null,
          redirects: fetchResult?.redirectCount ?? null,
          timedOut: fetchResult?.timedOut ?? null,
        },
        extracted: {},
        extractedDetails: {},
        computedUpdates: {},
        applied: false,
        error,
      });
    }

    const extractedResult = extractDisplayMetadata(fetchResult.html, fetchResult.finalUrl);
    extracted = extractedResult.extractedFields;
    extractedDetails = extractedResult.details;

    if (itemId) {
      const item = await getItemForUser({ userId: auth.userId, itemId });
      if (item) {
        computedUpdates = buildFillOnlyUpdates(item, extracted, fetchResult.finalUrl);
        if (apply && Object.keys(computedUpdates).length > 0) {
          await updateItemDisplayFields({
            userId: auth.userId,
            itemId: item.id,
            updates: computedUpdates,
          });
          applied = true;
        }
      } else {
        error = "Item not found";
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return NextResponse.json({
    finalUrl: fetchResult?.finalUrl ?? url,
    fetch: {
      ok: fetchResult !== null && fetchResult.html.length > 0,
      status: fetchResult?.status ?? null,
      redirects: fetchResult?.redirectCount ?? null,
      timedOut: fetchResult?.timedOut ?? null,
    },
    extracted,
    extractedDetails,
    computedUpdates,
    applied,
    error,
  });
}

