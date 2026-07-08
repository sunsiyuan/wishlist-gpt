"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";

type ProfileEditorProps = {
  mode: "onboarding" | "settings";
  initialNickname: string | null;
  initialAvatarUrl: string | null;
  email: string | null;
  onSuccess?: () => void; // settings: called after a successful save
  nextPath?: string; // onboarding: where to go after saving
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export default function ProfileEditor({
  mode,
  initialNickname,
  initialAvatarUrl,
  email,
  onSuccess,
  nextPath,
}: ProfileEditorProps) {
  const router = useRouter();
  const isOnboarding = mode === "onboarding";
  const fileRef = useRef<HTMLInputElement | null>(null);

  const startNickname =
    initialNickname && initialNickname !== "Nickname" ? initialNickname : "";

  const [isEditing, setIsEditing] = useState(isOnboarding);
  const [nickname, setNickname] = useState(startNickname);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const showForm = isEditing;

  async function handlePhoto(file: File) {
    setIsUploading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ tone: "error", text: data?.error?.message ?? "Could not upload that photo." });
        return;
      }
      setAvatarUrl(data.avatar_url);
    } catch {
      setStatus({ tone: "error", text: "Could not upload that photo — try again." });
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    setIsUploading(true);
    try {
      await fetch("/api/profile/avatar", { method: "DELETE" });
      setAvatarUrl(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const trimmed = nickname.trim();
    if (!trimmed) {
      setStatus({ tone: "error", text: "Nickname can't be empty." });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus({ tone: "error", text: data?.error?.message ?? "Could not save your profile." });
        return;
      }
      if (isOnboarding) {
        fetch("/api/track/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_name: "web.profile.onboarding_complete",
            meta: { request_id: crypto.randomUUID() },
          }),
        }).catch(() => {});
        if (nextPath) router.replace(nextPath);
      } else {
        setIsEditing(false);
        setStatus({ tone: "success", text: "Profile saved." });
        setTimeout(() => setStatus(null), 3000);
        onSuccess?.();
      }
    } catch {
      setStatus({ tone: "error", text: "Could not save your profile." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {/* Settings, not editing: current avatar + Edit */}
      {!showForm ? (
        <div className="flex flex-col items-center gap-4 py-2">
          <Avatar avatarUrl={avatarUrl} nickname={startNickname} email={email} size={96} />
          {startNickname ? (
            <p className="m-0 text-base font-semibold">{startNickname}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 rounded-button border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-sm font-semibold hover:bg-background dark:hover:bg-background-dark transition-colors"
          >
            Edit
          </button>
        </div>
      ) : (
        <>
          {/* Avatar + upload */}
          <div className="flex items-center gap-4">
            <Avatar avatarUrl={avatarUrl} nickname={nickname} email={email} size={72} />
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-button border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-sm font-semibold hover:bg-background dark:hover:bg-background-dark transition-colors disabled:opacity-50"
                >
                  {isUploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    onClick={removePhoto}
                    disabled={isUploading}
                    className="px-3 py-2 rounded-button text-sm font-semibold text-secondary hover:text-primary dark:text-secondary-dark dark:hover:text-primary-dark transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <span className="text-xs text-secondary dark:text-secondary-dark">
                JPG, PNG, WebP or GIF · up to 2&nbsp;MB. Otherwise your initial is used.
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhoto(file);
              }}
            />
          </div>

          {/* Nickname */}
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-secondary dark:text-secondary-dark">
              Nickname
            </span>
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Your name"
              maxLength={50}
              className="px-3 py-2.5 rounded-button border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light dark:text-primary-dark focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </label>
        </>
      )}

      {status ? (
        <p
          className={`m-0 text-sm ${
            status.tone === "error"
              ? "text-error dark:text-error-dark"
              : "text-success dark:text-success-dark"
          }`}
          role={status.tone === "error" ? "alert" : undefined}
        >
          {status.text}
        </p>
      ) : null}

      {showForm ? (
        <div className="flex gap-3">
          {!isOnboarding ? (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setNickname(startNickname);
                setStatus(null);
              }}
              disabled={isSaving}
              className="flex-1 px-4 py-3 rounded-button border border-border dark:border-border-dark font-semibold hover:bg-background dark:hover:bg-background-dark transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 px-4 py-3 rounded-button bg-primary text-white dark:bg-primary-dark dark:text-black font-semibold hover:bg-primary/90 dark:hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving…" : isOnboarding ? "Continue" : "Save"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
