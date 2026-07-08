"use client";

import ProfileEditor from "../../components/ProfileEditor";

type ProfileOnboardingClientProps = {
  initialNickname: string;
  initialAvatarUrl: string | null;
  email: string | null;
  nextPath: string;
};

export default function ProfileOnboardingClient({
  initialNickname,
  initialAvatarUrl,
  email,
  nextPath,
}: ProfileOnboardingClientProps) {
  return (
    <ProfileEditor
      mode="onboarding"
      initialNickname={initialNickname}
      initialAvatarUrl={initialAvatarUrl}
      email={email}
      nextPath={nextPath}
    />
  );
}
