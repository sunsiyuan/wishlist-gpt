import { redirect } from "next/navigation";
import ProfileForm from "../components/ProfileForm";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getProfileForUser } from "../../server/profiles/store";
import { isProfileComplete } from "../../lib/profile";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const profile = await getProfileForUser(supabase, userId);
  if (isProfileComplete(profile)) {
    redirect("/app");
  }

  return (
    <main className="max-w-md mx-auto my-8 px-6">
      <h1 className="mb-2 text-2xl font-bold">Finish setting up</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Choose your country, language, and currency so we can personalize your wishlist.
      </p>
      <ProfileForm
        initialValues={profile ?? undefined}
        submitLabel="Continue"
        successRedirect="/app"
      />
    </main>
  );
}
