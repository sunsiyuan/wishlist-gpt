import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSupabaseUserId } from "../../../server/auth/supabase";
import { getPublicShareItems, isValidShareId, getActiveShareById } from "../../../server/shares";
import { getProfileForUserAdmin } from "../../../server/profiles/store";
import ShareViewTracker from "./ShareViewTracker";
import SharePageClient from "./SharePageClient";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ share_id: string }>;
  searchParams?: Promise<{ intent?: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { share_id: shareId } = await params;
  if (!isValidShareId(shareId)) {
    notFound();
  }

  const requestHeaders = await headers();
  const acceptLanguage = requestHeaders.get("accept-language");
  const defaultLocale = acceptLanguage?.split(",")[0]?.trim() || "en-US";

  const items = await getPublicShareItems(shareId);
  if (!items) {
    notFound();
  }

  // Get share to find owner
  const share = await getActiveShareById(shareId);
  if (!share) {
    notFound();
  }

  // Get owner profile for display
  const ownerProfile = await getProfileForUserAdmin(share.user_id);

  // Check if current user is logged in
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const currentUserId = claimsData?.claims?.sub;

  // Check if current user is the owner
  const isOwner = currentUserId === share.user_id;

  // Get current list ref for this share
  const { createListRef } = await import("../../../server/follows/store");
  const currentListRef = createListRef(share.user_id);

  // Get user profile and follows if logged in
  let userProfile: { nickname: string; avatar_name: string } | null = null;
  let follows: Array<{ list_ref: string; owner: { nickname: string; avatar_name: string } }> = [];
  let followingCount = 0;
  let isFollowing = false;

  // Get locale: use user's preferred_language if logged in, otherwise use accept-language
  let locale = defaultLocale;
  if (currentUserId) {
    const { getProfileForUser } = await import("../../../server/profiles/store");
    const { DEFAULT_PROFILE_CONTEXT } = await import("../../../lib/profile");
    const profile = await getProfileForUser(supabase, currentUserId);
    if (profile) {
      userProfile = {
        nickname: profile.nickname,
        avatar_name: profile.avatar_name,
      };
      locale = profile.preferred_language ?? DEFAULT_PROFILE_CONTEXT.preferred_language;
    }

    const { getFollowsForUser, checkFollow } = await import("../../../server/follows/store");
    follows = await getFollowsForUser(supabase, currentUserId);
    followingCount = follows.length;

    // Check if current user is already following this list
    isFollowing = await checkFollow(supabase, currentUserId, currentListRef);

    return (
      <>
        <ShareViewTracker shareId={shareId} />
        <SharePageClient
          items={items}
          shareId={shareId}
          locale={locale}
          ownerProfile={ownerProfile}
          isLoggedIn={true}
          isFollowing={isFollowing}
          isOwner={isOwner}
          userProfile={userProfile}
          follows={follows}
          followingCount={followingCount}
          currentListRef={currentListRef}
        />
      </>
    );
  }

  return (
    <>
      <ShareViewTracker shareId={shareId} />
      <SharePageClient
        items={items}
        shareId={shareId}
        locale={locale}
        ownerProfile={ownerProfile}
        isLoggedIn={false}
        isFollowing={false}
        isOwner={false}
        userProfile={null}
        follows={[]}
        followingCount={0}
        currentListRef={currentListRef}
      />
    </>
  );
}
