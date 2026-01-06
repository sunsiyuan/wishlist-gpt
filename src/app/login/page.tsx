import { sanitizeNextPath } from "../../server/auth/next-path";
import LoginClient from "./LoginClient";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string; error?: string }>;
};

const DEFAULT_REDIRECT = "/app";

function getErrorMessage(error?: string) {
  if (!error) {
    return null;
  }
  if (error === "missing") {
    return "Email and password are required.";
  }
  if (error === "invalid") {
    return "Invalid email or password.";
  }
  if (error === "missing_code") {
    return "Missing OAuth code. Please try again.";
  }
  if (error === "oauth_exchange_failed") {
    return "Could not finish OAuth login. Please try again.";
  }
  return "Login failed. Please try again.";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const next = sanitizeNextPath(resolvedParams?.next, DEFAULT_REDIRECT);
  const errorMessage = getErrorMessage(resolvedParams?.error);

  return <LoginClient nextPath={next} errorMessage={errorMessage} />;
}
