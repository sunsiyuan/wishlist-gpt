import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminFetch } from "../supabase/admin";
import { getActiveShareById } from "../shares";
import { getProfileForUserAdmin } from "../profiles/store";

export type FollowRecord = {
  follower_user_id: string;
  list_ref: string;
  created_at: string;
};

export type FollowWithOwner = {
  list_ref: string;
  owner: {
    nickname: string;
  };
};

/**
 * Parse list_ref to extract owner_user_id
 * Format: "u:<owner_user_id>"
 */
export function parseListRef(listRef: string): { ownerUserId: string } | null {
  if (!listRef.startsWith("u:")) {
    return null;
  }
  const ownerUserId = listRef.substring(2);
  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(ownerUserId)) {
    return null;
  }
  return { ownerUserId };
}

/**
 * Create list_ref from owner_user_id
 */
export function createListRef(ownerUserId: string): string {
  return `u:${ownerUserId}`;
}

/**
 * Get all follows for a user
 */
export async function getFollowsForUser(
  client: SupabaseClient,
  followerUserId: string,
): Promise<FollowWithOwner[]> {
  const { data, error } = await client
    .from("follows")
    .select("list_ref")
    .eq("follower_user_id", followerUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[follows] failed to load follows", {
      follower_user_id: followerUserId,
      error_message: error.message,
    });
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Fetch owner profiles for each list_ref
  const followsWithOwner: FollowWithOwner[] = [];
  for (const follow of data) {
    const parsed = parseListRef(follow.list_ref);
    if (!parsed) {
      continue;
    }

    const ownerProfile = await getProfileForUserAdmin(parsed.ownerUserId);
    if (!ownerProfile) {
      continue;
    }

    followsWithOwner.push({
      list_ref: follow.list_ref,
      owner: {
        nickname: ownerProfile.nickname,
      },
    });
  }

  return followsWithOwner;
}

/**
 * Check if user follows a list_ref
 */
export async function checkFollow(
  client: SupabaseClient,
  followerUserId: string,
  listRef: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("follows")
    .select("list_ref")
    .eq("follower_user_id", followerUserId)
    .eq("list_ref", listRef)
    .maybeSingle();

  if (error) {
    console.warn("[follows] check failed", {
      follower_user_id: followerUserId,
      list_ref: listRef,
      error_message: error.message,
    });
    return false;
  }

  return data !== null;
}

/**
 * Create a follow relationship
 * Returns the list_ref and owner info
 */
export async function createFollow(
  client: SupabaseClient,
  followerUserId: string,
  shareId: string,
): Promise<FollowWithOwner> {
  // Get the share to find the owner
  const share = await getActiveShareById(shareId);
  if (!share) {
    throw new Error("share_not_found");
  }

  // Check if share is revoked (should not happen if using getActiveShareById, but double-check)
  if (share.revoked_at) {
    throw new Error("share_revoked");
  }

  const ownerUserId = share.user_id;
  const listRef = createListRef(ownerUserId);

  // Check if already following (idempotent)
  const alreadyFollowing = await checkFollow(client, followerUserId, listRef);
  if (alreadyFollowing) {
    // Return existing follow
    const ownerProfile = await getProfileForUserAdmin(ownerUserId);
    if (!ownerProfile) {
      throw new Error("owner_profile_not_found");
    }
    return {
      list_ref: listRef,
      owner: {
        nickname: ownerProfile.nickname,
      },
    };
  }

  // Create follow
  const { data, error } = await client
    .from("follows")
    .insert({
      follower_user_id: followerUserId,
      list_ref: listRef,
    })
    .select("list_ref")
    .single();

  if (error) {
    console.error("[follows] create failed", {
      follower_user_id: followerUserId,
      list_ref: listRef,
      error: error.message,
    });
    throw new Error("follow_create_failed");
  }

  // Get owner profile
  const ownerProfile = await getProfileForUserAdmin(ownerUserId);
  if (!ownerProfile) {
    throw new Error("owner_profile_not_found");
  }

  return {
    list_ref: data.list_ref,
    owner: {
      nickname: ownerProfile.nickname,
    },
  };
}

/**
 * Delete a follow relationship (idempotent)
 */
export async function deleteFollow(
  client: SupabaseClient,
  followerUserId: string,
  listRef: string,
): Promise<boolean> {
  const { error } = await client
    .from("follows")
    .delete()
    .eq("follower_user_id", followerUserId)
    .eq("list_ref", listRef);

  if (error) {
    console.error("[follows] delete failed", {
      follower_user_id: followerUserId,
      list_ref: listRef,
      error: error.message,
    });
    throw new Error("follow_delete_failed");
  }

  return true;
}
