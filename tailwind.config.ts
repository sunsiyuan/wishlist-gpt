import type { Config } from "tailwindcss";

/**
 * Design language: "Crisp" — TikTok discipline in a neutral palette.
 * Near-B/W, one accent (#FE2C55) used sparingly, uniform radius, bold sans.
 * Token names are preserved so existing `bg-primary` / `border-border` / `shadow-card`
 * usages re-skin automatically.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0A0A0A", // ink
          dark: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#6B6B70", // muted neutral
          dark: "#9A9AA0",
        },
        background: {
          DEFAULT: "#FAFAFA", // page
          light: "#FFFFFF", // surface / cards
          dark: "#000000", // true black page
          "dark-light": "#161618", // surface / cards in dark
        },
        border: {
          DEFAULT: "#EAEAEA",
          light: "#F0F0F0",
          dark: "#262628",
        },
        // The single accent — primary actions, active state, focus. Used sparingly.
        accent: {
          DEFAULT: "#FE2C55",
          dark: "#FE2C55",
          fg: "#FFFFFF",
        },
        // Semantic status — kept distinct from the accent.
        error: {
          DEFAULT: "#E5484D",
          dark: "#F16A6E",
        },
        success: {
          DEFAULT: "#30A46C",
          dark: "#4CC38A",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        pill: "999px",
        card: "14px",
        button: "10px", // one radius for every button
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)",
        "card-dark": "0 1px 2px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5)",
        modal: "0 -12px 24px rgba(0,0,0,0.12)",
        "modal-dark": "0 -12px 24px rgba(0,0,0,0.5)",
        toast: "0 8px 24px rgba(0,0,0,0.18)",
        "toast-dark": "0 10px 30px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
