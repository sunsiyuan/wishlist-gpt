import { notFound } from "next/navigation";
import { getActiveShareById } from "../../../server/shares";

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await getActiveShareById(id);
  if (!share) {
    notFound();
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Shared Wishlist</h1>
      <p>Share ID: {share.id}</p>
      <p>This list is read-only.</p>
    </main>
  );
}
