import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Mirrors the base-URL resolution in the MCP tools so canonical/OG links are consistent.
const SITE_URL = process.env.BASE_URL?.replace(/\/+$/, "") ?? "https://wishlistgpt.com";

const TITLE = "WishlistGPT — Wishlist, inside ChatGPT";
const DESCRIPTION =
  "Save the products ChatGPT recommends — photos, prices and all — into a wishlist you can manage and share.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · WishlistGPT" },
  description: DESCRIPTION,
  applicationName: "WishlistGPT",
  manifest: "/site.webmanifest",
  // og:image / twitter:image come from the app/opengraph-image.tsx file convention.
  openGraph: {
    type: "website",
    siteName: "WishlistGPT",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Set the theme class before first paint so `dark:` variants are correct on load
// (no flash of the wrong theme). Mirrors DarkModeToggle: stored choice wins, else system.
const themeInit = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
