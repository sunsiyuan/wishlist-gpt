import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  getCardTitle,
  getCoverFallbackLabel,
  getLogoFallbackText,
  getNotePreview,
  getPriceText,
  resolveDomain,
  shouldRenderMerchantLogo,
  shouldShowPriceRow,
} from "../../../lib/itemDisplay";
import { getPublicShareItems, isValidShareId } from "../../../server/shares";
import ShareViewTracker from "./ShareViewTracker";
import ShareFeedbackEntry from "./ShareFeedbackEntry";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ share_id: string }>;
  searchParams?: Promise<{ intent?: string }>;
};

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { share_id: shareId } = await params;
  if (!isValidShareId(shareId)) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const requestHeaders = await headers();
  const acceptLanguage = requestHeaders.get("accept-language");
  const locale = acceptLanguage?.split(",")[0]?.trim() || "en";

  const items = await getPublicShareItems(shareId);
  if (!items) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f8f8f8] dark:bg-background-dark text-gray-900 dark:text-gray-100 py-8 px-5 pb-12">
      <ShareViewTracker shareId={shareId} />
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Shared Wishlist</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">This list is read-only.</p>
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
              return (
                <article
                  key={item.id}
                  className="bg-background-light dark:bg-background-dark-light rounded-[16px] p-4 shadow-[0_8px_20px_rgba(17,17,17,0.08)] dark:shadow-card-dark"
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
                      <div className="flex items-center gap-2">
                        {shouldShowLogo ? (
                          <div
                            className="w-[22px] h-[22px] rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[0.65rem] text-secondary dark:text-secondary-dark relative bg-background-light dark:bg-background-dark-light overflow-hidden flex-shrink-0"
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
                        <h2 className="text-base font-semibold m-0 truncate">{title}</h2>
                      </div>
                      {showPriceRow ? (
                        <div className="mt-1.5 text-gray-600 dark:text-gray-400 text-sm">
                          <span>{priceText}</span>
                          <span title="Price may change" className="ml-1.5 text-gray-400 dark:text-gray-500">
                            ?
                          </span>
                        </div>
                      ) : null}
                      <p
                        className={`mt-2 text-sm ${
                          notePreview.isPlaceholder
                            ? "text-gray-400 dark:text-gray-500"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {notePreview.text}
                      </p>
                      {item.source_url ? (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex mt-3 text-gray-900 dark:text-gray-100 font-semibold no-underline hover:underline"
                        >
                          View on website
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <ShareFeedbackEntry shareId={shareId} intent={resolvedSearchParams?.intent} />
      </div>
    </main>
  );
}
