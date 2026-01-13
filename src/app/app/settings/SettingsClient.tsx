"use client";

import { useState } from "react";
import SettingsSection from "../../components/SettingsSection";
import ProfileSettings from "../../components/ProfileSettings";
import PreferencesSettings from "../../components/PreferencesSettings";
import type { ProfileRecord } from "../../../lib/profile";

type SettingsClientProps = {
  profile: ProfileRecord | null;
};

export default function SettingsClient({ profile }: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState<"profile" | "preferences">("profile");

  const handleToggle = (section: "profile" | "preferences") => {
    // 如果点击已展开的区块，不做任何操作（保持至少展开一个）
    if (activeSection === section) {
      return;
    }
    // 否则切换到新区块（自动收起另一个）
    setActiveSection(section);
  };

  return (
    <main className="max-w-xl mx-auto my-8 px-6">
      <header className="mb-6">
        <p className="m-0 text-gray-600 dark:text-gray-400">Settings</p>
        <h1 className="mt-1 mb-0 text-2xl font-bold">App preferences</h1>
      </header>
      <div className="space-y-4">
        <SettingsSection
          title="Profile"
          isOpen={activeSection === "profile"}
          onToggle={() => handleToggle("profile")}
        >
          <ProfileSettings
            initialNickname={profile?.nickname ?? null}
            initialAvatarName={profile?.avatar_name ?? null}
          />
        </SettingsSection>
        <SettingsSection
          title="Preferences"
          isOpen={activeSection === "preferences"}
          onToggle={() => handleToggle("preferences")}
        >
          <PreferencesSettings
            initialValues={
              profile
                ? {
                    country_code: profile.country_code,
                    preferred_language: profile.preferred_language,
                    preferred_currency: profile.preferred_currency,
                  }
                : undefined
            }
          />
        </SettingsSection>
      </div>
    </main>
  );
}
