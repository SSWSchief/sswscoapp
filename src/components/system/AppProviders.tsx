"use client";

import { ToastProvider } from "./ToastProvider";
import { ConfirmProvider } from "./ConfirmProvider";
import { OfflineBanner } from "./OfflineBanner";
import { OperationsProvider } from "./OperationsProvider";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";
import { OperationsStatus } from "./OperationsStatus";

/** App-wide client providers mounted once at the root. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <OperationsProvider>
      <ToastProvider>
        <ConfirmProvider>
          <OfflineBanner />
          <OperationsStatus />
          <ServiceWorkerRegistrar />
          {children}
        </ConfirmProvider>
      </ToastProvider>
    </OperationsProvider>
  );
}
