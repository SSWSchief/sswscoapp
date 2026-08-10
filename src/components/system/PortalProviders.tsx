"use client";

import { ExpandedOperationsProvider } from "./ExpandedOperationsProvider";
import { OperationsProvider } from "./OperationsProvider";
import { OperationsStatus } from "./OperationsStatus";

/** Authenticated operational state is intentionally absent from public/auth routes. */
export function PortalProviders({ children }: { children: React.ReactNode }) {
  return (
    <OperationsProvider>
      <ExpandedOperationsProvider>
        <OperationsStatus />
        {children}
      </ExpandedOperationsProvider>
    </OperationsProvider>
  );
}
