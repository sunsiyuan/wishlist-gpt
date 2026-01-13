"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionMarkCircleIcon, SparklesIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import type { PublicShareItem } from "../../../server/shares";
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
} from "../../../lib/itemDisplay";
import ShareItemSheet from "./ShareItemSheet";
import ShareFeedbackEntry from "./ShareFeedbackEntry";
import EarlyAccessModal from "../../components/EarlyAccessModal";

const PRICE_TOOLTIP = "Price may change";

type SharePageClientProps = {
  items: PublicShareItem[];
  shareId: string;
  locale: string;
  ownerProfile: { nickname: string; avatar_name: string } | null;
  isLoggedIn: boolean;
  isFollowing: boolean;
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

  return (
    <main className="min-h-screen bg-background dark:bg-background-dark text-gray-900 dark:text-gray-100 py-8 px-5 pb-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {ownerProfile && (
                <img
                  src={`https://tapback.co/api/avatar/${ownerProfile.avatar_name}.webp`}
                  alt={ownerProfile.nickname}
                  className="w-6 h-6 rounded-full"
                  onError={(event) => {
                    const target = event.currentTarget;
                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect fill='%23ddd' width='24' height='24'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='12'%3E" +
                      (ownerProfile.nickname.charAt(0).toUpperCase() || "?") +
                      "%3C/text%3E%3C/svg%3E";
                  }}
                />
              )}
              <h1 className="text-2xl font-bold m-0">
                {ownerProfile ? `${ownerProfile.nickname}'s Wishlist` : "Shared Wishlist"}
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">This list is read-only.</p>
          </div>
          {/* Follow button - only show if not already following */}
          {!isFollowing && (
            <button
              type="button"
              onClick={handleFollow}
              disabled={isFollowingLoading}
              className="flex items-center gap-2 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light rounded-pill px-4 py-2 cursor-pointer text-sm font-semibold hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlusIcon className="w-4 h-4" />
              {isLoggedIn ? "Follow this list" : "Sign in to follow this list"}
            </button>
          )}
          {isFollowing && (
            <div className="text-sm text-secondary dark:text-secondary-dark">
              Following ✓
            </div>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-secondary dark:text-secondary-dark">No items yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
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
                      <div className="flex items-start gap-2">
                        {shouldShowLogo ? (
                          <div
                            className="w-[18px] h-[18px] mt-[2px] rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[0.6rem] text-secondary dark:text-secondary-dark relative bg-background-light dark:bg-background-dark-light overflow-hidden flex-shrink-0"
                            aria-label={domain ?? "Merchant"}
                          >
                            <span>{getLogoFallbackText(item)}</span>
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
                      <p
                        className={`mt-2.5 text-sm ${
                          notePreview.isPlaceholder
                            ? "text-gray-400 dark:text-gray-500"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {notePreview.text}
                      </p>
                      <div className="flex gap-0 mt-3" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (sourceUrl) {
                              openSourceUrl(sourceUrl);
                            }
                          }}
                          className={`flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark rounded-button py-2 font-medium text-sm ${
                            sourceUrl
                              ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-background-dark"
                              : "cursor-not-allowed opacity-60"
                          } transition-colors duration-200`}
                          disabled={!sourceUrl}
                        >
                          View on website
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenEarlyAccessModal({ sourceUrl, itemId: item.id });
                          }}
                          className="flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark rounded-button py-2 font-medium text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
                        >
                          Gift with AI
                          <SparklesIcon
                            className="ml-1.5 w-3.5 h-3.5 text-orange-500 inline-block"
                            title="Early access"
                          />
                        </button>
                      </div>
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
          intent="gift"
          itemId={earlyAccessModalProps.itemId}
        />
      ) : null}
    </main>
  );
}
