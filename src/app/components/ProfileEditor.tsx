"use client";

import { useState, type FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAvatarUrl } from "../../lib/avatar";

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

type ProfileEditorProps = {
  mode: "onboarding" | "settings";
  initialNickname: string | null;
  initialAvatarName: string | null;
  onSuccess?: () => void; // settings 模式：保存成功回调
  nextPath?: string; // onboarding 模式：保存后跳转路径
};

export default function ProfileEditor({
  mode,
  initialNickname,
  initialAvatarName,
  onSuccess,
  nextPath,
}: ProfileEditorProps) {
  const router = useRouter();
  const isOnboarding = mode === "onboarding";

  // If nickname is "Me" or empty, use empty string for settings; onboarding uses "Me" as default
  const defaultNickname =
    isOnboarding
      ? initialNickname || "Me"
      : initialNickname && initialNickname !== "Me"
        ? initialNickname
        : "";
  const defaultAvatar = initialAvatarName || "default";

  const [isEditing, setIsEditing] = useState(isOnboarding); // onboarding 始终编辑，settings 初始 false
  const [currentAvatar, setCurrentAvatar] = useState(defaultAvatar);
  const [currentNickname, setCurrentNickname] = useState(defaultNickname);
  const [nickname, setNickname] = useState(defaultNickname);
  const [selectedAvatar, setSelectedAvatar] = useState(defaultAvatar);
  const [displayAvatars, setDisplayAvatars] = useState(getRandomAvatars(5));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [isSaving, setIsSaving] = useState(false);

  // 显示的头像：编辑模式下显示选中头像，否则显示当前头像
  const displayAvatar = isEditing ? selectedAvatar : currentAvatar;

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
          errorMessage = response.statusText || errorMessage;
        }
        setStatusTone("error");
        setStatusMessage(errorMessage);
        setIsSaving(false);
        return;
      }

      // Update current values
      setCurrentAvatar(selectedAvatar);
      setCurrentNickname(trimmedNickname);

      if (isOnboarding) {
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

        // Redirect to next path
        if (nextPath) {
          router.replace(nextPath);
        }
      } else {
        // Settings mode: exit editing and show success message
        setIsEditing(false);
        setStatusTone("success");
        setStatusMessage("Profile saved successfully.");
        setTimeout(() => {
          setStatusMessage(null);
        }, 3000);
        onSuccess?.();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusTone("error");
      setStatusMessage(`Could not save your profile: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!isOnboarding) {
      return; // Skip only available in onboarding mode
    }

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

      // Redirect to next path
      if (nextPath) {
        router.replace(nextPath);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatusTone("error");
      setStatusMessage(`Could not save your profile: ${message}`);
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isOnboarding) {
      return; // Cancel only available in settings mode
    }
    setIsEditing(false);
    setSelectedAvatar(currentAvatar);
    setNickname(currentNickname);
    setStatusMessage(null);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {/* Settings 模式：显示当前头像区域 */}
      {!isOnboarding && !isEditing && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <img
              src={getAvatarUrl(displayAvatar)}
              alt="Current avatar"
              className="w-24 h-24 rounded-full border-2 border-border dark:border-border-dark"
              onError={(event) => {
                const target = event.currentTarget;
                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect fill='%23ddd' width='96' height='96'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='32'%3E" +
                  (currentNickname?.charAt(0).toUpperCase() || "?") +
                  "%3C/text%3E%3C/svg%3E";
              }}
            />
          </div>
          {currentNickname && currentNickname !== "Me" && (
            <p className="text-base font-medium text-gray-900 dark:text-gray-100 m-0">
              {currentNickname}
            </p>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light rounded-pill font-semibold text-sm hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
          >
            Edit
          </button>
        </div>
      )}

      {/* 编辑模式：显示表单（settings 模式在 isEditing=true 时，onboarding 模式始终显示） */}
      {isEditing && (
        <>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Nickname</span>
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder={isOnboarding ? "Me" : "Nickname"}
              maxLength={50}
              className="px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:border-border-dark dark:text-gray-200"
            />
          </label>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Avatar</span>
            {/* Settings 模式：显示当前头像预览（编辑时显示选中头像） */}
            {!isOnboarding && (
              <div className="flex justify-center mb-2">
                <img
                  src={getAvatarUrl(displayAvatar)}
                  alt="Avatar preview"
                  className="w-20 h-20 rounded-full border-2 border-primary dark:border-primary-dark"
                  onError={(event) => {
                    const target = event.currentTarget;
                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect fill='%23ddd' width='80' height='80'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='24'%3E" +
                      (nickname?.charAt(0).toUpperCase() || "?") +
                      "%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>
            )}
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
                    src={getAvatarUrl(avatar)}
                    alt={avatar}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(event) => {
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
        </>
      )}

      {statusMessage ? (
        <p
          className={`m-0 text-sm ${
            statusTone === "error"
              ? "text-error dark:text-error-dark"
              : "text-green-600 dark:text-green-400"
          }`}
          role={statusTone === "error" ? "alert" : undefined}
        >
          {statusMessage}
        </p>
      ) : null}

      {/* 按钮区域 */}
      {isEditing ? (
        <div className="flex gap-3">
          {isOnboarding ? (
            <>
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
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 px-4 py-3 border border-border dark:border-border-dark text-gray-700 dark:text-gray-300 font-semibold rounded-pill hover:bg-gray-50 dark:hover:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-primary text-white font-semibold rounded-pill hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 dark:bg-primary-dark dark:text-gray-900 dark:hover:bg-gray-200"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}
