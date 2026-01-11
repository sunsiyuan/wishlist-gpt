"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type LoginClientProps = {
  nextPath: string;
  errorMessage?: string | null;
};

function sanitizeNextPath(nextPath: string): string {
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/onboarding";
  }
  return nextPath;
}

export default function LoginClient({ nextPath, errorMessage }: LoginClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const safeNextPath = sanitizeNextPath(nextPath);
  const [statusMessage, setStatusMessage] = useState<string | null>(errorMessage ?? null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted && data.session) {
        router.replace(safeNextPath);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [router, safeNextPath, supabase]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      safeNextPath,
    )}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setStatusMessage(error.message ?? "Google login failed. Please try again.");
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatusMessage(error.message ?? "Login failed. Please try again.");
      setIsLoading(false);
      return;
    }

    router.replace(safeNextPath);
  };

  return (
    <main style={{ padding: "2rem", maxWidth: "420px" }}>
      <h1>Sign in</h1>
      <p>Use your Supabase account to continue.</p>
      {statusMessage ? (
        <p style={{ color: "#b91c1c" }} role="alert">
          {statusMessage}
        </p>
      ) : null}
      <button type="button" onClick={handleGoogleLogin} disabled={isLoading}>
        Continue with Google
      </button>
      <hr style={{ margin: "1.5rem 0" }} />
      <form onSubmit={handleEmailLogin} style={{ display: "grid", gap: "0.75rem" }}>
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
        <button type="submit" disabled={isLoading}>
          Continue
        </button>
      </form>
      <p style={{ fontSize: "0.85rem", color: "#555", marginTop: "1.5rem", margin: "1.5rem 0 0 0" }}>
        You must be 13 or older to use WishlistGPT. By continuing, you agree to the Terms and
        acknowledge the Privacy Policy. Read the <a href="/terms">Terms</a> and{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
      <footer style={{ marginTop: "2rem", fontSize: "0.85rem", color: "#6b6b6b" }}>
        <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
      </footer>
    </main>
  );
}
