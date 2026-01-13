"use client";

import ProfileEditor from "./ProfileEditor";

type ProfileSettingsProps = {
  initialNickname: string | null;
  initialAvatarName: string | null;
};

export default function ProfileSettings({
  initialNickname,
  initialAvatarName,
}: ProfileSettingsProps) {
  return (
    <ProfileEditor
      mode="settings"
      initialNickname={initialNickname}
      initialAvatarName={initialAvatarName}
      onSuccess={() => {
        // Success message is handled by ProfileEditor
      }}
    />
  );
}
