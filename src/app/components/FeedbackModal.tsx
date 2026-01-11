"use client";

import { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

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
      className="fixed inset-0 bg-black/35 flex items-end z-[65]"
      onClick={onClose}
    >
      <div
        className="w-full bg-background-light dark:bg-background-dark-light rounded-t-[24px] p-6 shadow-modal dark:shadow-modal-dark"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="m-0 text-lg font-semibold">Send feedback</h2>
          <button
            type="button"
            onClick={onClose}
            className="border-none bg-transparent text-xl cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-background-dark rounded transition-colors duration-200"
            aria-label="Close feedback"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-2 text-secondary dark:text-secondary-dark text-sm">
          Share what worked or what was missing.
        </p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type your feedback..."
          rows={5}
          maxLength={MAX_MESSAGE_LENGTH}
          className="w-full mt-3 rounded-button border border-border dark:border-border-dark p-3 text-[0.95rem] font-inherit resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:text-gray-200"
        />
        <div className="flex justify-between items-center mt-2">
          <span
            className={`text-xs ${error ? "text-error dark:text-error-dark" : "text-secondary dark:text-secondary-dark"}`}
          >
            {error ?? `${remaining} characters left`}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="border-none bg-primary text-white rounded-pill px-5 py-2 cursor-pointer font-semibold disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:bg-primary-dark dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {isSubmitting ? "Sending..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
