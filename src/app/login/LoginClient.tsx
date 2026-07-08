"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type LoginClientProps = {
  nextPath: string;
};

type Step = "enter_email" | "code_sent" | "verifying";

function sanitizeNextPath(nextPath: string): string {
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/onboarding";
  }
  return nextPath;
}

export default function LoginClient({ nextPath }: LoginClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const safeNextPath = sanitizeNextPath(nextPath);
  const [step, setStep] = useState<Step>("enter_email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      safeNextPath,
    )}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setErrorMsg(error.message ?? "Google login failed. Please try again.");
      setIsLoading(false);
    }
  };

  const requestCode = useCallback(async () => {
    setErrorMsg(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { shouldCreateUser: true },
    });
    setIsLoading(false);
    if (error) {
      setErrorMsg(error.message ?? "Failed to send code. Please try again.");
      return;
    }
    setStep("code_sent");
    startCooldown(45);
  }, [email, supabase, startCooldown]);

  const handleRequestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await requestCode();
  };

  const verifyCode = useCallback(async () => {
    setErrorMsg(null);
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length !== 6) {
      setErrorMsg("Please enter a 6-digit code.");
      return;
    }
    setStep("verifying");
    setIsLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmedCode,
      type: "email",
    });
    setIsLoading(false);
    if (error) {
      setStep("code_sent");
      setErrorMsg(error.message ?? "Invalid code. Please try again.");
      return;
    }
    if (data.session) {
      // Track login success event
      const isNewUser =
        data.user.created_at &&
        new Date(data.user.created_at).getTime() > Date.now() - 60 * 60 * 1000; // 1 hour
      try {
        await fetch("/api/track/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_name: "web.auth.login_success",
            meta: {
              auth_method: "email_otp",
              is_new_user: isNewUser,
              request_id: crypto.randomUUID(),
            },
          }),
        });
      } catch (err) {
        // Best effort tracking, ignore errors
        console.error("Failed to track login event:", err);
      }
      router.replace(safeNextPath);
    }
  }, [code, email, supabase, router, safeNextPath]);

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await verifyCode();
  };

  const handleResend = async () => {
    if (cooldown > 0) {
      return;
    }
    setErrorMsg(null);
    await requestCode();
  };

  const handleChangeEmail = () => {
    setStep("enter_email");
    setCode("");
    setErrorMsg(null);
  };

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">Sign in</h1>
      <p className="text-secondary dark:text-secondary-dark mb-6">Use your Supabase account to continue.</p>
      {errorMsg ? (
        <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-button dark:bg-error-dark/15 dark:border-error-dark/30">
          <p className="text-sm text-error dark:text-error-dark" role="alert">
            {errorMsg}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-background-light dark:bg-background-dark-light border border-border dark:border-border-dark rounded-button text-primary dark:text-primary-dark font-medium hover:bg-background dark:hover:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 dark:bg-background-dark-light dark:border-border-dark dark:text-primary-dark dark:hover:bg-background-dark"
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
          <span className="px-2 bg-background text-secondary dark:bg-background-dark dark:text-secondary-dark">
            Or continue with email
          </span>
        </div>
      </div>
      {step === "enter_email" ? (
        <form onSubmit={handleRequestCode} className="space-y-3">
          <label className="block">
            <span className="block text-sm font-medium mb-1 text-secondary dark:text-secondary-dark">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={isLoading}
              className="w-full px-4 py-2 border border-border rounded-button focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-3 bg-accent text-accent-fg font-semibold rounded-button hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isLoading ? "Sending code..." : "Request code"}
          </button>
        </form>
      ) : step === "code_sent" || step === "verifying" ? (
        <div className="space-y-3">
          <div className="p-3 bg-sunken border border-border rounded-button dark:bg-sunken-dark dark:border-border-dark">
            <p className="text-sm text-secondary dark:text-secondary-dark">
              Code sent to <strong>{email}</strong>
            </p>
          </div>
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <label className="block">
              <span className="block text-sm font-medium mb-1 text-secondary dark:text-secondary-dark">
                Verification code
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setCode(value);
                  setErrorMsg(null);
                }}
                autoComplete="one-time-code"
                required
                disabled={isLoading || step === "verifying"}
                className="w-full px-4 py-2 border border-border rounded-button text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="000000"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading || step === "verifying"}
              className="w-full px-4 py-3 bg-accent text-accent-fg font-semibold rounded-button hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {step === "verifying" ? "Verifying..." : "Verify"}
            </button>
          </form>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isLoading || step === "verifying"}
              className="text-primary hover:text-primary/80 dark:text-primary-dark dark:hover:text-primary-dark/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={handleChangeEmail}
              disabled={isLoading || step === "verifying"}
              className="text-secondary hover:text-primary dark:text-secondary-dark dark:hover:text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Change email
            </button>
          </div>
        </div>
      ) : null}
      <p className="mt-6 text-xs text-secondary dark:text-secondary-dark leading-relaxed">
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
