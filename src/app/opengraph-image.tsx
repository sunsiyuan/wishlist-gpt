import { ImageResponse } from "next/og";

// Social / directory link-preview card. Rendered by next/og (Satori) at build time.
export const alt = "WishlistGPT — Wishlist, inside ChatGPT";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0A0A0A",
          color: "#FFFFFF",
          padding: "84px",
          fontFamily: "sans-serif",
        }}
      >
        {/* accent glow */}
        <div
          style={{
            position: "absolute",
            top: -180,
            left: 420,
            width: 640,
            height: 480,
            background: "#FE2C55",
            opacity: 0.22,
            filter: "blur(120px)",
            display: "flex",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 22, height: 22, borderRadius: 7, background: "#FE2C55", display: "flex" }} />
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -1 }}>WishlistGPT</div>
        </div>
        <div
          style={{
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.05,
            marginTop: 44,
          }}
        >
          Wishlist, inside ChatGPT.
        </div>
        <div style={{ fontSize: 34, color: "#9A9AA0", marginTop: 30, maxWidth: 900 }}>
          Save the products ChatGPT recommends — manage &amp; share.
        </div>
      </div>
    ),
    { ...size },
  );
}
