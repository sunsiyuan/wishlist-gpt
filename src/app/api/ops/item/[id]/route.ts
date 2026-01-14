import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "../../../../../lib/supabase/server";
import { supabaseAdminFetch } from "../../../../../server/supabase/admin";
import { trackBestEffort } from "../../../../../server/tracking/trackBestEffort";
import { getRequestMeta } from "../../../../../server/tracking/requestMeta";

/**
 * POST /api/ops/item/:id
 * Updates item display fields via Ops interface.
 * 
 * Auth: Cookie session + OPS_EMAIL_ALLOWLIST check
 * Data access: Service role (bypass RLS, can update any item)
 * Audit: Writes web.ops.item_edit event
 */
function parseOpsEmailAllowlist(): string[] {
  const allowlistStr = process.env.OPS_EMAIL_ALLOWLIST;
  if (!allowlistStr) {
    return [];
  }
  try {
    const parsed = JSON.parse(allowlistStr);
    if (Array.isArray(parsed)) {
      return parsed.filter((email): email is string => typeof email === "string" && email.includes("@"));
    }
    return [];
  } catch {
    return [];
  }
}

async function checkOpsAccess(request: NextRequest): Promise<{ allowed: boolean; userId?: string }> {
  const supabase = createSupabaseRequestClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { allowed: false };
  }

  const allowlist = parseOpsEmailAllowlist();
  if (allowlist.length === 0) {
    // No allowlist configured, deny access
    return { allowed: false };
  }

  const email = user.email.toLowerCase().trim();
  const allowed = allowlist.some((allowedEmail) => allowedEmail.toLowerCase().trim() === email);

  return { allowed, userId: allowed ? user.id : undefined };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await checkOpsAccess(request);
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const updates = body as {
    display_product_title?: string | null;
    display_cover_image_url?: string | null;
    display_price_text?: string | null;
  };

  // Validate and prepare update payload
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("display_product_title" in updates) {
    payload.display_product_title = updates.display_product_title?.trim() || null;
  }
  if ("display_cover_image_url" in updates) {
    payload.display_cover_image_url = updates.display_cover_image_url?.trim() || null;
  }
  if ("display_price_text" in updates) {
    payload.display_price_text = updates.display_price_text?.trim() || null;
  }

  // Update price_updated_at if price fields are being updated
  if ("display_price_text" in updates) {
    payload.display_price_updated_at = new Date().toISOString();
  }

  try {
    // Update item using service role (bypass RLS)
    const response = await supabaseAdminFetch(`/rest/v1/items?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to update item: ${response.status}`);
    }

    // Write audit event (best-effort, non-blocking)
    const fieldsUpdated: string[] = [];
    if ("display_product_title" in updates) fieldsUpdated.push("display_product_title");
    if ("display_cover_image_url" in updates) fieldsUpdated.push("display_cover_image_url");
    if ("display_price_text" in updates) fieldsUpdated.push("display_price_text");

    const requestMeta = getRequestMeta(request.headers);
    trackBestEffort({
      event_name: "web.ops.item_edit",
      user_id: access.userId,
      share_id: null,
      client_id: null,
      meta: {
        ...requestMeta,
        item_id: id,
        fields: fieldsUpdated,
        via: "ops",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ops/item] Error", {
      item_id: id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
