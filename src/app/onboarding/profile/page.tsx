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
  const email = (claimsData?.claims?.email as string | undefined) ?? null;
  const resolvedParams = searchParams ? await searchParams : undefined;
  const nextPath = sanitizeNextPath(resolvedParams?.next, "/app");

  // Onboarding is complete once a real nickname is set (the avatar defaults to a monogram).
  if (profile?.nickname && profile.nickname !== "Nickname") {
    redirect(nextPath);
  }

  return (
    <main className="max-w-md mx-auto my-8 px-6">
      <h1 className="mb-2 text-2xl font-bold">Set up your profile</h1>
      <p className="text-secondary dark:text-secondary-dark mb-6">
        Pick a nickname. Add a photo now or later — otherwise we&apos;ll use your initial.
      </p>
      <ProfileOnboardingClient
        initialNickname={profile?.nickname ?? "Nickname"}
        initialAvatarUrl={profile?.avatar_url ?? null}
        email={email}
        nextPath={nextPath}
      />
    </main>
  );
}
