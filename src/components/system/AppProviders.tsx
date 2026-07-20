"use client";

import { ToastProvider } from "./ToastProvider";
import { ConfirmProvider } from "./ConfirmProvider";
import { OfflineBanner } from "./OfflineBanner";

/** App-wide client providers mounted once at the root. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <OfflineBanner />
        {children}
      </ConfirmProvider>
    </ToastProvider>
  );
}
