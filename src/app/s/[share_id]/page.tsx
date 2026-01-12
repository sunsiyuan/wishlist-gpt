import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicShareItems, isValidShareId } from "../../../server/shares";
import ShareViewTracker from "./ShareViewTracker";
import SharePageClient from "./SharePageClient";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ share_id: string }>;
  searchParams?: Promise<{ intent?: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
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
    <>
      <ShareViewTracker shareId={shareId} />
      <SharePageClient items={items} shareId={shareId} locale={locale} />
    </>
  );
}
