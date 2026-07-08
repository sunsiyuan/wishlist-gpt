"use client";

import { SparklesIcon } from "@heroicons/react/24/outline";
import type { PublicShareItem } from "../../../server/shares";
import {
  getCardTitle,
  getCoverFallbackLabel,
  getLogoFallbackText,
  getMerchantLogoUrl,
  getPriceText,
  getSourceUrl,
  resolveDomain,
  shouldRenderMerchantLogo,
  shouldShowPriceRow,
} from "../../../lib/itemDisplay";

type ShareItemSheetProps = {
  item: PublicShareItem;
  isOpen: boolean;
  onClose: () => void;
  shareId: string;
  locale: string;
  isOwner: boolean;
  onOpenEarlyAccessModal: (props: {
    sourceUrl: string | null;
    itemId: string;
  }) => void;
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

export default function ShareItemSheet({
  item,
  isOpen,
  onClose,
  locale,
  isOwner,
  onOpenEarlyAccessModal,
}: ShareItemSheetProps) {
  if (!isOpen) {
    return null;
  }

  const sourceUrl = getSourceUrl(item);
  const priceText = getPriceText(item, locale);
  const showPriceRow = shouldShowPriceRow(item) && priceText;
  const title = getCardTitle(item);
  const shouldShowLogo = shouldRenderMerchantLogo(item);
  const domain = resolveDomain(item);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/35 flex items-end md:items-center md:justify-center md:p-6 z-40"
      onClick={onClose}
    >
      <div
        className="w-full h-[70vh] md:h-auto max-h-[90vh] md:max-h-[85vh] overflow-y-auto bg-background-light dark:bg-background-dark-light md:max-w-lg rounded-t-[24px] md:rounded-card p-6 shadow-modal dark:shadow-modal-dark"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex gap-4 mb-5">
          <div className="w-[120px] h-[120px] rounded-[20px] bg-sunken dark:bg-sunken-dark overflow-hidden flex-shrink-0 relative flex items-center justify-center">
            <span className="text-secondary dark:text-secondary-dark text-sm">
              {getCoverFallbackLabel(item)}
            </span>
            {item.image_url ? (
              <img
                src={item.image_url}
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
                  className="w-[18px] h-[18px] mt-[2px] rounded-full border border-border dark:border-border-dark flex items-center justify-center text-[0.6rem] text-secondary dark:text-secondary-dark relative bg-background-light dark:bg-background-dark-light overflow-hidden flex-shrink-0"
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
              <h2 className="m-0 text-lg font-semibold">{title}</h2>
            </div>
            {showPriceRow ? (
              <div className="mt-1.5 text-secondary dark:text-secondary-dark">
                <span>{priceText}</span>
              </div>
            ) : null}
          </div>
        </div>

        {item.personal_note ? (
          <div className="mb-4">
            <label className="block text-sm text-secondary dark:text-secondary-dark mb-2">
              Note
            </label>
            <p className="text-secondary dark:text-secondary-dark text-sm whitespace-pre-wrap">
              {item.personal_note}
            </p>
          </div>
        ) : null}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (sourceUrl) {
                openSourceUrl(sourceUrl);
              }
            }}
            className={`flex-1 bg-accent text-accent-fg rounded-button py-3 font-semibold text-sm whitespace-nowrap ${
              sourceUrl
                ? "cursor-pointer hover:bg-accent/90"
                : "cursor-not-allowed opacity-60"
            } transition-colors duration-200`}
            disabled={!sourceUrl}
          >
            {sourceUrl ? "View on website" : "Link unavailable"}
          </button>
          {!isOwner ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenEarlyAccessModal({ sourceUrl, itemId: item.id });
              }}
              className="flex-1 border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark rounded-button py-3 font-medium text-sm whitespace-nowrap cursor-pointer hover:bg-background dark:hover:bg-background-dark transition-colors duration-200"
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
    </div>
  );
}
