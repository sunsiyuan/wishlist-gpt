"use client";

import { useEffect, useRef } from "react";

type ShareViewTrackerProps = {
  shareId: string;
};

export default function ShareViewTracker({ shareId }: ShareViewTrackerProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) {
      return;
    }
    hasTracked.current = true;

    void fetch("/api/track/share-view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ share_id: shareId }),
    });
  }, [shareId]);

  return null;
}
