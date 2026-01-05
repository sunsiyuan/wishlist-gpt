import { notFound } from "next/navigation";
import { getPublicShareItems, isValidShareId } from "../../../server/shares";

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
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Shared Wishlist</h1>
      <p>This list is read-only.</p>
      {items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a href={item.url_original} rel="noreferrer" target="_blank">
                {item.url_original}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
