import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getFollowsForUser, createFollow, deleteFollow } from "../../../server/follows/store";
import { trackBestEffort } from "../../../server/tracking/trackBestEffort";
import { getRequestMeta } from "../../../server/tracking/requestMeta";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  const supabase = await createSupabaseServerClient();
  const follows = await getFollowsForUser(supabase, userId);

  return NextResponse.json({
    following_count: follows.length,
    following: follows,
  });
}

export async function POST(request: NextRequest) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  let body: { share_id?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Invalid JSON body");
  }

  if (!body.share_id) {
    return jsonError(400, "share_id_required", "share_id is required");
  }

  const supabase = await createSupabaseServerClient();
  const requestMeta = getRequestMeta(request.headers);
  
  try {
    const follow = await createFollow(supabase, userId, body.share_id);
    
    // Track follow event (best effort, non-blocking)
    after(async () => {
      trackBestEffort({
        event_name: "web.follow.create",
        user_id: userId,
        share_id: body.share_id,
        client_id: null,
        meta: {
          ...requestMeta,
          list_ref: follow.list_ref,
          share_id: body.share_id,
        },
      });
    });
    
    return NextResponse.json({
      ok: true,
      list_ref: follow.list_ref,
      owner: follow.owner,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";
    if (errorMessage === "share_not_found") {
      return jsonError(
        400,
        "invalid_share",
        "This share link is invalid. Please check the link and try again.",
      );
    }
    if (errorMessage === "share_revoked") {
      return jsonError(
        400,
        "share_revoked",
        "This list is no longer shared. The owner may have stopped sharing it.",
      );
    }
    console.error("[follows] POST failed", { user_id: userId, error: errorMessage });
    return jsonError(500, "follow_failed", "Failed to follow this list");
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  let body: { list_ref?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Invalid JSON body");
  }

  if (!body.list_ref) {
    return jsonError(400, "list_ref_required", "list_ref is required");
  }

  const supabase = await createSupabaseServerClient();
  const requestMeta = getRequestMeta(request.headers);
  
  try {
    await deleteFollow(supabase, userId, body.list_ref);
    
    // Track unfollow event (best effort, non-blocking)
    after(async () => {
      trackBestEffort({
        event_name: "web.follow.delete",
        user_id: userId,
        share_id: null,
        client_id: null,
        meta: {
          ...requestMeta,
          list_ref: body.list_ref,
        },
      });
    });
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";
    console.error("[follows] DELETE failed", { user_id: userId, error: errorMessage });
    return jsonError(500, "unfollow_failed", "Failed to unfollow this list");
  }
}
