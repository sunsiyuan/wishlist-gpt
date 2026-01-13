import { sanitizeNextPath } from "../../server/auth/next-path";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import LoginClient from "./LoginClient";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

const DEFAULT_REDIRECT = "/onboarding";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const next = sanitizeNextPath(resolvedParams?.next, DEFAULT_REDIRECT);
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (userId) {
    redirect(next);
  }

  return <LoginClient nextPath={next} />;
}
