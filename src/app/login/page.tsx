import { sanitizeNextPath } from "../../server/auth/next-path";
import { loginWithPassword } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string; error?: string }>;
};

const DEFAULT_REDIRECT = "/";

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
  return "Login failed. Please try again.";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const next = sanitizeNextPath(resolvedParams?.next, DEFAULT_REDIRECT);
  const errorMessage = getErrorMessage(resolvedParams?.error);

  return (
    <main style={{ padding: "2rem", maxWidth: "420px" }}>
      <h1>Sign in</h1>
      <p>Use your email + password to continue.</p>
      {errorMessage ? (
        <p style={{ color: "#b91c1c" }} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <form action={loginWithPassword} style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <input type="hidden" name="next" value={next} />
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
