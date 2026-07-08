"use client";

import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

type EarlyAccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sourceUrl: string | null;
  context: "owner" | "share";
  surface: "card" | "sheet";
  intent: "buy" | "gift";
  itemId?: string;
};

function openSourceUrl(url: string) {
  if (typeof window === "undefined") {
    return;
  }
  const isMobileLike = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (isMobileLike) {
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function EarlyAccessModal({
  isOpen,
  onClose,
  sourceUrl,
  context,
  surface,
  intent,
  itemId,
}: EarlyAccessModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleJoinWaitlist = async () => {
    if (isSubmitting || !sourceUrl) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Track event
      const requestId = crypto.randomUUID();
      await fetch("/api/track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "web.ai.waitlist_join",
          meta: {
            context,
            surface,
            intent,
            item_id: itemId ?? null,
            source_url: sourceUrl ?? null,
            request_id: requestId,
          },
        }),
      });

      // Open source URL
      if (sourceUrl) {
        openSourceUrl(sourceUrl);
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error("Failed to join waitlist:", error);
      // Still open URL even if tracking fails
      if (sourceUrl) {
        openSourceUrl(sourceUrl);
      }
      onClose();
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
      className="fixed inset-0 bg-black/35 flex items-end md:items-center md:justify-center md:p-6 z-[65]"
      onClick={onClose}
    >
      <div
        className="w-full bg-background-light dark:bg-background-dark-light md:max-w-lg rounded-t-[24px] md:rounded-card p-6 shadow-modal dark:shadow-modal-dark"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="m-0 text-lg font-semibold">Early Access</h2>
          <button
            type="button"
            onClick={onClose}
            className="border-none bg-transparent text-xl cursor-pointer p-1 hover:bg-background dark:hover:bg-background-dark rounded transition-colors duration-200"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-2 text-secondary dark:text-secondary-dark text-sm">
          Gifting is coming soon — let an agent send this as a gift for you. Join the waitlist to be
          notified when it&apos;s available.
        </p>
        <button
          type="button"
          onClick={handleJoinWaitlist}
          disabled={isSubmitting || !sourceUrl}
          className="w-full mt-4 border-none bg-accent text-accent-fg rounded-button py-3 font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          {isSubmitting ? "Processing..." : "Join waitlist & continue on website"}
        </button>
      </div>
    </div>
  );
}
