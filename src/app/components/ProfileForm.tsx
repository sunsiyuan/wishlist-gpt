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
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
      <label style={{ display: "grid", gap: "0.4rem" }}>
        Country code
        <select
          name="country_code"
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value)}
          required
          style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #ddd" }}
        >
          <option value="">Select country</option>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: "0.4rem" }}>
        Preferred language
        <select
          name="preferred_language"
          value={preferredLanguage}
          onChange={(event) => setPreferredLanguage(event.target.value)}
          required
          style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #ddd" }}
        >
          <option value="">Select language</option>
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: "0.4rem" }}>
        Preferred currency
        <select
          name="preferred_currency"
          value={preferredCurrency}
          onChange={(event) => {
            currencyTouched.current = true;
            setPreferredCurrency(event.target.value);
          }}
          required
          style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #ddd" }}
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
          style={{ color: statusTone === "error" ? "#b91c1c" : "#166534", margin: 0 }}
          role={statusTone === "error" ? "alert" : undefined}
        >
          {statusMessage}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSaving}
        style={{
          border: "none",
          borderRadius: "999px",
          padding: "0.75rem",
          background: "#111",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
