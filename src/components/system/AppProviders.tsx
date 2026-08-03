"use client";

import { ToastProvider } from "./ToastProvider";
import { ConfirmProvider } from "./ConfirmProvider";
import { OfflineBanner } from "./OfflineBanner";
import { DemoStateProvider } from "./DemoStateProvider";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

/** App-wide client providers mounted once at the root. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DemoStateProvider>
      <ToastProvider>
        <ConfirmProvider>
          <OfflineBanner />
          <ServiceWorkerRegistrar />
          {children}
        </ConfirmProvider>
      </ToastProvider>
    </DemoStateProvider>
  );
}
