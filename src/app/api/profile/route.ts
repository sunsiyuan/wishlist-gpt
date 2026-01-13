import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getProfileForUser } from "../../../server/profiles/store";
import { DEFAULT_PROFILE_CONTEXT, POLICY_VERSION } from "../../../lib/profile";
import { supabaseAdminFetch } from "../../../server/supabase/admin";

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

async function handleProfileUpdate(request: NextRequest) {
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
  
  // Check if profile exists first, create if missing
  let existingProfile = await getProfileForUser(supabase, userId);
  if (!existingProfile) {
    // Auto-create profile with defaults if it doesn't exist
    const now = new Date().toISOString();
    const profileData = {
      user_id: userId,
      country_code: DEFAULT_PROFILE_CONTEXT.country_code,
      preferred_language: DEFAULT_PROFILE_CONTEXT.preferred_language,
      preferred_currency: DEFAULT_PROFILE_CONTEXT.preferred_currency,
      accepted_at: now,
      policy_version: POLICY_VERSION,
      nickname: "Me",
      avatar_name: "default",
    };

    const profileResponse = await supabaseAdminFetch("/rest/v1/profiles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(profileData),
    });

    if (!profileResponse.ok) {
      console.error("[profile] Failed to auto-create profile", {
        user_id: userId,
        status: profileResponse.status,
      });
      return jsonError(500, "profile_creation_failed", "Failed to create profile. Please try again.");
    }

    // Re-fetch the newly created profile
    existingProfile = await getProfileForUser(supabase, userId);
    if (!existingProfile) {
      return jsonError(500, "profile_not_found", "Profile was created but could not be retrieved.");
    }
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

// PATCH for updating profile (standard REST)
export async function PATCH(request: NextRequest) {
  return handleProfileUpdate(request);
}

// POST for updating profile (compatibility - treated as PATCH)
export async function POST(request: NextRequest) {
  return handleProfileUpdate(request);
}
