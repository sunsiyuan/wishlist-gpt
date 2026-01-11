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
    <main className="max-w-xl mx-auto my-8 px-6">
      <header className="mb-6">
        <p className="m-0 text-gray-600 dark:text-gray-400">Settings</p>
        <h1 className="mt-1 mb-0 text-2xl font-bold">App preferences</h1>
      </header>
      <ProfileForm initialValues={profile ?? undefined} submitLabel="Save settings" />
    </main>
  );
}
