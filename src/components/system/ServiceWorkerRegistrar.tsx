"use client";

import * as React from "react";

/** How often an open tab re-checks whether it is still the current build. */
const VERSION_POLL_MS = 5 * 60 * 1000;

export function ServiceWorkerRegistrar() {
  const [waiting, setWaiting] = React.useState<ServiceWorker | null>(null);
  const [stale, setStale] = React.useState(false);
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

  // A deploy that does not touch /sw.js produces no "updatefound" at all, so
  // the check above cannot notice ordinary releases. Ask the server what it is
  // serving instead: an installed PWA that is never closed would otherwise run
  // the bundle it first loaded indefinitely and quietly miss every fix.
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const own = process.env.NEXT_PUBLIC_RELEASE;
    if (!own || own === "local") return;
    let cancelled = false;

    const check = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { release?: string };
        if (!cancelled && body.release && body.release !== own) setStale(true);
      } catch {
        // Offline or mid-deploy; the next check settles it.
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), VERSION_POLL_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  if (!waiting && !stale) return null;
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
          if (waiting) {
            reloadOnControllerChange.current = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
            return;
          }
          window.location.reload();
        }}
        className="min-h-11 rounded bg-white px-3 text-sm font-semibold text-brand-navy"
      >
        Update
      </button>
    </div>
  );
}
