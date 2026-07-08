"use client";

import ProfileEditor from "./ProfileEditor";

type ProfileSettingsProps = {
  initialNickname: string | null;
  initialAvatarUrl: string | null;
  email: string | null;
};

export default function ProfileSettings({
  initialNickname,
  initialAvatarUrl,
  email,
}: ProfileSettingsProps) {
  return (
    <ProfileEditor
      mode="settings"
      initialNickname={initialNickname}
      initialAvatarUrl={initialAvatarUrl}
      email={email}
      onSuccess={() => {
        // Success message is handled by ProfileEditor
      }}
    />
  );
}
