import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { DEFAULT_PROFILE_CONTEXT } from "../../lib/profile";
import { getProfileForUser } from "../../server/profiles/store";
import { listItemsForUser } from "../../server/items/store";
import { getRequestMeta } from "../../server/tracking/requestMeta";
import { trackBestEffort } from "../../server/tracking/trackBestEffort";
import AppClient from "./AppClient";

export const dynamic = "force-dynamic";

type AppPageProps = {
  searchParams?: Promise<{ list_ref?: string }>;
};

export default async function AppPage({ searchParams }: AppPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const requestHeaders = await headers();
  const profile = await getProfileForUser(supabase, userId);
  const locale = profile?.preferred_language ?? DEFAULT_PROFILE_CONTEXT.preferred_language;
  const requestMeta = getRequestMeta(requestHeaders);
  
  const resolvedParams = searchParams ? await searchParams : undefined;
  const listRef = resolvedParams?.list_ref;

  // Get user's own profile for switcher
  const userProfile = profile
    ? {
        nickname: profile.nickname,
        avatar_name: profile.avatar_name,
      }
    : null;

  // Load items based on list_ref
  let items: Awaited<ReturnType<typeof listItemsForUser>> = [];
  let currentListRef: string | null = null;
  let currentOwner: { nickname: string; avatar_name: string } | null = null;
  let isFollowingView = false;
  let sharingDisabled = false;

  if (listRef && listRef.startsWith("u:")) {
    // Following view - load followed list items
    isFollowingView = true;
    currentListRef = listRef;
    // Items will be loaded client-side via API
  } else {
    // Own view - load own items
    items = await listItemsForUser({ userId, sort: "created_at.desc" });
    currentListRef = null;
    currentOwner = userProfile;
    trackBestEffort({
      event_name: "web.app.items_list_load",
      user_id: userId,
      share_id: null,
      client_id: null,
      meta: requestMeta,
    });
  }

  return (
    <AppClient
      items={items}
      locale={locale}
      userProfile={userProfile}
      initialListRef={listRef ?? null}
    />
  );
}
