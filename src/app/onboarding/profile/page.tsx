import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getProfileForUser } from "../../../server/profiles/store";
import ProfileOnboardingClient from "./ProfileOnboardingClient";
import { sanitizeNextPath } from "../../../server/auth/next-path";

export const dynamic = "force-dynamic";

type ProfileOnboardingPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function ProfileOnboardingPage({ searchParams }: ProfileOnboardingPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const profile = await getProfileForUser(supabase, userId);
  const resolvedParams = searchParams ? await searchParams : undefined;
  const nextPath = sanitizeNextPath(resolvedParams?.next, "/app");

  // If profile is already complete (has nickname and avatar_name), redirect
  if (profile?.nickname && profile?.avatar_name) {
    redirect(nextPath);
  }

  return (
    <main className="max-w-md mx-auto my-8 px-6">
      <h1 className="mb-2 text-2xl font-bold">Set up your profile</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Choose a nickname and avatar to personalize your wishlist.
      </p>
      <ProfileOnboardingClient
        initialNickname={profile?.nickname ?? "Me"}
        initialAvatarName={profile?.avatar_name ?? ""}
        nextPath={nextPath}
      />
    </main>
  );
}
