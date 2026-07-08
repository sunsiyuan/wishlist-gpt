"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "../../lib/options";

const DEFAULT_LANGUAGE = "en-US";

type ProfileFormProps = {
  initialValues?: {
    preferred_language?: string | null;
  } | null;
  submitLabel: string;
  successRedirect?: string;
};

function resolveBrowserLanguage(): string {
  if (typeof navigator === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  return navigator.languages?.[0] ?? navigator.language ?? DEFAULT_LANGUAGE;
}

export default function ProfileForm({
  initialValues,
  submitLabel,
  successRedirect,
}: ProfileFormProps) {
  const router = useRouter();
  const [preferredLanguage, setPreferredLanguage] = useState(
    initialValues?.preferred_language ?? "",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!preferredLanguage) {
      setPreferredLanguage(resolveBrowserLanguage());
    }
  }, [preferredLanguage]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);

    const payload = { preferred_language: preferredLanguage.trim() };
    if (!payload.preferred_language) {
      setStatusTone("error");
      setStatusMessage("Please choose a language.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setStatusTone("error");
        setStatusMessage("Could not save your settings. Please try again.");
        setIsSaving(false);
        return;
      }

      if (successRedirect) {
        router.replace(successRedirect);
        return;
      }

      setStatusTone("success");
      setStatusMessage("Saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusTone("error");
      setStatusMessage(`Could not save your settings: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-1">
        <span className="text-sm font-medium text-secondary dark:text-secondary-dark">Preferred language</span>
        <select
          name="preferred_language"
          value={preferredLanguage}
          onChange={(event) => setPreferredLanguage(event.target.value)}
          required
          className="px-3 py-2 rounded-button border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-primary-dark"
        >
          <option value="">Select language</option>
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}
            </option>
          ))}
        </select>
      </label>
      {statusMessage ? (
        <p
          className={`m-0 ${statusTone === "error" ? "text-error dark:text-error-dark" : "text-success dark:text-success-dark"}`}
          role={statusTone === "error" ? "alert" : undefined}
        >
          {statusMessage}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSaving}
        className="w-full px-4 py-3 bg-accent text-accent-fg font-semibold rounded-button hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
