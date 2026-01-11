"use client";

import { useEffect, useMemo, useState } from "react";
import FeedbackModal from "../../components/FeedbackModal";

type ToastState = {
  message: string;
  tone?: "default" | "error";
};

type ShareFeedbackEntryProps = {
  shareId: string;
  intent?: string | null;
};

const TOAST_DURATION_MS = 4000;

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${
        toast.tone === "error" ? "bg-red-950" : "bg-primary dark:bg-primary-dark"
      } text-white py-2.5 px-4 rounded-pill flex items-center gap-3 shadow-toast dark:shadow-toast-dark z-[80]`}
    >
      <span className="text-sm">{toast.message}</span>
    </div>
  );
}

export default function ShareFeedbackEntry({ shareId, intent }: ShareFeedbackEntryProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const feedbackContext = useMemo(
    () => ({
      page: "/s/:share_id",
      share_id: shareId,
    }),
    [shareId],
  );

  useEffect(() => {
    let isActive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((response) => {
        if (!isActive) {
          return;
        }
        setIsLoggedIn(response.ok);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setIsLoggedIn(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (intent !== "feedback" || !isLoggedIn) {
      return;
    }
    setIsModalOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("intent");
    window.history.replaceState({}, "", url.toString());
  }, [intent, isLoggedIn]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeoutId = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  const showToast = (nextToast: ToastState) => {
    setToast(nextToast);
  };

  const handleFeedbackClick = () => {
    if (isLoggedIn) {
      setIsModalOpen(true);
      return;
    }
    const nextPath = `/s/${shareId}?intent=feedback`;
    window.location.href = `/login?next=${encodeURIComponent(nextPath)}`;
  };

  return (
    <div className="mt-8 text-center">
      <button
        type="button"
        onClick={handleFeedbackClick}
        className="border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light rounded-pill px-6 py-2.5 cursor-pointer font-semibold hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
      >
        Feedback
      </button>
      <FeedbackModal
        isOpen={isModalOpen}
        context={feedbackContext}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => showToast({ message: "Thanks — received." })}
        onRateLimit={() =>
          showToast({ message: "Too fast — try again in a minute.", tone: "error" })
        }
        onError={() => showToast({ message: "Couldn't send. Try again.", tone: "error" })}
      />
      {toast ? <Toast toast={toast} /> : null}
    </div>
  );
}
