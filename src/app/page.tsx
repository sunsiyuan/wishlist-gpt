import Image from "next/image";
import Link from "next/link";
import { AddToChatGpt } from "./AddToChatGpt";
import { getChatGptAppUrl } from "../lib/chatgpt";
import { getSiteUrl } from "../lib/siteUrl";

// Sample items for the inline-widget preview. Real product photos (self-hosted
// under /public/preview), with titles that match the images.
const PREVIEW_ITEMS = [
  { domain: "nike.com", title: "Air Force 1 Shadow — Pastel", price: "$130", img: "/preview/sneaker.jpg" },
  { domain: "polaroid.com", title: "OneStep 2 Instant Camera", price: "$119", img: "/preview/camera.jpg" },
  { domain: "nordgreen.com", title: "Minimalist Watch — 40mm", price: "$199", img: "/preview/watch.jpg" },
];

const STEPS = [
  {
    n: "1",
    title: "ChatGPT finds it, you save it",
    body: "As you research in chat, ChatGPT recommends real products — photos and prices included. Save the ones you love (or paste a link you already have).",
  },
  {
    n: "2",
    title: "It lands in your wishlist",
    body: "Your picks render inline as a tidy widget, right in the conversation.",
  },
  {
    n: "3",
    title: "Share it in one tap",
    body: "Generate a public link so friends can see exactly what you want.",
  },
];

function WidgetPreview() {
  return (
    // A framed "canvas" that stands in for ChatGPT's surface around the widget.
    <div className="rounded-card border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light shadow-card dark:shadow-card-dark p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4 px-0.5">
        <div className="text-[0.95rem] font-bold tracking-tight">
          Your wishlist{" "}
          <span className="text-secondary dark:text-secondary-dark font-medium">· 3 items</span>
        </div>
        <span className="rounded-button border border-border dark:border-border-dark px-3 py-1.5 text-xs font-bold text-secondary dark:text-secondary-dark">
          Shared ✓
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {PREVIEW_ITEMS.map((item) => (
          <div
            key={item.domain}
            className="flex flex-col overflow-hidden rounded-card border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light"
          >
            <div className="relative aspect-square bg-sunken dark:bg-sunken-dark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.img}
                alt={item.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              {/* merchant chip, echoing the real widget's favicon badge */}
              <span className="absolute top-2 left-2 z-10 grid h-5 w-5 place-items-center rounded-[6px] border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light text-[9px] font-extrabold text-secondary dark:text-secondary-dark">
                {item.domain.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-2.5">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-secondary dark:text-secondary-dark">
                {item.domain}
              </span>
              <span className="text-xs font-semibold leading-snug line-clamp-2">{item.title}</span>
              <span className="text-sm font-extrabold tabular-nums">{item.price}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  // Set once the app ships in the ChatGPT app directory; until then visitors add the MCP
  // connector themselves via developer mode.
  const chatGptAppUrl = getChatGptAppUrl();
  const mcpUrl = `${getSiteUrl()}/api/mcp`;

  return (
    <div className="homepage-glow min-h-screen bg-background dark:bg-background-dark text-primary dark:text-primary-dark">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        {/* Nav */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2">
            <Image src="/logo-64.png" alt="" width={28} height={28} className="rounded-[7px]" />
            <span className="font-semibold tracking-tight">WishlistGPT</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="text-sm font-medium text-secondary dark:text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-colors"
            >
              Manage
            </Link>
            {chatGptAppUrl ? (
              <a
                href={chatGptAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-button bg-accent text-accent-fg px-4 py-2 text-sm font-semibold hover:bg-accent/90 transition-colors"
              >
                Open in ChatGPT
              </a>
            ) : null}
          </div>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center text-center pt-14 sm:pt-20 pb-16">
          <Image
            src="/logo-256.png"
            alt="WishlistGPT"
            width={96}
            height={96}
            priority
            className="mb-8 h-20 w-20 sm:h-24 sm:w-24"
          />
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight max-w-2xl text-balance">
            Wishlist, inside ChatGPT.
          </h1>
          <p className="mt-5 text-lg text-secondary dark:text-secondary-dark max-w-xl">
            Save the products ChatGPT recommends — photos, prices and all — into a wishlist you can
            manage and share. No new app to learn.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center gap-3">
            {chatGptAppUrl ? (
              <>
                <a
                  href={chatGptAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-button bg-accent text-accent-fg px-7 py-3 font-semibold hover:bg-accent/90 transition-colors"
                >
                  Open in ChatGPT
                </a>
                <Link
                  href="/app"
                  className="rounded-button border border-border dark:border-border-dark px-7 py-3 font-semibold hover:bg-background-light dark:hover:bg-background-dark-light transition-colors"
                >
                  Manage your wishes
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/app"
                  className="rounded-button bg-accent text-accent-fg px-7 py-3 font-semibold hover:bg-accent/90 transition-colors"
                >
                  Manage your wishes
                </Link>
                <AddToChatGpt mcpUrl={mcpUrl} />
              </>
            )}
          </div>
        </section>

        {/* Widget preview */}
        <section className="pb-20">
          <div className="mx-auto max-w-2xl">
            <WidgetPreview />
            <p className="mt-4 text-center text-sm text-secondary dark:text-secondary-dark">
              This is your list, rendered right inside the ChatGPT conversation.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="pb-24">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.1em] text-secondary dark:text-secondary-dark mb-10">
            How it works
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-card border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light p-6"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg text-sm font-bold mb-4">
                  {step.n}
                </div>
                <h3 className="font-semibold mb-1.5">{step.title}</h3>
                <p className="text-sm text-secondary dark:text-secondary-dark leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border dark:border-border-dark py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-secondary dark:text-secondary-dark">
          <span>© {new Date().getFullYear()} WishlistGPT</span>
          <nav className="flex items-center gap-5">
            <Link href="/app" className="hover:text-primary dark:hover:text-primary-dark transition-colors">
              Manage
            </Link>
            <Link href="/privacy" className="hover:text-primary dark:hover:text-primary-dark transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-primary dark:hover:text-primary-dark transition-colors">
              Terms
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
