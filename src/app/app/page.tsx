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

export default async function AppPage() {
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
  const items = await listItemsForUser({ userId, sort: "created_at.desc" });
  trackBestEffort({
    event_name: "web.app.items_list_load",
    user_id: userId,
    share_id: null,
    client_id: null,
    meta: requestMeta,
  });

  return <AppClient items={items} locale={locale} />;
}
