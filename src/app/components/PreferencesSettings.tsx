"use client";

import ProfileForm from "./ProfileForm";
import DarkModeToggle from "./DarkModeToggle";

type PreferencesSettingsProps = {
  initialValues?: {
    country_code?: string | null;
    preferred_language?: string | null;
    preferred_currency?: string | null;
  } | null;
};

export default function PreferencesSettings({ initialValues }: PreferencesSettingsProps) {
  return (
    <div className="space-y-4">
      <DarkModeToggle />
      <ProfileForm
        initialValues={initialValues}
        submitLabel="Save preferences"
        successRedirect={undefined}
      />
    </div>
  );
}
