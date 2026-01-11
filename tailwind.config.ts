import type { Config } from "tailwindcss";

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
          DEFAULT: "#111",
          dark: "#fff",
        },
        secondary: {
          DEFAULT: "#6b6b6b",
          dark: "#9ca3af",
        },
        background: {
          DEFAULT: "#f7f7f7",
          light: "#fff",
          dark: "#111827",
          "dark-light": "#1f2937",
        },
        border: {
          DEFAULT: "#e3e3e3",
          light: "#ececec",
          dark: "#374151",
        },
        error: {
          DEFAULT: "#b91c1c",
          dark: "#ef4444",
        },
        success: {
          DEFAULT: "#166534",
          dark: "#22c55e",
        },
      },
      borderRadius: {
        pill: "999px",
        card: "18px",
        button: "12px",
      },
      boxShadow: {
        card: "0 10px 24px rgba(17, 17, 17, 0.08)",
        "card-dark": "0 10px 24px rgba(0, 0, 0, 0.3)",
        modal: "0 -12px 24px rgba(0,0,0,0.2)",
        "modal-dark": "0 -12px 24px rgba(0,0,0,0.5)",
        toast: "0 12px 24px rgba(0, 0, 0, 0.2)",
        "toast-dark": "0 12px 24px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
