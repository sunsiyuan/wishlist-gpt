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
    <main style={{ maxWidth: "480px", margin: "2rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Finish setting up</h1>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        Choose your country, language, and currency so we can personalize your wishlist.
      </p>
      <ProfileForm
        initialValues={profile ?? undefined}
        submitLabel="Continue"
        successRedirect="/app"
        showPolicyNotice
      />
    </main>
  );
}
