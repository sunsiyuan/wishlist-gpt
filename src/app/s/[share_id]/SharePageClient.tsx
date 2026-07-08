"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SparklesIcon,
  UserPlusIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import type { PublicShareItem } from "../../../server/shares";
import {
  getCardTitle,
  getCoverFallbackLabel,
  getLogoFallbackText,
  getMerchantLogoUrl,
  getNotePreview,
  getPriceText,
  getSourceUrl,
  resolveDomain,
  shouldRenderMerchantLogo,
  shouldShowPriceRow,
} from "../../../lib/itemDisplay";
import Avatar from "../../components/Avatar";
import ShareItemSheet from "./ShareItemSheet";
import ShareFeedbackEntry from "./ShareFeedbackEntry";
import EarlyAccessModal from "../../components/EarlyAccessModal";

type FollowWithOwner = {
  list_ref: string;
  owner: {
    nickname: string;
  };
};

type SharePageClientProps = {
  items: PublicShareItem[];
  shareId: string;
  locale: string;
  ownerProfile: { nickname: string } | null;
  isLoggedIn: boolean;
  isFollowing: boolean;
  isOwner: boolean;
  userProfile: { nickname: string } | null;
  follows: FollowWithOwner[];
  followingCount: number;
  currentListRef: string | null;
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

export default function SharePageClient({
  items,
  shareId,
  locale,
  ownerProfile,
  isLoggedIn,
  isFollowing: initialIsFollowing,
  isOwner,
  userProfile,
  follows,
  followingCount,
  currentListRef,
}: SharePageClientProps) {
  const router = useRouter();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isEarlyAccessModalOpen, setIsEarlyAccessModalOpen] = useState(false);
  const [earlyAccessModalProps, setEarlyAccessModalProps] = useState<{
    sourceUrl: string | null;
    itemId: string;
  } | null>(null);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
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

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) ?? null,
    [items, activeItemId],
  );

  const handleCardOpen = (item: PublicShareItem) => {
    setActiveItemId(item.id);
  };

  const handleOpenEarlyAccessModal = (props: { sourceUrl: string | null; itemId: string }) => {
    setEarlyAccessModalProps(props);
    setIsEarlyAccessModalOpen(true);
  };

  const handleCloseEarlyAccessModal = () => {
    setIsEarlyAccessModalOpen(false);
    setEarlyAccessModalProps(null);
  };

  const handleFollow = async () => {
    if (!isLoggedIn) {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/login?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (isFollowing) {
      return; // Already following
    }

    setIsFollowingLoading(true);
    try {
      const response = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_id: shareId }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsFollowing(true);
        // Deep-link to /app with the followed list
        const listRef = data.list_ref;
        router.push(`/app?list_ref=${encodeURIComponent(listRef)}`);
      } else {
        const errorData = await response.json();
        alert(errorData.error?.message || "Could not follow this list. Please try again.");
      }
    } catch (error) {
      alert("Could not follow this list. Please try again.");
    } finally {
      setIsFollowingLoading(false);
    }
  };

  // Filter follows - exclude current share from switcher list
  // User is viewing it via share link, so don't show it in switcher
  const filteredFollows = currentListRef
    ? follows.filter((f) => f.list_ref !== currentListRef)
    : follows;

  return (
    <main className="min-h-screen bg-background dark:bg-background-dark text-primary dark:text-primary-dark py-8 px-5 lg:px-8 pb-12">
      <div className="max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 relative">
            {/* List Owner Switcher - only show if logged in */}
            {isLoggedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsSwitcherOpen((prev) => !prev)}
                  className="flex items-center gap-2 border-none bg-transparent cursor-pointer hover:opacity-80 transition-opacity duration-200"
                >
                  {ownerProfile ? (
                    <>
                      <Avatar nickname={ownerProfile.nickname} size={32} />
                      <span className="text-lg font-semibold">{ownerProfile.nickname}</span>
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
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-button text-left hover:bg-background dark:hover:bg-background-dark transition-colors duration-200"
                      >
                        {userProfile && (
                          <>
                            <Avatar nickname={userProfile.nickname} size={24} />
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
                          {filteredFollows.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-secondary dark:text-secondary-dark">
                              No lists followed yet
                            </div>
                          ) : (
                            filteredFollows.map((follow) => (
                              <button
                                key={follow.list_ref}
                                type="button"
                                onClick={() => {
                                  router.push(`/app?list_ref=${encodeURIComponent(follow.list_ref)}`);
                                  setIsSwitcherOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-button text-left hover:bg-background dark:hover:bg-background-dark transition-colors duration-200"
                              >
                                <Avatar nickname={follow.owner.nickname} size={24} />
                                <span className="text-sm font-medium">{follow.owner.nickname}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              // Not logged in — the hero below carries the owner identity, so keep a light brand mark here.
              <a
                href="/"
                className="text-lg font-semibold tracking-tight no-underline text-primary dark:text-primary-dark"
              >
                WishlistGPT
              </a>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Header right button: Following status or Settings */}
            {isLoggedIn && isFollowing && !isOwner ? (
              <div className="text-sm text-secondary dark:text-secondary-dark">Following ✓</div>
            ) : null}
            {isLoggedIn && (
              <a
                href={`/app/settings?next=${encodeURIComponent(
                  typeof window !== "undefined" ? window.location.pathname : "/s/" + shareId,
                )}`}
                aria-label="Settings"
                className="no-underline text-secondary dark:text-secondary-dark text-lg hover:text-primary dark:hover:text-primary-dark transition-colors duration-200"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </a>
            )}
          </div>
        </header>

        {/* Hero — frames whose list this is for a visitor landing on the share link */}
        <section className="text-center pt-2 pb-9 sm:pt-4 sm:pb-12">
          <div className="flex justify-center mb-4">
            <Avatar nickname={ownerProfile?.nickname ?? "WishlistGPT"} size={72} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {ownerProfile ? `${ownerProfile.nickname}'s wishlist` : "Shared wishlist"}
          </h1>
          <p className="mt-2 text-secondary dark:text-secondary-dark">
            {items.length} {items.length === 1 ? "item" : "items"}
            {isOwner ? " · this is your public list" : " · pick something to make their day"}
          </p>
        </section>

        {items.length === 0 ? (
          <div className="text-center bg-background-light dark:bg-background-dark-light rounded-card border border-border dark:border-border-dark p-12">
            <p className="text-secondary dark:text-secondary-dark">Nothing on this list yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => {
              const title = getCardTitle(item);
              const priceText = getPriceText(item, locale);
              const showPriceRow = shouldShowPriceRow(item) && priceText;
              const notePreview = getNotePreview(item);
              const shouldShowLogo = shouldRenderMerchantLogo(item);
              const domain = resolveDomain(item);
              const sourceUrl = getSourceUrl(item);
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
                  className="flex flex-col overflow-hidden bg-background-light dark:bg-background-dark-light rounded-card border border-border dark:border-border-dark cursor-pointer hover:-translate-y-0.5 hover:shadow-card dark:hover:shadow-card-dark transition-all duration-150"
                >
                  {/* Cover — big square so the product photo carries the card */}
                  <div className="relative aspect-square bg-sunken dark:bg-sunken-dark">
                    <span className="absolute inset-0 grid place-items-center text-secondary dark:text-secondary-dark text-xs">
                      {getCoverFallbackLabel(item)}
                    </span>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={title}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                    {shouldShowLogo ? (
                      <div
                        className="absolute top-2 left-2 z-10 w-6 h-6 rounded-[7px] border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light flex items-center justify-center overflow-hidden text-[0.6rem] text-secondary dark:text-secondary-dark"
                        aria-label={domain ?? "Merchant"}
                      >
                        <span>{getLogoFallbackText(item)}</span>
                        <img
                          src={getMerchantLogoUrl(item) ?? ""}
                          alt={domain ?? "Merchant"}
                          className="absolute inset-0 w-full h-full object-contain"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                    {domain ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-secondary dark:text-secondary-dark">
                        {domain}
                      </span>
                    ) : null}
                    <h2
                      className="text-sm font-semibold m-0 leading-snug overflow-hidden"
                      style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                    >
                      {title}
                    </h2>
                    {showPriceRow ? (
                      <span className="text-[0.95rem] font-bold tabular-nums">{priceText}</span>
                    ) : null}
                    {!notePreview.isPlaceholder ? (
                      <p
                        className="text-sm text-secondary dark:text-secondary-dark overflow-hidden"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                      >
                        {notePreview.text}
                      </p>
                    ) : null}
                    <div
                      className="flex gap-2 mt-auto pt-2.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (sourceUrl) {
                            openSourceUrl(sourceUrl);
                          }
                        }}
                        className={`flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark rounded-button py-2 font-medium text-sm whitespace-nowrap ${
                          sourceUrl
                            ? "cursor-pointer hover:bg-background dark:hover:bg-background-dark"
                            : "cursor-not-allowed opacity-60"
                        } transition-colors duration-200`}
                        disabled={!sourceUrl}
                      >
                        View
                      </button>
                      {!isOwner ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenEarlyAccessModal({ sourceUrl, itemId: item.id });
                          }}
                          className="flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark rounded-button py-2 font-medium text-sm whitespace-nowrap cursor-pointer hover:bg-background dark:hover:bg-background-dark transition-colors duration-200"
                        >
                          Gift
                          <SparklesIcon
                            className="ml-1.5 w-3.5 h-3.5 text-accent inline-block"
                            title="Early access"
                          />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <ShareFeedbackEntry shareId={shareId} intent={undefined} />
      </div>

      {activeItem ? (
        <ShareItemSheet
          item={activeItem}
          isOpen={activeItemId !== null}
          onClose={() => setActiveItemId(null)}
          shareId={shareId}
          locale={locale}
          isOwner={isOwner}
          onOpenEarlyAccessModal={handleOpenEarlyAccessModal}
        />
      ) : null}

      {earlyAccessModalProps ? (
        <EarlyAccessModal
          isOpen={isEarlyAccessModalOpen}
          onClose={handleCloseEarlyAccessModal}
          sourceUrl={earlyAccessModalProps.sourceUrl}
          context="share"
          surface={activeItemId !== null ? "sheet" : "card"}
          intent={isOwner ? "buy" : "gift"}
          itemId={earlyAccessModalProps.itemId}
        />
      ) : null}

      {/* Bottom floating CTA button */}
      {(!isLoggedIn || (!isFollowing && !isOwner)) && (
        <button
          type="button"
          onClick={() => {
            if (!isLoggedIn) {
              const currentPath = window.location.pathname + window.location.search;
              router.push(`/login?next=${encodeURIComponent(currentPath)}`);
            } else {
              handleFollow();
            }
          }}
          disabled={isFollowingLoading}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 min-w-[200px] px-8 py-3 bg-accent text-accent-fg font-semibold rounded-button hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-toast dark:shadow-toast-dark z-[60] flex items-center justify-center gap-2"
        >
          {!isLoggedIn ? (
            "Sign In"
          ) : (
            <>
              <UserPlusIcon className="w-4 h-4" />
              Follow
            </>
          )}
        </button>
      )}
    </main>
  );
}
