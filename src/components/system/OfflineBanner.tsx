"use client";

import * as React from "react";

/**
 * Connectivity indicator. Job sites and landfills have poor signal, so drivers
 * and dispatch need to know when the app is offline and that their changes will
 * sync later. Driven by the browser's online/offline events; the "will sync"
 * copy anticipates the queued-write behavior the real build will implement.
 */
export function OfflineBanner() {
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="safe-area-banner-top fixed top-0 inset-x-0 z-[110] bg-amber-500 text-white text-center text-sm font-medium pb-1.5 px-4"
      role="status"
      aria-live="polite"
    >
      You&apos;re offline — reconnect before submitting changes.
    </div>
  );
}
