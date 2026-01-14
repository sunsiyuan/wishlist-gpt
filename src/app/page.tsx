import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="homepage-bg min-h-screen flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 max-w-md w-full">
        {/* Logo */}
        <div className="relative w-40 h-40">
          <Image
            src="/logo-512.png"
            alt="WishlistGPT Logo"
            width={160}
            height={160}
            className="w-full h-full object-contain"
            priority
          />
        </div>

        {/* Headline */}
        <h1 className="text-3xl md:text-4xl font-semibold text-gray-100 text-center">
          Wishlist, inside ChatGPT.
        </h1>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Primary Button */}
          <Link
            href="/go/chatgpt"
            className="w-full px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors text-center"
          >
            Open in ChatGPT
          </Link>

          {/* Secondary Link */}
          <Link
            href="/app"
            className="text-sm text-gray-400/60 underline hover:text-gray-400/80 transition-colors"
          >
            Manage your wishes
          </Link>
        </div>
      </div>
    </div>
  );
}
