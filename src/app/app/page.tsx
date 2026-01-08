import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
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
  const acceptLanguage = requestHeaders.get("accept-language");
  const locale = acceptLanguage?.split(",")[0]?.trim() || "en";
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
