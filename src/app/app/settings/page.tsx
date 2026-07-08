import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getProfileForUser } from "../../../server/profiles/store";
import { sanitizeNextPath } from "../../../server/auth/next-path";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const profile = await getProfileForUser(supabase, userId);
  const email = (claimsData?.claims?.email as string | undefined) ?? null;
  const resolvedParams = searchParams ? await searchParams : undefined;
  const nextPath = sanitizeNextPath(resolvedParams?.next, "/app");

  return <SettingsClient profile={profile} email={email} nextPath={nextPath} />;
}
