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
  const locale = acceptLanguage?.split(",")[0]?.trim() || "en";

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

  // Check if current user is already following this list
  let isFollowing = false;
  if (currentUserId) {
    const { createListRef } = await import("../../../server/follows/store");
    const listRef = createListRef(share.user_id);
    const supabaseClient = await createSupabaseServerClient();
    const { checkFollow } = await import("../../../server/follows/store");
    isFollowing = await checkFollow(supabaseClient, currentUserId, listRef);
  }

  return (
    <>
      <ShareViewTracker shareId={shareId} />
      <SharePageClient
        items={items}
        shareId={shareId}
        locale={locale}
        ownerProfile={ownerProfile}
        isLoggedIn={!!currentUserId}
        isFollowing={isFollowing}
      />
    </>
  );
}
