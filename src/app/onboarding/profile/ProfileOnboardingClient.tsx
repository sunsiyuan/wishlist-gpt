"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// Tapback avatar names (sample list - in production, this should come from Tapback API or config)
const TAPBACK_AVATARS = [
  "cat",
  "dog",
  "panda",
  "rabbit",
  "fox",
  "bear",
  "tiger",
  "lion",
  "elephant",
  "monkey",
  "penguin",
  "owl",
  "frog",
  "butterfly",
  "dolphin",
];

function getRandomAvatars(count: number = 5): string[] {
  const shuffled = [...TAPBACK_AVATARS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

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
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatarName);
  const [displayAvatars, setDisplayAvatars] = useState(getRandomAvatars(5));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [isSaving, setIsSaving] = useState(false);

  const handleTryMore = () => {
    setDisplayAvatars(getRandomAvatars(5));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setStatusTone("error");
      setStatusMessage("Nickname cannot be empty.");
      return;
    }

    if (!selectedAvatar) {
      setStatusTone("error");
      setStatusMessage("Please select an avatar.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: trimmedNickname,
          avatar_name: selectedAvatar,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Could not save your profile. Please try again.";
        try {
          const data = await response.json();
          errorMessage = data.error?.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        setStatusTone("error");
        setStatusMessage(errorMessage);
        setIsSaving(false);
        return;
      }

      // Track onboarding completion
      fetch("/api/track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "web.profile.onboarding_complete",
          meta: {
            has_skipped: false,
            request_id: crypto.randomUUID(),
          },
        }),
      }).catch(() => {
        // Best effort, ignore errors
      });

      router.replace(nextPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusTone("error");
      setStatusMessage(`Could not save your profile: ${message}`);
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    // Skip still saves default values
    const defaultNickname = "Me";
    const defaultAvatar = displayAvatars[0] || "default";

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: defaultNickname,
          avatar_name: defaultAvatar,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Could not save your profile. Please try again.";
        try {
          const data = await response.json();
          errorMessage = data.error?.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        setStatusTone("error");
        setStatusMessage(errorMessage);
        setIsSaving(false);
        return;
      }

      // Track onboarding completion (skipped)
      fetch("/api/track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "web.profile.onboarding_complete",
          meta: {
            has_skipped: true,
            request_id: crypto.randomUUID(),
          },
        }),
      }).catch(() => {
        // Best effort, ignore errors
      });

      router.replace(nextPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusTone("error");
      setStatusMessage(`Could not save your profile: ${message}`);
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <label className="grid gap-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Nickname</span>
        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Me"
          maxLength={50}
          className="px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-gray-200"
        />
      </label>

      <div className="grid gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Avatar</span>
        <div className="grid grid-cols-5 gap-3">
          {displayAvatars.map((avatar) => (
            <button
              key={avatar}
              type="button"
              onClick={() => setSelectedAvatar(avatar)}
              className={`aspect-square rounded-lg border-2 transition-all ${
                selectedAvatar === avatar
                  ? "border-primary dark:border-primary-dark ring-2 ring-primary dark:ring-primary-dark"
                  : "border-border dark:border-border-dark hover:border-primary/50 dark:hover:border-primary-dark/50"
              }`}
            >
              <img
                src={`https://tapback.co/api/avatar/${avatar}.webp`}
                alt={avatar}
                className="w-full h-full object-cover rounded-lg"
                onError={(event) => {
                  // Fallback to placeholder if image fails
                  const target = event.currentTarget;
                  target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3E" +
                    avatar.charAt(0).toUpperCase() +
                    "%3C/text%3E%3C/svg%3E";
                }}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleTryMore}
          className="text-sm text-primary dark:text-primary-dark hover:underline self-start"
        >
          Try 5 more
        </button>
      </div>

      {statusMessage ? (
        <p
          className={`m-0 ${statusTone === "error" ? "text-error dark:text-error-dark" : "text-success dark:text-success-dark"}`}
          role={statusTone === "error" ? "alert" : undefined}
        >
          {statusMessage}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isSaving}
          className="flex-1 px-4 py-3 border border-border dark:border-border-dark text-gray-700 dark:text-gray-300 font-semibold rounded-pill hover:bg-gray-50 dark:hover:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          Skip
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 px-4 py-3 bg-primary text-white font-semibold rounded-pill hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 dark:bg-primary-dark dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {isSaving ? "Saving..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
