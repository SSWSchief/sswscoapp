import type { Config } from "tailwindcss";

/**
 * Design tokens taken directly from the Phase 1 MVP wireframes
 * (reference images, section 20 "Color Palette & Icons").
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          DEFAULT: "#0047A1", // primary deep blue (sidebar, primary buttons)
          600: "#0047A1",
          500: "#1976D2", // secondary blue (links, in-progress)
          50: "#EAF1FB",
        },
        // Status system
        status: {
          progress: "#1976D2", // In Progress
          pending: "#F59E0B", // Pending
          complete: "#22C55E", // Completed / In Use / Active
          inactive: "#6B7280", // In Shop / Out of Service
        },
        surface: "#F3F4F6", // app background
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
      },
      borderRadius: {
        card: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
