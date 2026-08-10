"use client";

import { ToastProvider } from "./ToastProvider";
import { ConfirmProvider } from "./ConfirmProvider";
import { OfflineBanner } from "./OfflineBanner";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

/** Lightweight providers that are safe to mount on public and authenticated routes. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <OfflineBanner />
        <ServiceWorkerRegistrar />
        {children}
      </ConfirmProvider>
    </ToastProvider>
  );
}
