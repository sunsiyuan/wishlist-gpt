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
    <section style={{ marginTop: "2rem" }}>
      <h2>Share</h2>
      <p>生成只读分享链接，并复制到剪贴板。</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={handleShare} disabled={isLoading}>
          Share
        </button>
        {shareId ? (
          <button type="button" onClick={handleRevoke} disabled={isLoading}>
            Revoke
          </button>
        ) : null}
      </div>
      {shareUrl ? (
        <div
          style={{
            marginTop: "0.75rem",
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            readOnly
            value={shareUrl}
            style={{ minWidth: "260px", flexGrow: 1 }}
          />
          <button type="button" onClick={() => handleCopy(shareUrl)}>
            Copy
          </button>
        </div>
      ) : null}
      {statusMessage ? (
        <p style={{ marginTop: "0.5rem" }}>{statusMessage}</p>
      ) : null}
      {errorMessage ? (
        <p style={{ marginTop: "0.5rem", color: "#b00020" }}>
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
