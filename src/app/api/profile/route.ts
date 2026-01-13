import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getProfileForUser } from "../../../server/profiles/store";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileForUser(supabase, userId);

  if (!profile) {
    return jsonError(404, "profile_not_found", "Profile not found");
  }

  return NextResponse.json({
    nickname: profile.nickname,
    avatar_name: profile.avatar_name,
  });
}

export async function PATCH(request: NextRequest) {
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    return jsonError(401, "unauthorized", "Supabase session required");
  }

  let body: { nickname?: string; avatar_name?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "Invalid JSON body");
  }

  const supabase = await createSupabaseServerClient();
  
  // Check if profile exists first
  const existingProfile = await getProfileForUser(supabase, userId);
  if (!existingProfile) {
    return jsonError(404, "profile_not_found", "Profile not found. Please complete initial setup first.");
  }

  const updates: { nickname?: string; avatar_name?: string; updated_at?: string } = {};

  // Validate and update nickname
  if (body.nickname !== undefined) {
    const trimmed = body.nickname.trim();
    if (trimmed.length === 0) {
      return jsonError(400, "invalid_nickname", "Nickname cannot be empty");
    }
    if (trimmed.length > 50) {
      return jsonError(400, "invalid_nickname", "Nickname must be 50 characters or less");
    }
    updates.nickname = trimmed;
  }

  // Validate and update avatar_name
  if (body.avatar_name !== undefined) {
    const trimmed = body.avatar_name.trim();
    if (trimmed.length === 0) {
      return jsonError(400, "invalid_avatar_name", "Avatar name cannot be empty");
    }
    updates.avatar_name = trimmed;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(400, "no_updates", "No valid fields to update");
  }

  // Let database handle updated_at via default, or explicitly set it
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select("nickname, avatar_name, updated_at")
    .single();

  if (error) {
    console.error("[profile] update failed", {
      user_id: userId,
      error: error.message,
      error_code: error.code,
      error_details: error.details,
      error_hint: error.hint,
      updates,
    });
    // Return more specific error message
    if (error.code === "42501") {
      return jsonError(403, "permission_denied", "You don't have permission to update this profile");
    }
    if (error.code === "23505") {
      return jsonError(409, "conflict", "Profile update conflict. Please try again.");
    }
    return jsonError(500, "update_failed", `Failed to update profile: ${error.message}`);
  }

  return NextResponse.json({
    ok: true,
    profile: {
      nickname: data.nickname,
      avatar_name: data.avatar_name,
    },
  });
}
