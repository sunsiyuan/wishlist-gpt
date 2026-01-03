import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyAccessToken } from "../../../server/auth/bearer";
import { createOrTouchItem, listItems } from "../../../server/items/store";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function authenticate(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: jsonError(401, "missing_bearer", "Missing bearer token") };
  }
  const claims = verifyAccessToken(token);
  if (!claims) {
    return { error: jsonError(401, "invalid_token", "Invalid or expired token") };
  }
  return { claims };
}

export async function GET(request: NextRequest) {
  const auth = authenticate(request);
  if (auth.error) {
    return auth.error;
  }
  try {
    const items = await listItems({ userId: auth.claims.userId });
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        url_original: item.url_original,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })),
    });
  } catch (error) {
    return jsonError(500, "items_list_failed", "Failed to list items");
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticate(request);
  if (auth.error) {
    return auth.error;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return jsonError(400, "invalid_json", "Invalid JSON body");
  }
  if (!body || typeof body !== "object") {
    return jsonError(400, "invalid_body", "Request body must be a JSON object");
  }
  const urlValue = (body as { url?: unknown }).url;
  if (typeof urlValue !== "string" || !urlValue.trim()) {
    return jsonError(400, "invalid_url", "url is required and must be a string");
  }
  try {
    const item = await createOrTouchItem({
      userId: auth.claims.userId,
      url: urlValue,
    });
    return NextResponse.json({
      item: {
        id: item.id,
        url_original: item.url_original,
        created_at: item.created_at,
        updated_at: item.updated_at,
      },
    });
  } catch (error) {
    return jsonError(500, "items_upsert_failed", "Failed to save item");
  }
}
