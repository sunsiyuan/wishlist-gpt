"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FeedbackModal from "../components/FeedbackModal";
import {
  getCardTitle,
  getCoverFallbackLabel,
  getLogoFallbackText,
  getNotePreview,
  getPriceText,
  getSourceUrl,
  resolveDomain,
  shouldRenderMerchantLogo,
  shouldShowPriceRow,
} from "../../lib/itemDisplay";

export type AppItem = {
  id: string;
  url_original: string;
  created_at: string;
  updated_at: string;
  personal_note: string | null;
  display_cover_image_url: string | null;
  display_product_title: string | null;
  display_merchant_logo_url: string | null;
  display_merchant_domain: string | null;
  display_price_amount_minor: number | null;
  display_currency: string | null;
  display_price_text: string | null;
  display_price_updated_at: string | null;
};

type AppClientProps = {
  items: AppItem[];
  locale: string;
};

type ToastState = {
  message: string;
  tone?: "default" | "error";
  actionLabel?: string;
  onAction?: () => void;
};

type ShareState = {
  shareId: string | null;
  shareUrl: string | null;
  isRevoked: boolean;
};

const PRICE_TOOLTIP = "Price may change";
const RETURN_URL_FALLBACK = "https://chatgpt.com";
const SCROLL_THRESHOLD = 16;
const TOAST_DURATION_MS = 4000;

const NOTE_PLACEHOLDER = "Add a note…";
const FEEDBACK_CONTEXT_APP = { page: "/app" };

function isMobileLike(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  if ("userAgentData" in navigator) {
    const data = navigator.userAgentData as { mobile?: boolean };
    if (typeof data.mobile === "boolean") {
      return data.mobile;
    }
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function openSourceUrl(url: string) {
  if (isMobileLike()) {
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function returnToChatGPT() {
  if (typeof document === "undefined") {
    return;
  }
  const referrer = document.referrer;
  if (referrer && /chatgpt\.com|chat\.openai\.com/i.test(referrer)) {
    window.location.href = referrer;
    return;
  }
  window.location.href = RETURN_URL_FALLBACK;
}

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: "88px",
        left: "50%",
        transform: "translateX(-50%)",
        background: toast.tone === "error" ? "#2f1518" : "#111",
        color: "#fff",
        padding: "0.75rem 1rem",
        borderRadius: "999px",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        boxShadow: "0 12px 24px rgba(0, 0, 0, 0.2)",
        zIndex: 60,
      }}
    >
      <span style={{ fontSize: "0.95rem" }}>{toast.message}</span>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          onClick={toast.onAction}
          style={{
            border: "none",
            background: "transparent",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function OverflowMenuPopover({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        ref={buttonRef}
        aria-label="More actions"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "999px",
          border: "1px solid #ececec",
          background: "#fff",
          cursor: "pointer",
          fontSize: "1.2rem",
          lineHeight: 1,
        }}
      >
        ⋯
      </button>
      {open ? (
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            right: 0,
            top: "40px",
            background: "#fff",
            border: "1px solid #ececec",
            borderRadius: "12px",
            minWidth: "140px",
            boxShadow: "0 12px 24px rgba(0, 0, 0, 0.12)",
            zIndex: 20,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            style={{
              width: "100%",
              padding: "0.6rem 0.85rem",
              textAlign: "left",
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Edit note
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            style={{
              width: "100%",
              padding: "0.6rem 0.85rem",
              textAlign: "left",
              border: "none",
              background: "transparent",
              color: "#c0262d",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AppClient({ items: initialItems, locale }: AppClientProps) {
  const [items, setItems] = useState<AppItem[]>(initialItems);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isCheatsheetOpen, setIsCheatsheetOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareState, setShareState] = useState<ShareState>({
    shareId: null,
    shareUrl: null,
    isRevoked: false,
  });
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showReturnButton, setShowReturnButton] = useState(true);
  const lastDeletedRef = useRef<AppItem | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusNoteRef = useRef(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollStateRef = useRef({ lastY: 0, ticking: false });

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) ?? null,
    [items, activeItemId],
  );

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (timeA === timeB) {
        return sortOrder === "asc"
          ? a.id.localeCompare(b.id)
          : b.id.localeCompare(a.id);
      }
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
    return sorted;
  }, [items, sortOrder]);

  useEffect(() => {
    if (activeItem) {
      setNoteDraft(activeItem.personal_note ?? "");
    }
  }, [activeItem]);

  useEffect(() => {
    if (!activeItem || !focusNoteRef.current) {
      return;
    }
    focusNoteRef.current = false;
    noteInputRef.current?.focus();
  }, [activeItem]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      lastDeletedRef.current = null;
    }, TOAST_DURATION_MS);
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [toast]);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollStateRef.current.ticking) {
        return;
      }
      scrollStateRef.current.ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - scrollStateRef.current.lastY;
        if (Math.abs(delta) > SCROLL_THRESHOLD) {
          setShowReturnButton(delta < 0 || currentY < 24);
          scrollStateRef.current.lastY = currentY;
        }
        scrollStateRef.current.ticking = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const showToast = useCallback((nextToast: ToastState) => {
    setToast(nextToast);
  }, []);

  const restoreInState = useCallback((item: AppItem) => {
    setItems((prev) => {
      if (prev.some((existing) => existing.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
  }, []);

  const handleDelete = useCallback(
    async (item: AppItem, closeSheet?: boolean) => {
      setItems((prev) => prev.filter((existing) => existing.id !== item.id));
      try {
        const response = await fetch(`/api/items/${item.id}/delete`, {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error("delete_failed");
        }
        lastDeletedRef.current = item;
        showToast({
          message: "Item deleted.",
          actionLabel: "Undo",
          onAction: async () => {
            const target = lastDeletedRef.current;
            if (!target) {
              return;
            }
            try {
              const restoreResponse = await fetch(`/api/items/${target.id}/restore`, {
                method: "POST",
              });
              if (!restoreResponse.ok) {
                throw new Error("restore_failed");
              }
              restoreInState(target);
              lastDeletedRef.current = null;
              setToast(null);
            } catch (error) {
              showToast({ message: "Couldn’t restore. Try again.", tone: "error" });
            }
          },
        });
        if (closeSheet) {
          setActiveItemId(null);
        }
      } catch (error) {
        restoreInState(item);
        showToast({ message: "Couldn’t delete. Try again.", tone: "error" });
      }
    },
    [restoreInState, showToast],
  );

  const handleSaveNote = useCallback(async () => {
    if (!activeItem) {
      return;
    }
    const nextNote = noteDraft.trim();
    const noteValue = nextNote.length > 0 ? nextNote : null;
    try {
      const response = await fetch(`/api/items/${activeItem.id}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personal_note: noteValue }),
      });
      if (!response.ok) {
        throw new Error("note_failed");
      }
      const data = (await response.json()) as {
        item: { id: string; personal_note: string | null };
      };
      setItems((prev) =>
        prev.map((item) =>
          item.id === activeItem.id
            ? { ...item, personal_note: data.item.personal_note }
            : item,
        ),
      );
      setNoteDraft(data.item.personal_note ?? "");
      showToast({ message: "Note saved." });
    } catch (error) {
      showToast({ message: "Couldn’t save note. Try again.", tone: "error" });
    }
  }, [activeItem, noteDraft, showToast]);

  const ensureShare = useCallback(async () => {
    setShareStatus(null);
    setShareError(null);
    try {
      const response = await fetch("/api/shares", { method: "POST" });
      if (!response.ok) {
        throw new Error("share_failed");
      }
      const data = (await response.json()) as { share_id: string; share_url: string };
      setShareState({ shareId: data.share_id, shareUrl: data.share_url, isRevoked: false });
    } catch (error) {
      setShareError("Couldn’t create a share link.");
    }
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!shareState.shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareState.shareUrl);
      setShareStatus("Link copied.");
    } catch (error) {
      setShareStatus("Link ready to copy.");
    }
  }, [shareState.shareUrl]);

  const handleShareSystem = useCallback(async () => {
    if (!shareState.shareUrl) {
      return;
    }
    try {
      await navigator.share({ title: "WishlistGPT", url: shareState.shareUrl });
    } catch (error) {
      setShareStatus("Share canceled.");
    }
  }, [shareState.shareUrl]);

  const handleRevoke = useCallback(async () => {
    if (!shareState.shareId) {
      return;
    }
    setShareStatus(null);
    setShareError(null);
    try {
      const response = await fetch(`/api/shares/${shareState.shareId}/revoke`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("revoke_failed");
      }
      setShareState({ shareId: null, shareUrl: null, isRevoked: true });
      setShareStatus("This link is disabled.");
    } catch (error) {
      setShareError("Couldn’t revoke the link.");
    }
  }, [shareState.shareId]);

  const handleGenerateNewLink = useCallback(async () => {
    await ensureShare();
  }, [ensureShare]);

  const handleOpenShare = useCallback(async () => {
    setIsShareOpen(true);
    setShareStatus(null);
    setShareError(null);
    if (!shareState.shareId || shareState.isRevoked) {
      await ensureShare();
    }
  }, [ensureShare, shareState.isRevoked, shareState.shareId]);

  const handleEditNote = useCallback((item: AppItem) => {
    focusNoteRef.current = true;
    setActiveItemId(item.id);
  }, []);

  const handleCardOpen = useCallback((item: AppItem) => {
    setActiveItemId(item.id);
  }, []);

  const hasItems = items.length > 0;
  const activeItemSourceUrl = activeItem ? getSourceUrl(activeItem) : null;
  const activePriceText = activeItem ? getPriceText(activeItem, locale) : null;
  const isNoteDirty =
    activeItem !== null && noteDraft !== (activeItem.personal_note ?? "");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f7f7",
        color: "#111",
        paddingBottom: "7rem",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "1.5rem 1.25rem 0" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h1 style={{ fontSize: "1.4rem", margin: 0 }}>WishlistGPT</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setIsCheatsheetOpen(true)}
              style={{
                border: "none",
                background: "transparent",
                color: "#6b6b6b",
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Cheatsheet
            </button>
            <a
              href="/app/settings"
              aria-label="Settings"
              style={{
                textDecoration: "none",
                color: "#6b6b6b",
                fontSize: "1.1rem",
              }}
            >
              ⚙️
            </a>
          </div>
        </header>
        <section
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            style={{
              border: "1px solid #e3e3e3",
              background: "#fff",
              borderRadius: "999px",
              padding: "0.4rem 0.9rem",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            {sortOrder === "desc" ? "Newest" : "Oldest"}
          </button>
          <button
            type="button"
            onClick={handleOpenShare}
            style={{
              border: "none",
              background: "#111",
              color: "#fff",
              borderRadius: "999px",
              padding: "0.45rem 1.2rem",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontWeight: 600,
            }}
          >
            Share
          </button>
        </section>
        {!hasItems ? (
          <div
            style={{
              textAlign: "center",
              background: "#fff",
              borderRadius: "18px",
              padding: "2.5rem 1.5rem",
              boxShadow: "0 12px 24px rgba(17, 17, 17, 0.08)",
            }}
          >
            <p style={{ color: "#555", marginBottom: "1.25rem" }}>
              Add items in ChatGPT. Tap here for Cheatsheet.
            </p>
            <button
              type="button"
              onClick={() => setIsCheatsheetOpen(true)}
              style={{
                border: "none",
                background: "#111",
                color: "#fff",
                borderRadius: "999px",
                padding: "0.75rem 1.5rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Open Cheatsheet
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {sortedItems.map((item) => {
              const title = getCardTitle(item);
              const priceText = getPriceText(item, locale);
              const showPriceRow = shouldShowPriceRow(item) && priceText;
              const notePreview = getNotePreview(item);
              const logoFallback = getLogoFallbackText(item);
              const domain = resolveDomain(item);
              const shouldShowLogo = shouldRenderMerchantLogo(item);
              return (
                <article
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardOpen(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleCardOpen(item);
                    }
                  }}
                  style={{
                    background: "#fff",
                    borderRadius: "18px",
                    padding: "1rem",
                    boxShadow: "0 10px 24px rgba(17, 17, 17, 0.08)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <div
                      style={{
                        width: "96px",
                        height: "96px",
                        borderRadius: "16px",
                        background: "#f0f0f0",
                        overflow: "hidden",
                        flexShrink: 0,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ color: "#b6b6b6", fontSize: "0.75rem" }}>
                        {getCoverFallbackLabel(item)}
                      </span>
                      {item.display_cover_image_url ? (
                        <img
                          src={item.display_cover_image_url}
                          alt={title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            position: "absolute",
                            inset: 0,
                          }}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "0.75rem",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {shouldShowLogo ? (
                              <div
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  borderRadius: "50%",
                                  border: "1px solid #eee",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "0.65rem",
                                  color: "#6b6b6b",
                                  position: "relative",
                                  background: "#fff",
                                  overflow: "hidden",
                                  flexShrink: 0,
                                }}
                                aria-label={domain ?? "Merchant"}
                              >
                                <span>{logoFallback}</span>
                                <img
                                  src={item.display_merchant_logo_url ?? ""}
                                  alt={domain ?? "Merchant"}
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                  }}
                                  onError={(event) => {
                                    event.currentTarget.onerror = null;
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            ) : null}
                            <h2
                              style={{
                                fontSize: "1rem",
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {title}
                            </h2>
                          </div>
                          {showPriceRow ? (
                            <div style={{ marginTop: "0.35rem", color: "#4a4a4a" }}>
                              <span>{priceText}</span>
                              <span
                                title={PRICE_TOOLTIP}
                                style={{ marginLeft: "0.4rem", color: "#8b8b8b" }}
                              >
                                ?
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div onClick={(event) => event.stopPropagation()}>
                          <OverflowMenuPopover
                            onEdit={() => handleEditNote(item)}
                            onDelete={() => handleDelete(item)}
                          />
                        </div>
                      </div>
                      <p
                        style={{
                          marginTop: "0.6rem",
                          color: notePreview.isPlaceholder ? "#9a9a9a" : "#3d3d3d",
                          fontSize: "0.9rem",
                        }}
                      >
                        {notePreview.text}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {activeItem ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 40,
          }}
          onClick={() => setActiveItemId(null)}
        >
          <div
            style={{
              width: "100%",
              height: "70vh",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderTopLeftRadius: "24px",
              borderTopRightRadius: "24px",
              padding: "1.5rem",
              boxShadow: "0 -12px 24px rgba(0,0,0,0.2)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "20px",
                  background: "#f0f0f0",
                  overflow: "hidden",
                  flexShrink: 0,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "#b6b6b6", fontSize: "0.8rem" }}>
                  {getCoverFallbackLabel(activeItem)}
                </span>
                {activeItem.display_cover_image_url ? (
                  <img
                    src={activeItem.display_cover_image_url}
                    alt={getCardTitle(activeItem)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      position: "absolute",
                      inset: 0,
                    }}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {shouldRenderMerchantLogo(activeItem) ? (
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        border: "1px solid #eee",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        color: "#6b6b6b",
                        position: "relative",
                        background: "#fff",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                      aria-label={resolveDomain(activeItem) ?? "Merchant"}
                    >
                      <span>{getLogoFallbackText(activeItem)}</span>
                      <img
                        src={activeItem.display_merchant_logo_url ?? ""}
                        alt={resolveDomain(activeItem) ?? "Merchant"}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  ) : null}
                  <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{getCardTitle(activeItem)}</h2>
                </div>
                {shouldShowPriceRow(activeItem) && activePriceText ? (
                  <div style={{ marginTop: "0.4rem", color: "#4a4a4a" }}>
                    <span>{activePriceText}</span>
                    <span title={PRICE_TOOLTIP} style={{ marginLeft: "0.4rem", color: "#8b8b8b" }}>
                      ?
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <label style={{ display: "block", fontSize: "0.9rem", color: "#6b6b6b" }}>
              Personal note
            </label>
            <textarea
              ref={noteInputRef}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder={NOTE_PLACEHOLDER}
              rows={3}
              style={{
                width: "100%",
                marginTop: "0.5rem",
                borderRadius: "12px",
                border: "1px solid #e3e3e3",
                padding: "0.75rem",
                fontSize: "0.95rem",
                fontFamily: "inherit",
              }}
            />
            {isNoteDirty ? (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  style={{
                    border: "1px solid #e3e3e3",
                    background: "#fff",
                    borderRadius: "999px",
                    padding: "0.4rem 1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#111",
                    fontSize: "0.85rem",
                  }}
                >
                  Save
                </button>
              </div>
            ) : null}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => {
                  if (activeItemSourceUrl) {
                    openSourceUrl(activeItemSourceUrl);
                  }
                }}
                style={{
                  flex: 1,
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "0.75rem",
                  fontWeight: 600,
                  cursor: activeItemSourceUrl ? "pointer" : "not-allowed",
                  opacity: activeItemSourceUrl ? 1 : 0.6,
                }}
                disabled={!activeItemSourceUrl}
              >
                {activeItemSourceUrl ? "View on website" : "Link unavailable"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(activeItem, true)}
              style={{
                width: "100%",
                marginTop: "0.75rem",
                border: "none",
                background: "transparent",
                color: "#b4232a",
                padding: "0.4rem",
                fontWeight: 600,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}

      {isCheatsheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 50,
          }}
          onClick={() => setIsCheatsheetOpen(false)}
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
            <p style={{ color: "#6b6b6b", marginBottom: "0.75rem" }}>
              Add items in ChatGPT, then review them here.
            </p>
            <ul style={{ paddingLeft: "1.2rem", color: "#4a4a4a" }}>
              <li>Tell GPT what you want and it appears in your list.</li>
              <li>Tap an item to add a note or decide.</li>
              <li>Share a read-only list anytime.</li>
              <li>Send feedback any time.</li>
            </ul>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={() => setIsCheatsheetOpen(false)}
                style={{
                  flex: 1,
                  border: "1px solid #e3e3e3",
                  background: "#fff",
                  borderRadius: "999px",
                  padding: "0.75rem",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Got it
              </button>
              <button
                type="button"
                onClick={returnToChatGPT}
                style={{
                  flex: 1,
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "0.75rem",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Back to GPT
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              style={{
                width: "100%",
                marginTop: "0.75rem",
                border: "none",
                background: "transparent",
                color: "#111",
                padding: "0.4rem",
                fontWeight: 600,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Send feedback
            </button>
          </div>
        </div>
      ) : null}

      {isShareOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 55,
          }}
          onClick={() => setIsShareOpen(false)}
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
              <h2 style={{ margin: 0 }}>Share list</h2>
              <button
                type="button"
                onClick={() => setIsShareOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ marginTop: "1rem" }}>
              {shareState.shareUrl && !shareState.isRevoked ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    background: "#f5f5f5",
                    borderRadius: "12px",
                    padding: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: "0.9rem",
                      color: "#444",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {shareState.shareUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      border: "none",
                      background: "#111",
                      color: "#fff",
                      borderRadius: "999px",
                      padding: "0.4rem 0.9rem",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    Copy link
                  </button>
                </div>
              ) : (
                <div style={{ color: "#6b6b6b" }}>This link is disabled.</div>
              )}
            </div>
            {shareState.shareUrl && !shareState.isRevoked ? (
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                {typeof navigator !== "undefined" && "share" in navigator ? (
                  <button
                    type="button"
                    onClick={handleShareSystem}
                    style={{
                      flex: 1,
                      border: "1px solid #e3e3e3",
                      background: "#fff",
                      borderRadius: "999px",
                      padding: "0.75rem",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Share…
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleRevoke}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "#fce8ea",
                    color: "#b4232a",
                    borderRadius: "999px",
                    padding: "0.75rem",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Revoke link
                </button>
              </div>
            ) : (
              <div style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={handleGenerateNewLink}
                  style={{
                    border: "none",
                    background: "#111",
                    color: "#fff",
                    borderRadius: "999px",
                    padding: "0.75rem 1.5rem",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Generate new link
                </button>
              </div>
            )}
            {shareStatus ? (
              <p style={{ marginTop: "0.75rem", color: "#4a4a4a" }}>{shareStatus}</p>
            ) : null}
            {shareError ? (
              <p style={{ marginTop: "0.75rem", color: "#b4232a" }}>{shareError}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Return to ChatGPT"
        onClick={returnToChatGPT}
        style={{
          position: "fixed",
          right: "20px",
          bottom: "20px",
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          border: "none",
          background: "#111",
          color: "#fff",
          display: showReturnButton ? "flex" : "none",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
          cursor: "pointer",
          zIndex: 70,
        }}
        title="Return to ChatGPT"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 4h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-4l-4 4v-4H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9 10h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M9 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {toast ? <Toast toast={toast} /> : null}

      <FeedbackModal
        isOpen={isFeedbackOpen}
        context={FEEDBACK_CONTEXT_APP}
        onClose={() => {
          setIsFeedbackOpen(false);
          setIsCheatsheetOpen(false);
        }}
        onSuccess={() => {
          showToast({ message: "Thanks — received." });
          setIsCheatsheetOpen(false);
        }}
        onRateLimit={() => {
          showToast({ message: "Too fast — try again in a minute.", tone: "error" });
          setIsCheatsheetOpen(false);
        }}
        onError={() => {
          showToast({ message: "Couldn’t send. Try again.", tone: "error" });
          setIsCheatsheetOpen(false);
        }}
      />
    </div>
  );
}
