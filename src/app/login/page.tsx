import { sanitizeNextPath } from "../../server/auth/next-path";
import LoginClient from "./LoginClient";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

const DEFAULT_REDIRECT = "/onboarding";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const next = sanitizeNextPath(resolvedParams?.next, DEFAULT_REDIRECT);

  return <LoginClient nextPath={next} />;
}
