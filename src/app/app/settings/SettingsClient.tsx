"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import SettingsSection from "../../components/SettingsSection";
import ProfileSettings from "../../components/ProfileSettings";
import PreferencesSettings from "../../components/PreferencesSettings";
import type { ProfileRecord } from "../../../lib/profile";

type SettingsClientProps = {
  profile: ProfileRecord | null;
  email: string | null;
  nextPath: string;
};

export default function SettingsClient({ profile, email, nextPath }: SettingsClientProps) {
  const router = useRouter();
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
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => router.push(nextPath)}
            className="flex items-center gap-1 text-secondary dark:text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors duration-200"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>
        <h1 className="m-0 text-2xl font-bold">Settings</h1>
      </header>
      <div className="space-y-4">
        <SettingsSection
          title="Profile"
          isOpen={activeSection === "profile"}
          onToggle={() => handleToggle("profile")}
        >
          <ProfileSettings
            initialNickname={profile?.nickname ?? null}
            initialAvatarUrl={profile?.avatar_url ?? null}
            email={email}
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
