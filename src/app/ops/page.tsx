import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import OpsClient from "./OpsClient";

export default async function OpsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login?next=/ops");
  }

  // Check allowlist (server-side)
  const allowlistStr = process.env.OPS_EMAIL_ALLOWLIST;
  if (!allowlistStr) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Ops access is not configured.</p>
        </div>
      </div>
    );
  }

  let allowlist: string[] = [];
  try {
    const parsed = JSON.parse(allowlistStr);
    if (Array.isArray(parsed)) {
      allowlist = parsed.filter((email): email is string => typeof email === "string" && email.includes("@"));
    }
  } catch {
    // Invalid JSON
  }

  if (allowlist.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Ops access is not configured.</p>
        </div>
      </div>
    );
  }

  const email = user.email.toLowerCase().trim();
  const allowed = allowlist.some((allowedEmail) => allowedEmail.toLowerCase().trim() === email);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Your email is not in the ops allowlist.</p>
        </div>
      </div>
    );
  }

  return <OpsClient />;
}
