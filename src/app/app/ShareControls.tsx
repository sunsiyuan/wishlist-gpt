"use client";

import { useState } from "react";

type ShareResponse = {
  share_id: string;
  share_url: string;
};

const LOGIN_MESSAGE = "登录已失效，请重新登录。";
const GENERIC_ERROR_MESSAGE = "分享链接操作失败，请稍后再试。";

export default function ShareControls() {
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setStatusMessage("链接已复制到剪贴板。");
      setErrorMessage(null);
    } catch (error) {
      setStatusMessage("链接已生成，可手动复制。");
      setErrorMessage(null);
    }
  };

  const handleShare = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/shares", { method: "POST" });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setErrorMessage(LOGIN_MESSAGE);
          return;
        }
        console.error("Share request failed", response.status);
        setErrorMessage(GENERIC_ERROR_MESSAGE);
        return;
      }

      const data = (await response.json()) as ShareResponse;
      setShareId(data.share_id);
      setShareUrl(data.share_url);
      await handleCopy(data.share_url);
    } catch (error) {
      console.error("Share request error", error);
      setErrorMessage(GENERIC_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!shareId) {
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/shares/${shareId}/revoke`, {
        method: "POST",
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setErrorMessage(LOGIN_MESSAGE);
          return;
        }
        console.error("Revoke request failed", response.status);
        setErrorMessage(GENERIC_ERROR_MESSAGE);
        return;
      }

      setShareId(null);
      setShareUrl(null);
      setStatusMessage("分享链接已失效。");
    } catch (error) {
      console.error("Revoke request error", error);
      setErrorMessage(GENERIC_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold mb-2">Share</h2>
      <p className="text-secondary dark:text-secondary-dark mb-4">生成只读分享链接，并复制到剪贴板。</p>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleShare}
          disabled={isLoading}
          className="px-4 py-2 bg-primary text-white dark:bg-primary-dark dark:text-black rounded-button font-semibold hover:bg-primary/90 dark:hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          Share
        </button>
        {shareId ? (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isLoading}
            className="px-4 py-2 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light rounded-button font-semibold hover:bg-background dark:hover:bg-background-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Revoke
          </button>
        ) : null}
      </div>
      {shareUrl ? (
        <div className="mt-3 flex gap-2 flex-wrap">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="min-w-[260px] flex-grow px-4 py-2 border border-border dark:border-border-dark rounded-card bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark"
          />
          <button
            type="button"
            onClick={() => handleCopy(shareUrl)}
            className="px-4 py-2 bg-primary text-white dark:bg-primary-dark dark:text-black rounded-button font-semibold hover:bg-primary/90 dark:hover:bg-white/90 transition-colors duration-200"
          >
            Copy
          </button>
        </div>
      ) : null}
      {statusMessage ? <p className="mt-2 text-secondary dark:text-secondary-dark">{statusMessage}</p> : null}
      {errorMessage ? (
        <p className="mt-2 text-error dark:text-error-dark">{errorMessage}</p>
      ) : null}
    </section>
  );
}
