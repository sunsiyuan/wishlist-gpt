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

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ share_id: string }> }) {
  const { share_id: shareId } = await params;
  if (!isValidShareId(shareId)) {
    notFound();
  }

  const requestHeaders = await headers();
  const acceptLanguage = requestHeaders.get("accept-language");
  const locale = acceptLanguage?.split(",")[0]?.trim() || "en";

  const items = await getPublicShareItems(shareId);
  if (!items) {
    notFound();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f8f8",
        color: "#111",
        fontFamily: "\"Inter\", system-ui, -apple-system, sans-serif",
        padding: "2rem 1.25rem 3rem",
      }}
    >
      <ShareViewTracker shareId={shareId} />
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Shared Wishlist</h1>
        <p style={{ color: "#5b5b5b", marginBottom: "1.5rem" }}>This list is read-only.</p>
        {items.length === 0 ? (
          <p style={{ color: "#6b6b6b" }}>No items yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                  style={{
                    background: "#fff",
                    borderRadius: "16px",
                    padding: "1rem",
                    boxShadow: "0 8px 20px rgba(17, 17, 17, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <div
                      style={{
                        width: "96px",
                        height: "96px",
                        borderRadius: "12px",
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
                    <div style={{ flex: 1 }}>
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
                            <span>{getLogoFallbackText(item)}</span>
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
                        <h2 style={{ fontSize: "1rem", margin: 0 }}>{title}</h2>
                      </div>
                      {showPriceRow ? (
                        <div style={{ marginTop: "0.35rem", color: "#4a4a4a", fontSize: "0.9rem" }}>
                          <span>{priceText}</span>
                          <span
                            title="Price may change"
                            style={{ marginLeft: "0.4rem", color: "#8b8b8b" }}
                          >
                            ?
                          </span>
                        </div>
                      ) : null}
                      <p
                        style={{
                          marginTop: "0.5rem",
                          color: notePreview.isPlaceholder ? "#9a9a9a" : "#3d3d3d",
                          fontSize: "0.9rem",
                        }}
                      >
                        {notePreview.text}
                      </p>
                      {item.source_url ? (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            marginTop: "0.75rem",
                            color: "#1f2937",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
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
      </div>
    </main>
  );
}
