"use client";

import ProfileEditor from "../../components/ProfileEditor";

type ProfileOnboardingClientProps = {
  initialNickname: string;
  initialAvatarName: string;
  nextPath: string;
};

export default function ProfileOnboardingClient({
  initialNickname,
  initialAvatarName,
  nextPath,
}: ProfileOnboardingClientProps) {
  return (
    <ProfileEditor
      mode="onboarding"
      initialNickname={initialNickname}
      initialAvatarName={initialAvatarName}
      nextPath={nextPath}
    />
  );
}
