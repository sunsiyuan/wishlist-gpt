import ProfileForm from "../../components/ProfileForm";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getProfileForUser } from "../../../server/profiles/store";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  const profile = userId ? await getProfileForUser(supabase, userId) : null;

  return (
    <main style={{ maxWidth: "520px", margin: "2rem auto", padding: "0 1.5rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <p style={{ margin: 0, color: "#666" }}>Settings</p>
        <h1 style={{ margin: "0.25rem 0 0" }}>App preferences</h1>
      </header>
      <ProfileForm initialValues={profile ?? undefined} submitLabel="Save settings" />
    </main>
  );
}
