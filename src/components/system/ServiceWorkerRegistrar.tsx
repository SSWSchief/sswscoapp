"use client";

import * as React from "react";

export function ServiceWorkerRegistrar() {
  const [waiting, setWaiting] = React.useState<ServiceWorker | null>(null);
  const reloadOnControllerChange = React.useRef(false);

  React.useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    const onControllerChange = () => {
      if (!reloadOnControllerChange.current) return;
      reloadOnControllerChange.current = false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setWaiting(worker);
          });
        });
      })
      .catch(() => {
        // The app remains usable online when registration is unavailable.
      });
    return () =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
  }, []);

  if (!waiting) return null;
  return (
    <div
      className="safe-area-toast fixed inset-x-4 z-[105] mx-auto flex max-w-md items-center gap-3 rounded-card bg-brand-navy p-3 text-white shadow-xl"
      role="status"
    >
      <span className="min-w-0 flex-1 text-sm">
        A new version of Overwatch is ready.
      </span>
      <button
        onClick={() => {
          reloadOnControllerChange.current = true;
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
        className="min-h-11 rounded bg-white px-3 text-sm font-semibold text-brand-navy"
      >
        Update
      </button>
    </div>
  );
}
