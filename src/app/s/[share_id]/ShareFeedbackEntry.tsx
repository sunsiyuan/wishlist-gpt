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
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: toast.tone === "error" ? "#2f1518" : "#111",
        color: "#fff",
        padding: "0.65rem 1rem",
        borderRadius: "999px",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "0 12px 24px rgba(0, 0, 0, 0.2)",
        zIndex: 80,
      }}
    >
      <span style={{ fontSize: "0.9rem" }}>{toast.message}</span>
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
    <div style={{ marginTop: "2rem", textAlign: "center" }}>
      <button
        type="button"
        onClick={handleFeedbackClick}
        style={{
          border: "1px solid #e3e3e3",
          background: "#fff",
          borderRadius: "999px",
          padding: "0.55rem 1.5rem",
          cursor: "pointer",
          fontWeight: 600,
        }}
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
        onError={() => showToast({ message: "Couldn’t send. Try again.", tone: "error" })}
      />
      {toast ? <Toast toast={toast} /> : null}
    </div>
  );
}
