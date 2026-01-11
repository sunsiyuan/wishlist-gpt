"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import countryToCurrency from "country-to-currency";
import { COUNTRIES, LANGUAGES, CURRENCIES } from "../../lib/options";

const DEFAULT_LANGUAGE = "en-US";
const DEFAULT_CURRENCY = "USD";

type ProfileFormProps = {
  initialValues?: {
    country_code?: string | null;
    preferred_language?: string | null;
    preferred_currency?: string | null;
  } | null;
  submitLabel: string;
  successRedirect?: string;
};

function extractRegionFromLanguage(language: string): string | null {
  const match = language.match(/-([a-zA-Z]{2})\b/);
  return match ? match[1].toUpperCase() : null;
}

function resolveBrowserLanguage(): string {
  if (typeof navigator === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  return navigator.languages?.[0] ?? navigator.language ?? DEFAULT_LANGUAGE;
}

function resolveCurrencyFromCountry(countryCode: string | null): string {
  if (!countryCode) {
    return DEFAULT_CURRENCY;
  }
  const mapping = countryToCurrency as Record<string, string>;
  return mapping[countryCode] ?? DEFAULT_CURRENCY;
}

export default function ProfileForm({
  initialValues,
  submitLabel,
  successRedirect,
}: ProfileFormProps) {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState(initialValues?.country_code ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(
    initialValues?.preferred_language ?? "",
  );
  const [preferredCurrency, setPreferredCurrency] = useState(
    initialValues?.preferred_currency ?? "",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [isSaving, setIsSaving] = useState(false);
  const currencyTouched = useRef(false);

  useEffect(() => {
    if (!preferredLanguage) {
      setPreferredLanguage(resolveBrowserLanguage());
    }
  }, [preferredLanguage]);

  useEffect(() => {
    if (!countryCode) {
      const region = extractRegionFromLanguage(preferredLanguage || resolveBrowserLanguage());
      if (region) {
        setCountryCode(region);
      }
    }
  }, [countryCode, preferredLanguage]);

  useEffect(() => {
    if (!preferredCurrency && !currencyTouched.current) {
      const region = countryCode || extractRegionFromLanguage(preferredLanguage);
      setPreferredCurrency(resolveCurrencyFromCountry(region));
    }
  }, [countryCode, preferredCurrency, preferredLanguage]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);

    const payload = {
      country_code: countryCode.trim().toUpperCase(),
      preferred_language: preferredLanguage.trim(),
      preferred_currency: preferredCurrency.trim().toUpperCase(),
    };

    if (!payload.country_code || !payload.preferred_language || !payload.preferred_currency) {
      setStatusTone("error");
      setStatusMessage("Please fill in all fields.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Country code</span>
        <select
          name="country_code"
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value)}
          required
          className="px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-gray-200"
        >
          <option value="">Select country</option>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Preferred language</span>
        <select
          name="preferred_language"
          value={preferredLanguage}
          onChange={(event) => setPreferredLanguage(event.target.value)}
          required
          className="px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-gray-200"
        >
          <option value="">Select language</option>
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Preferred currency</span>
        <select
          name="preferred_currency"
          value={preferredCurrency}
          onChange={(event) => {
            currencyTouched.current = true;
            setPreferredCurrency(event.target.value);
          }}
          required
          className="px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-gray-200"
        >
          <option value="">Select currency</option>
          {CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.name}
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
        className="w-full px-4 py-3 bg-primary text-white font-semibold rounded-pill hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 dark:bg-primary-dark dark:text-gray-900 dark:hover:bg-gray-200"
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
