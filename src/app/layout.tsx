import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/system/AppProviders";

export const metadata: Metadata = {
  title: "SSWS Operations Platform",
  description:
    "Silver State Waste Solutions — Internal Operations Platform (Phase 1 MVP).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
