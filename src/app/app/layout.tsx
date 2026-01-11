import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { isProfileComplete } from "../../lib/profile";
import { getProfileForUser } from "../../server/profiles/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const profile = await getProfileForUser(supabase, userId);
  if (!isProfileComplete(profile)) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
