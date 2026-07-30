import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#105499",
          navy: "#052F66",
          blue: "#105499",
          skyline: "#619BD0",
          ice: "#B1C7DA",
          silver: "#95989D",
          steel: "#626367",
          charcoal: "#1E2328",
          mist: "#F4F7FA",
          700: "#052F66",
          600: "#105499",
          500: "#105499",
          300: "#619BD0",
          100: "#D9E8F5",
          50: "#F4F7FA",
        },
        status: {
          progress: "#105499",
          pending: "#D97706",
          complete: "#15803D",
          inactive: "#626367",
        },
        surface: "#F4F7FA",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        body: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        heading: ["var(--font-oswald)", "Oswald", "Impact", "sans-serif"],
      },
      borderRadius: {
        card: "0.375rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(5,47,102,0.08), 0 8px 24px rgba(30,35,40,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
