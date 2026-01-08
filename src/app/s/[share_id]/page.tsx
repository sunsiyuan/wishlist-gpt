import { notFound } from "next/navigation";
import { getPublicShareItems, isValidShareId } from "../../../server/shares";
import ShareViewTracker from "./ShareViewTracker";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ share_id: string }> }) {
  const { share_id: shareId } = await params;
  if (!isValidShareId(shareId)) {
    notFound();
  }

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
              const title = item.display_product_title ?? item.display_merchant_domain ?? "Wishlist item";
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
                      }}
                    >
                      {item.display_cover_image_url ? (
                        <img
                          src={item.display_cover_image_url}
                          alt={title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : null}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {item.display_merchant_logo_url ? (
                          <img
                            src={item.display_merchant_logo_url}
                            alt={item.display_merchant_domain ?? "Merchant"}
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              objectFit: "cover",
                              background: "#fff",
                              border: "1px solid #eee",
                            }}
                          />
                        ) : null}
                        <h2 style={{ fontSize: "1rem", margin: 0 }}>{title}</h2>
                      </div>
                      <div style={{ marginTop: "0.35rem", color: "#4a4a4a", fontSize: "0.9rem" }}>
                        {item.display_price_text ?? "Price unavailable"}
                      </div>
                      {item.personal_note ? (
                        <p style={{ marginTop: "0.5rem", color: "#3d3d3d", fontSize: "0.9rem" }}>
                          {item.personal_note}
                        </p>
                      ) : null}
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
