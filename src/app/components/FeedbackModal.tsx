"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_MESSAGE_LENGTH = 1000;

type FeedbackContext = {
  page: string;
  share_id?: string;
  item_id?: string;
  source_url?: string;
};

type FeedbackModalProps = {
  isOpen: boolean;
  context: FeedbackContext;
  onClose: () => void;
  onSuccess: () => void;
  onRateLimit: () => void;
  onError: () => void;
};

export default function FeedbackModal({
  isOpen,
  context,
  onClose,
  onSuccess,
  onRateLimit,
  onError,
}: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setMessage("");
    setError(null);
    setIsSubmitting(false);
  }, [isOpen]);

  const remaining = useMemo(() => MAX_MESSAGE_LENGTH - message.length, [message]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please add a message.");
      return;
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setError("Message is too long.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          context,
        }),
      });

      if (response.ok) {
        onSuccess();
        onClose();
        return;
      }

      if (response.status === 429) {
        onRateLimit();
        return;
      }

      onError();
    } catch (fetchError) {
      onError();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 65,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          background: "#fff",
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          padding: "1.5rem",
          boxShadow: "0 -12px 24px rgba(0,0,0,0.2)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Send feedback</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "1.2rem",
              cursor: "pointer",
            }}
            aria-label="Close feedback"
          >
            ✕
          </button>
        </div>
        <p style={{ marginTop: "0.5rem", color: "#6b6b6b", fontSize: "0.9rem" }}>
          Share what worked or what was missing.
        </p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type your feedback..."
          rows={5}
          maxLength={MAX_MESSAGE_LENGTH}
          style={{
            width: "100%",
            marginTop: "0.75rem",
            borderRadius: "12px",
            border: "1px solid #e3e3e3",
            padding: "0.75rem",
            fontSize: "0.95rem",
            fontFamily: "inherit",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "0.5rem",
          }}
        >
          <span style={{ color: error ? "#b4232a" : "#6b6b6b", fontSize: "0.85rem" }}>
            {error ?? `${remaining} characters left`}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              border: "none",
              background: "#111",
              color: "#fff",
              borderRadius: "999px",
              padding: "0.45rem 1.2rem",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              fontWeight: 600,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Sending..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
