import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminFetch } from "../supabase/admin";
import type { ProfileRecord } from "../../lib/profile";

const PROFILE_SELECT = [
  "user_id",
  "country_code",
  "preferred_language",
  "preferred_currency",
  "accepted_at",
  "policy_version",
  "created_at",
  "updated_at",
].join(",");

export async function getProfileForUser(
  client: SupabaseClient,
  userId: string,
): Promise<ProfileRecord | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[profiles] failed to load profile", {
      user_id: userId,
      error_message: error.message,
    });
    return null;
  }

  if (!data) {
    return null;
  }
  return data as unknown as ProfileRecord;
}

export async function getProfileForUserAdmin(userId: string): Promise<ProfileRecord | null> {
  const search = new URLSearchParams({
    user_id: `eq.${userId}`,
    select: PROFILE_SELECT,
  });
  const response = await supabaseAdminFetch(`/rest/v1/profiles?${search.toString()}`);
  if (!response.ok) {
    console.warn("[profiles] admin fetch failed", {
      user_id: userId,
      status: response.status,
    });
    return null;
  }
  const data = (await response.json()) as ProfileRecord[];
  return data[0] ?? null;
}
