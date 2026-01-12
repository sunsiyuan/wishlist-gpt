"use client";

import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import type { PublicShareItem } from "../../../server/shares";
import {
  getCardTitle,
  getCoverFallbackLabel,
  getLogoFallbackText,
  getPriceText,
  getSourceUrl,
  resolveDomain,
  shouldRenderMerchantLogo,
  shouldShowPriceRow,
} from "../../../lib/itemDisplay";

const PRICE_TOOLTIP = "Price may change";

type ShareItemSheetProps = {
  item: PublicShareItem;
  isOpen: boolean;
  onClose: () => void;
  shareId: string;
  locale: string;
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
      className="fixed inset-0 bg-black/35 flex items-end z-40"
      onClick={onClose}
    >
      <div
        className="w-full h-[70vh] max-h-[90vh] overflow-y-auto bg-background-light dark:bg-background-dark-light rounded-t-[24px] p-6 shadow-modal dark:shadow-modal-dark"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex gap-4 mb-5">
          <div className="w-[120px] h-[120px] rounded-[20px] bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
            <span className="text-gray-400 dark:text-gray-500 text-sm">
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
            <div className="flex items-center gap-2">
              {shouldShowLogo ? (
                <div
                  className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[0.7rem] text-secondary dark:text-secondary-dark relative bg-background-light dark:bg-background-dark-light overflow-hidden flex-shrink-0"
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
              <h2 className="m-0 text-lg font-semibold">{title}</h2>
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
        </div>

        {item.personal_note ? (
          <div className="mb-4">
            <label className="block text-sm text-secondary dark:text-secondary-dark mb-2">
              Note
            </label>
            <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
              {item.personal_note}
            </p>
          </div>
        ) : null}

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (sourceUrl) {
                openSourceUrl(sourceUrl);
              }
            }}
            className={`flex-1 border-none bg-primary text-white dark:bg-primary-dark dark:text-gray-900 rounded-full py-3 font-semibold ${
              sourceUrl
                ? "cursor-pointer hover:bg-primary/90 dark:hover:bg-gray-200"
                : "cursor-not-allowed opacity-60"
            } transition-colors duration-200`}
            disabled={!sourceUrl}
          >
            {sourceUrl ? "View on website" : "Link unavailable"}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenEarlyAccessModal({ sourceUrl, itemId: item.id });
            }}
            className="border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-primary dark:text-primary-dark rounded-full py-3 px-4 font-semibold cursor-pointer hover:bg-gray-50 dark:hover:bg-background-dark transition-colors duration-200"
          >
            Gift with AI
          </button>
        </div>
      </div>
    </div>
  );
}
