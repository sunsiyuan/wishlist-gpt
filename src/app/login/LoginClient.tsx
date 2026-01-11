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
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">Sign in</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Use your Supabase account to continue.</p>
      {statusMessage ? (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
          <p className="text-sm text-error dark:text-error-dark" role="alert">
            {statusMessage}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-border rounded-lg text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 dark:bg-background-dark-light dark:border-border-dark dark:text-gray-200 dark:hover:bg-background-dark"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </button>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border dark:border-border-dark"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-background text-gray-500 dark:bg-background-dark dark:text-gray-400">
            Or continue with email
          </span>
        </div>
      </div>
      <form onSubmit={handleEmailLogin} className="space-y-3">
        <label className="block">
          <span className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-gray-200"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-gray-200"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-3 bg-primary text-white font-semibold rounded-pill hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 dark:bg-primary-dark dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {isLoading ? "Signing in..." : "Continue"}
        </button>
      </form>
      <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        You must be 13 or older to use WishlistGPT. By continuing, you agree to the Terms and
        acknowledge the Privacy Policy. Read the{" "}
        <a href="/terms" className="text-primary underline hover:text-primary/80 dark:text-primary-dark">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-primary underline hover:text-primary/80 dark:text-primary-dark">
          Privacy Policy
        </a>
        .
      </p>
      <footer className="mt-8 text-center text-sm text-secondary dark:text-secondary-dark">
        <a href="/privacy" className="hover:text-primary dark:hover:text-primary-dark">
          Privacy
        </a>
        {" · "}
        <a href="/terms" className="hover:text-primary dark:hover:text-primary-dark">
          Terms
        </a>
      </footer>
    </main>
  );
}
