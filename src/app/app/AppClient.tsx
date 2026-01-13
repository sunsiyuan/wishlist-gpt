"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  XMarkIcon,
  Cog6ToothIcon,
  BarsArrowUpIcon,
  BarsArrowDownIcon,
  ShareIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  ChevronDownIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FeedbackModal from "../components/FeedbackModal";
import EarlyAccessModal from "../components/EarlyAccessModal";
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
  userProfile: { nickname: string; avatar_name: string } | null;
  initialListRef: string | null;
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
      className={`fixed bottom-[88px] left-1/2 -translate-x-1/2 ${
        toast.tone === "error" ? "bg-red-950" : "bg-primary dark:bg-primary-dark"
      } text-white py-3 px-4 rounded-pill flex items-center gap-3 shadow-toast dark:shadow-toast-dark z-[60]`}
    >
      <span className="text-[0.95rem]">{toast.message}</span>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          onClick={toast.onAction}
          className="border-none bg-transparent text-white font-semibold cursor-pointer hover:opacity-80 transition-opacity duration-200"
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
    <div className="relative">
      <button
        type="button"
        ref={buttonRef}
        aria-label="More actions"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="w-8 h-8 rounded-full border border-border-light bg-background-light dark:bg-background-dark-light dark:border-border-dark cursor-pointer text-xl leading-none hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
      >
        ⋯
      </button>
      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-10 bg-background-light dark:bg-background-dark-light border border-border-light dark:border-border-dark rounded-button min-w-[140px] shadow-[0_12px_24px_rgba(0,0,0,0.12)] dark:shadow-lg z-20"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="w-full py-2.5 px-3.5 text-left border-none bg-transparent cursor-pointer hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
          >
            Edit note
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full py-2.5 px-3.5 text-left border-none bg-transparent text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

type FollowWithOwner = {
  list_ref: string;
  owner: {
    nickname: string;
    avatar_name: string;
  };
};

export default function AppClient({
  items: initialItems,
  locale,
  userProfile,
  initialListRef,
}: AppClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentListRef = searchParams.get("list_ref") || initialListRef;

  const [items, setItems] = useState<AppItem[]>(initialItems);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isCheatsheetOpen, setIsCheatsheetOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEarlyAccessModalOpen, setIsEarlyAccessModalOpen] = useState(false);
  const [earlyAccessModalProps, setEarlyAccessModalProps] = useState<{
    sourceUrl: string | null;
    itemId: string;
  } | null>(null);
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

  // Switcher state
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [follows, setFollows] = useState<FollowWithOwner[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [currentOwner, setCurrentOwner] = useState<{ nickname: string; avatar_name: string } | null>(
    userProfile,
  );
  const [isFollowingView, setIsFollowingView] = useState(currentListRef !== null);
  const [sharingDisabled, setSharingDisabled] = useState(false);
  const [isLoadingFollowedItems, setIsLoadingFollowedItems] = useState(false);
  const focusNoteRef = useRef(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollStateRef = useRef({ lastY: 0, ticking: false });
  const switcherRef = useRef<HTMLDivElement | null>(null);

  // Close switcher when clicking outside
  useEffect(() => {
    if (!isSwitcherOpen) {
      return;
    }
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (switcherRef.current?.contains(target)) {
        return;
      }
      setIsSwitcherOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isSwitcherOpen]);

  // Load follows on mount
  useEffect(() => {
    fetch("/api/follows")
      .then((res) => res.json())
      .then((data) => {
        if (data.following) {
          setFollows(data.following);
          setFollowingCount(data.following_count || 0);
        }
      })
      .catch(() => {
        // Best effort, ignore errors
      });
  }, []);

  // Load followed list items when list_ref changes
  useEffect(() => {
    if (currentListRef && currentListRef.startsWith("u:")) {
      setIsFollowingView(true);
      setIsLoadingFollowedItems(true);
      setSharingDisabled(false);

      // Find owner info from follows
      const follow = follows.find((f) => f.list_ref === currentListRef);
      if (follow) {
        setCurrentOwner(follow.owner);
      }

      // Load items
      fetch(`/api/items?scope=followed&list_ref=${encodeURIComponent(currentListRef)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.sharing_disabled) {
            setSharingDisabled(true);
            setItems([]);
            if (data.owner) {
              setCurrentOwner(data.owner);
            }
          } else if (data.items) {
            setItems(data.items);
            setSharingDisabled(false);
          } else {
            setItems([]);
          }
        })
        .catch(() => {
          setItems([]);
        })
        .finally(() => {
          setIsLoadingFollowedItems(false);
        });
    } else {
      // Own view
      setIsFollowingView(false);
      setCurrentOwner(userProfile);
      setItems(initialItems);
      setSharingDisabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentListRef, follows.length, initialItems.length, userProfile?.nickname, userProfile?.avatar_name]);

  // Track list switch
  useEffect(() => {
    if (currentListRef) {
      fetch("/api/track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "web.app.list_switch",
          meta: {
            list_ref: currentListRef,
            from: isFollowingView ? "following" : "me",
            request_id: crypto.randomUUID(),
          },
        }),
      }).catch(() => {
        // Best effort
      });
    }
  }, [currentListRef, isFollowingView]);

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

  const handleOpenEarlyAccessModal = useCallback(
    (props: { sourceUrl: string | null; itemId: string }) => {
      setEarlyAccessModalProps(props);
      setIsEarlyAccessModalOpen(true);
    },
    [],
  );

  const handleCloseEarlyAccessModal = useCallback(() => {
    setIsEarlyAccessModalOpen(false);
    setEarlyAccessModalProps(null);
  }, []);

  const hasItems = items.length > 0;
  const activeItemSourceUrl = activeItem ? getSourceUrl(activeItem) : null;
  const activePriceText = activeItem ? getPriceText(activeItem, locale) : null;
  const isNoteDirty =
    activeItem !== null && noteDraft !== (activeItem.personal_note ?? "");

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark text-gray-900 dark:text-gray-100 pb-28">
      <div className="max-w-3xl mx-auto px-5 pt-6">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 relative">
            {/* List Owner Switcher */}
            <button
              type="button"
              onClick={() => setIsSwitcherOpen((prev) => !prev)}
              className="flex items-center gap-2 border-none bg-transparent cursor-pointer hover:opacity-80 transition-opacity duration-200"
            >
              {currentOwner ? (
                <>
                  <img
                    src={`https://tapback.co/api/avatar/${currentOwner.avatar_name}.webp`}
                    alt={currentOwner.nickname}
                    className="w-8 h-8 rounded-full"
                    onError={(event) => {
                      const target = event.currentTarget;
                      target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect fill='%23ddd' width='32' height='32'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='16'%3E" +
                        (currentOwner.nickname.charAt(0).toUpperCase() || "?") +
                        "%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  <span className="text-lg font-semibold">{currentOwner.nickname}</span>
                </>
              ) : (
                <span className="text-lg font-semibold">WishlistGPT</span>
              )}
              {followingCount > 0 && (
                <ChevronDownIcon className="w-4 h-4 text-secondary dark:text-secondary-dark" />
              )}
            </button>

            {/* Switcher Dropdown */}
            {isSwitcherOpen && (
              <div
                ref={switcherRef}
                className="absolute top-12 left-0 bg-background-light dark:bg-background-dark-light border border-border dark:border-border-dark rounded-button shadow-lg min-w-[240px] z-30"
              >
                {/* Me section */}
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/app");
                      setIsSwitcherOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-button text-left ${
                      !isFollowingView
                        ? "bg-primary/10 dark:bg-primary-dark/10"
                        : "hover:bg-gray-50 dark:hover:bg-background-dark"
                    } transition-colors duration-200`}
                  >
                    {userProfile && (
                      <>
                        <img
                          src={`https://tapback.co/api/avatar/${userProfile.avatar_name}.webp`}
                          alt={userProfile.nickname}
                          className="w-6 h-6 rounded-full"
                          onError={(event) => {
                            const target = event.currentTarget;
                            target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect fill='%23ddd' width='24' height='24'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='12'%3E" +
                              (userProfile.nickname.charAt(0).toUpperCase() || "?") +
                              "%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        <span className="text-sm font-medium">{userProfile.nickname}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Following section */}
                {followingCount > 0 && (
                  <>
                    <div className="border-t border-border dark:border-border-dark my-1" />
                    <div className="p-2">
                      <div className="px-3 py-1 text-xs text-secondary dark:text-secondary-dark font-medium">
                        Following
                      </div>
                      {follows.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-secondary dark:text-secondary-dark">
                          No lists followed yet
                        </div>
                      ) : (
                        follows.map((follow) => (
                          <button
                            key={follow.list_ref}
                            type="button"
                            onClick={() => {
                              router.push(`/app?list_ref=${encodeURIComponent(follow.list_ref)}`);
                              setIsSwitcherOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-button text-left ${
                              currentListRef === follow.list_ref
                                ? "bg-primary/10 dark:bg-primary-dark/10"
                                : "hover:bg-gray-50 dark:hover:bg-background-dark"
                            } transition-colors duration-200`}
                          >
                            <img
                              src={`https://tapback.co/api/avatar/${follow.owner.avatar_name}.webp`}
                              alt={follow.owner.nickname}
                              className="w-6 h-6 rounded-full"
                              onError={(event) => {
                                const target = event.currentTarget;
                                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect fill='%23ddd' width='24' height='24'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='12'%3E" +
                                  (follow.owner.nickname.charAt(0).toUpperCase() || "?") +
                                  "%3C/text%3E%3C/svg%3E";
                              }}
                            />
                            <span className="text-sm font-medium">{follow.owner.nickname}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Header right button: Cheatsheet (Me) or Unfollow (Following) */}
            {isFollowingView ? (
              <button
                type="button"
                onClick={async () => {
                  if (!currentListRef) return;
                  if (
                    !confirm(
                      "Unfollow this list?\n\nYou'll stop seeing updates from this list. You can follow it again later if the owner shares it.",
                    )
                  ) {
                    return;
                  }

                  try {
                    const response = await fetch("/api/follows", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ list_ref: currentListRef }),
                    });

                    if (response.ok) {
                      // Update follows list
                      const newFollows = follows.filter((f) => f.list_ref !== currentListRef);
                      setFollows(newFollows);
                      setFollowingCount(newFollows.length);
                      // Switch back to Me
                      router.push("/app");
                    } else {
                      setToast({
                        message: "Could not unfollow. Please try again.",
                        tone: "error",
                      });
                    }
                  } catch {
                    setToast({
                      message: "Could not unfollow. Please try again.",
                      tone: "error",
                    });
                  }
                }}
                className="border-none bg-transparent text-secondary dark:text-secondary-dark cursor-pointer text-[0.95rem] hover:text-primary dark:hover:text-primary-dark transition-colors duration-200"
              >
                Following ✓
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCheatsheetOpen(true)}
                className="border-none bg-transparent text-secondary dark:text-secondary-dark cursor-pointer text-[0.95rem] hover:text-primary dark:hover:text-primary-dark transition-colors duration-200"
              >
                Cheatsheet
              </button>
            )}
            <a
              href={`/app/settings?next=${encodeURIComponent(pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ""))}`}
              aria-label="Settings"
              className="no-underline text-secondary dark:text-secondary-dark text-lg hover:text-primary dark:hover:text-primary-dark transition-colors duration-200"
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </a>
          </div>
        </header>
        {/* Sharing disabled status page */}
        {sharingDisabled && currentOwner ? (
          <div className="max-w-md mx-auto mt-12 text-center">
            <div className="mb-4">
              <img
                src={`https://tapback.co/api/avatar/${currentOwner.avatar_name}.webp`}
                alt={currentOwner.nickname}
                className="w-16 h-16 rounded-full mx-auto mb-4"
                onError={(event) => {
                  const target = event.currentTarget;
                  target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect fill='%23ddd' width='64' height='64'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='24'%3E" +
                    (currentOwner.nickname.charAt(0).toUpperCase() || "?") +
                    "%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
            <h2 className="text-xl font-semibold mb-2">Owner has made it private</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This list is no longer shared. Ask the owner to re-share if you'd like to see it again.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (!currentListRef) return;
                if (
                  !confirm(
                    "Unfollow this list?\n\nYou'll stop seeing updates from this list. You can follow it again later if the owner shares it.",
                  )
                ) {
                  return;
                }

                try {
                  const response = await fetch("/api/follows", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ list_ref: currentListRef }),
                  });

                  if (response.ok) {
                    const newFollows = follows.filter((f) => f.list_ref !== currentListRef);
                    setFollows(newFollows);
                    setFollowingCount(newFollows.length);
                    router.push("/app");
                  } else {
                    setToast({
                      message: "Could not unfollow. Please try again.",
                      tone: "error",
                    });
                  }
                } catch {
                  setToast({
                    message: "Could not unfollow. Please try again.",
                    tone: "error",
                  });
                }
              }}
              className="px-4 py-2 bg-primary text-white font-semibold rounded-pill hover:bg-primary/90 transition-colors duration-200 dark:bg-primary-dark dark:text-gray-900 dark:hover:bg-gray-200"
            >
              Remove from following
            </button>
          </div>
        ) : (
          <>
            <section className="flex justify-between items-center mb-5">
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                className="border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light rounded-pill px-3.5 py-1.5 cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200 flex items-center gap-1.5"
              >
                {sortOrder === "desc" ? (
                  <>
                <BarsArrowUpIcon className="w-4 h-4" />
                Newest
              </>
            ) : (
              <>
                <BarsArrowDownIcon className="w-4 h-4" />
                Oldest
              </>
            )}
          </button>
          {/* Share button only shown in Me view */}
          {!isFollowingView && (
            <button
              type="button"
              onClick={handleOpenShare}
              className="border-none bg-primary text-white dark:bg-primary-dark dark:text-gray-900 rounded-pill px-5 py-2 cursor-pointer text-[0.95rem] font-semibold hover:bg-primary/90 dark:hover:bg-gray-200 transition-colors duration-200 flex items-center gap-1.5"
            >
              <ShareIcon className="w-4 h-4" />
              Share
            </button>
          )}
        </section>
          </>
        )}
        {!hasItems && !isLoadingFollowedItems && !sharingDisabled ? (
          <div className="text-center bg-background-light dark:bg-background-dark-light rounded-card p-10 shadow-card dark:shadow-card-dark">
            <p className="text-gray-600 dark:text-gray-400 mb-5">
              Add items in ChatGPT. Tap here for Cheatsheet.
            </p>
            <button
              type="button"
              onClick={() => setIsCheatsheetOpen(true)}
              className="border-none bg-primary text-white dark:bg-primary-dark dark:text-gray-900 rounded-pill px-6 py-3 cursor-pointer font-semibold hover:bg-primary/90 dark:hover:bg-gray-200 transition-colors duration-200"
            >
              Open Cheatsheet
            </button>
          </div>
        ) : !isLoadingFollowedItems && !sharingDisabled ? (
          <div className="flex flex-col gap-4">
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
                  className="bg-background-light dark:bg-background-dark-light rounded-card p-4 shadow-card dark:shadow-card-dark cursor-pointer hover:shadow-lg transition-shadow duration-200"
                >
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                      <span className="text-gray-400 dark:text-gray-500 text-xs">
                        {getCoverFallbackLabel(item)}
                      </span>
                      {item.display_cover_image_url ? (
                        <img
                          src={item.display_cover_image_url}
                          alt={title}
                          className="w-full h-full object-cover absolute inset-0"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            {shouldShowLogo ? (
                              <div
                                className="w-[18px] h-[18px] mt-[2px] rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[0.6rem] text-secondary dark:text-secondary-dark relative bg-background-light dark:bg-background-dark-light overflow-hidden flex-shrink-0"
                                aria-label={domain ?? "Merchant"}
                              >
                                <span>{logoFallback}</span>
                                <img
                                  src={item.display_merchant_logo_url ?? ""}
                                  alt={domain ?? "Merchant"}
                                  className="absolute inset-0 w-full h-full object-contain"
                                  onError={(event) => {
                                    event.currentTarget.onerror = null;
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            ) : null}
                            <h2
                              className="text-base font-medium m-0 leading-snug overflow-hidden"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {title}
                            </h2>
                          </div>
                          {showPriceRow ? (
                            <div className="mt-1.5 text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                              <span>{priceText}</span>
                              <QuestionMarkCircleIcon
                                title={PRICE_TOOLTIP}
                                className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500"
                              />
                            </div>
                          ) : null}
                        </div>
                        <div onClick={(event) => event.stopPropagation()}>
                          {/* Overflow menu only shown in Me view */}
                          {!isFollowingView && (
                            <OverflowMenuPopover
                              onEdit={() => handleEditNote(item)}
                              onDelete={() => handleDelete(item)}
                            />
                          )}
                        </div>
                      </div>
                      <p
                        className={`mt-2.5 text-sm ${
                          notePreview.isPlaceholder
                            ? "text-gray-400 dark:text-gray-500"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {notePreview.text}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex gap-2 mt-3"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        const sourceUrl = getSourceUrl(item);
                        if (sourceUrl) {
                          openSourceUrl(sourceUrl);
                        }
                      }}
                      className={`flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark rounded-button py-2 font-medium text-sm ${
                        getSourceUrl(item)
                          ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-background-dark"
                          : "cursor-not-allowed opacity-60"
                      } transition-colors duration-200`}
                      disabled={!getSourceUrl(item)}
                    >
                      View on website
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenEarlyAccessModal({
                          sourceUrl: getSourceUrl(item),
                          itemId: item.id,
                        });
                      }}
                      className="flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark rounded-button py-2 font-medium text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
                    >
                      Buy with AI
                      <SparklesIcon
                        className="ml-1.5 w-3.5 h-3.5 text-orange-500 inline-block"
                        title="Early access"
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      {activeItem ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/35 flex items-end z-40"
          onClick={() => setActiveItemId(null)}
        >
          <div
            className="w-full h-[70vh] max-h-[90vh] overflow-y-auto bg-background-light dark:bg-background-dark-light rounded-t-[24px] p-6 shadow-modal dark:shadow-modal-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex gap-4 mb-5">
              <div className="w-[120px] h-[120px] rounded-[20px] bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                <span className="text-gray-400 dark:text-gray-500 text-sm">
                  {getCoverFallbackLabel(activeItem)}
                </span>
                {activeItem.display_cover_image_url ? (
                  <img
                    src={activeItem.display_cover_image_url}
                    alt={getCardTitle(activeItem)}
                    className="w-full h-full object-cover absolute inset-0"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {shouldRenderMerchantLogo(activeItem) ? (
                    <div
                      className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[0.7rem] text-secondary dark:text-secondary-dark relative bg-background-light dark:bg-background-dark-light overflow-hidden flex-shrink-0"
                      aria-label={resolveDomain(activeItem) ?? "Merchant"}
                    >
                      <span>{getLogoFallbackText(activeItem)}</span>
                      <img
                        src={activeItem.display_merchant_logo_url ?? ""}
                        alt={resolveDomain(activeItem) ?? "Merchant"}
                        className="absolute inset-0 w-full h-full object-contain"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  ) : null}
                  <h2 className="m-0 text-lg font-semibold">{getCardTitle(activeItem)}</h2>
                </div>
                {shouldShowPriceRow(activeItem) && activePriceText ? (
                  <div className="mt-1.5 text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <span>{activePriceText}</span>
                    <QuestionMarkCircleIcon
                      title={PRICE_TOOLTIP}
                      className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {/* Note editor only shown in Me view */}
            {!isFollowingView ? (
              <>
                <label className="block text-sm text-secondary dark:text-secondary-dark">
                  Personal note
                </label>
                <textarea
                  ref={noteInputRef}
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder={NOTE_PLACEHOLDER}
                  rows={3}
                  className="w-full mt-2 rounded-button border border-border dark:border-border-dark p-3 text-[0.95rem] font-inherit resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-background-dark-light dark:text-gray-200"
                />
                {isNoteDirty ? (
                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      className="border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light rounded-pill px-4 py-1.5 font-semibold cursor-pointer text-gray-900 dark:text-gray-100 text-sm hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
                    >
                      Save
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              /* Read-only note display in Following view */
              activeItem.personal_note && (
                <div className="mt-4">
                  <label className="block text-sm text-secondary dark:text-secondary-dark mb-2">
                    Note
                  </label>
                  <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                    {activeItem.personal_note}
                  </p>
                </div>
              )
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (activeItemSourceUrl) {
                    openSourceUrl(activeItemSourceUrl);
                  }
                }}
                className={`flex-1 border border-border dark:border-border-dark bg-white text-gray-900 rounded-button py-3 font-medium text-sm ${
                  activeItemSourceUrl
                    ? "cursor-pointer hover:bg-gray-100"
                    : "cursor-not-allowed opacity-60"
                } transition-colors duration-200`}
                disabled={!activeItemSourceUrl}
              >
                {activeItemSourceUrl ? "View on website" : "Link unavailable"}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenEarlyAccessModal({
                    sourceUrl: activeItemSourceUrl,
                    itemId: activeItem.id,
                  });
                }}
                className="flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark rounded-button py-3 font-medium text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
              >
                Buy with AI
              </button>
            </div>
            {/* Delete button only shown in Me view */}
            {!isFollowingView && (
              <button
                type="button"
                onClick={() => handleDelete(activeItem, true)}
                className="w-full mt-3 border-none bg-transparent text-red-600 dark:text-red-400 py-1.5 font-semibold underline cursor-pointer hover:text-red-700 dark:hover:text-red-300 transition-colors duration-200"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ) : null}

      {isCheatsheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/35 flex items-end z-50"
          onClick={() => setIsCheatsheetOpen(false)}
        >
          <div
            className="w-full bg-background-light dark:bg-background-dark-light rounded-t-[24px] p-6 shadow-modal dark:shadow-modal-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-secondary dark:text-secondary-dark mb-3">
              Add items in ChatGPT, then review them here.
            </p>
            <ul className="pl-5 text-gray-600 dark:text-gray-400 space-y-1">
              <li>Tell GPT what you want and it appears in your list.</li>
              <li>Tap an item to add a note or decide.</li>
              <li>Share a read-only list anytime.</li>
              <li>Send feedback any time.</li>
            </ul>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsCheatsheetOpen(false)}
                className="flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light rounded-pill py-3 cursor-pointer font-semibold hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
              >
                Got it
              </button>
              <button
                type="button"
                onClick={returnToChatGPT}
                className="flex-1 border-none bg-primary text-white dark:bg-primary-dark dark:text-gray-900 rounded-pill py-3 cursor-pointer font-semibold hover:bg-primary/90 dark:hover:bg-gray-200 transition-colors duration-200"
              >
                Back to GPT
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="w-full mt-3 border-none bg-transparent text-gray-900 dark:text-gray-100 py-1.5 font-semibold underline cursor-pointer hover:text-primary dark:hover:text-primary-dark transition-colors duration-200"
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
          className="fixed inset-0 bg-black/35 flex items-end z-[55]"
          onClick={() => setIsShareOpen(false)}
        >
          <div
            className="w-full bg-background-light dark:bg-background-dark-light rounded-t-[24px] p-6 shadow-modal dark:shadow-modal-dark"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="m-0 text-xl font-semibold">Share list</h2>
              <button
                type="button"
                onClick={() => setIsShareOpen(false)}
                className="border-none bg-transparent text-xl cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-background-dark rounded transition-colors duration-200"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4">
              {shareState.shareUrl && !shareState.isRevoked ? (
                <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-button p-3">
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap">
                    {shareState.shareUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="border-none bg-primary text-white dark:bg-primary-dark dark:text-gray-900 rounded-pill px-3.5 py-1.5 cursor-pointer text-sm font-semibold hover:bg-primary/90 dark:hover:bg-gray-200 transition-colors duration-200"
                  >
                    Copy link
                  </button>
                </div>
              ) : (
                <div className="text-secondary dark:text-secondary-dark">This link is disabled.</div>
              )}
            </div>
            {shareState.shareUrl && !shareState.isRevoked ? (
              <div className="flex gap-3 mt-4">
                {typeof navigator !== "undefined" && "share" in navigator ? (
                  <button
                    type="button"
                    onClick={handleShareSystem}
                    className="flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light rounded-pill py-3 cursor-pointer font-semibold hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
                  >
                    Share…
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleRevoke}
                  className="flex-1 border-none bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-pill py-3 cursor-pointer font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors duration-200"
                >
                  Stop sharing
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleGenerateNewLink}
                  className="border-none bg-primary text-white dark:bg-primary-dark dark:text-gray-900 rounded-pill px-6 py-3 cursor-pointer font-semibold hover:bg-primary/90 dark:hover:bg-gray-200 transition-colors duration-200"
                >
                  Generate new link
                </button>
              </div>
            )}
            {shareStatus ? (
              <p className="mt-3 text-gray-600 dark:text-gray-400">{shareStatus}</p>
            ) : null}
            {shareError ? (
              <p className="mt-3 text-red-600 dark:text-red-400">{shareError}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Return to ChatGPT"
        onClick={returnToChatGPT}
        className={`fixed right-5 bottom-5 w-[52px] h-[52px] rounded-full border-none bg-primary text-white dark:bg-primary-dark dark:text-gray-900 ${
          showReturnButton ? "flex" : "hidden"
        } items-center justify-center shadow-toast dark:shadow-toast-dark cursor-pointer z-[70] hover:bg-primary/90 dark:hover:bg-gray-200 transition-colors duration-200`}
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
          showToast({ message: "Couldn't send. Try again.", tone: "error" });
          setIsCheatsheetOpen(false);
        }}
      />

      {earlyAccessModalProps ? (
        <EarlyAccessModal
          isOpen={isEarlyAccessModalOpen}
          onClose={handleCloseEarlyAccessModal}
          sourceUrl={earlyAccessModalProps.sourceUrl}
          context="owner"
          surface={activeItemId !== null ? "sheet" : "card"}
          intent="buy"
          itemId={earlyAccessModalProps.itemId}
        />
      ) : null}
    </div>
  );
}
