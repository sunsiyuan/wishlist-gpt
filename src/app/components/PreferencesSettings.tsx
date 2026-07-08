"use client";

import ProfileForm from "./ProfileForm";
import DarkModeToggle from "./DarkModeToggle";

type PreferencesSettingsProps = {
  initialValues?: {
    preferred_language?: string | null;
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
