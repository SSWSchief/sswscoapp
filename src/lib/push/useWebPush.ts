"use client";

import * as React from "react";
import { getPublicVapidKey } from "./env";
import { urlBase64ToUint8Array } from "./utils";

export type WebPushStatus =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "default"
  | "granted"
  | "denied";

export interface WebPushResult {
  ok: boolean;
  message?: string;
}

/**
 * Message alerts are on by default; only an explicit opt-out turns them off.
 * Stored per device because a push subscription *is* per device — opting out
 * on a personal phone should not silence the truck tablet.
 */
const OPT_OUT_KEY = "ssws-push-opt-out";

function readOptOut() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOptOut(value: boolean) {
  try {
    if (value) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // Private browsing; the in-memory state still drives this session.
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** The key is inlined at build time, so a missing one is a deploy problem. */
function vapidKeyConfigured() {
  try {
    getPublicVapidKey();
    return true;
  } catch {
    return false;
  }
}

export function useWebPush() {
  const [status, setStatus] = React.useState<WebPushStatus>("loading");
  const [optedOut, setOptedOut] = React.useState(false);

  React.useEffect(() => setOptedOut(readOptOut()), []);

  const evaluate = React.useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (isIos() && !isStandalone()) {
      setStatus("unsupported");
      return;
    }
    // Surfaced as its own state rather than a failed tap: without this the
    // button looked available, did nothing when pressed, and left no trace.
    if (!vapidKeyConfigured()) {
      setStatus("unconfigured");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    if (Notification.permission !== "granted") {
      setStatus("default");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setStatus(subscription ? "granted" : "default");
  }, []);

  React.useEffect(() => {
    void evaluate();
  }, [evaluate]);

  // Default-on: where the browser has already granted permission, no tap is
  // required to register a subscription, so do it automatically. This covers
  // the common silent failure of a device that was granted permission once but
  // whose subscription has since lapsed — reinstall, cleared storage, or an
  // expiry pruned by /api/messages/notify — after which alerts simply stop.
  React.useEffect(() => {
    if (status !== "default" || optedOut) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    let cancelled = false;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(getPublicVapidKey()),
          }));
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
        if (!cancelled) setStatus("granted");
      } catch {
        // Leave the toggle showing "off" so it can still be tapped.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, optedOut]);

  const subscribe = React.useCallback(async (): Promise<WebPushResult> => {
    try {
      if (!vapidKeyConfigured()) {
        setStatus("unconfigured");
        return {
          ok: false,
          message:
            "Push notifications are not configured for this deployment yet.",
        };
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
        return {
          ok: false,
          message:
            permission === "denied"
              ? "Notifications are blocked. Enable them for this app in your phone's settings."
              : "Notification permission was not granted.",
        };
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(getPublicVapidKey()),
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!response.ok) {
        return {
          ok: false,
          message: "Could not save your notification settings. Try again.",
        };
      }
      writeOptOut(false);
      setOptedOut(false);
      setStatus("granted");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? `Could not turn on notifications: ${error.message}`
            : "Could not turn on notifications.",
      };
    }
  }, []);

  const unsubscribe = React.useCallback(async (): Promise<WebPushResult> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
      // Recorded so the default-on behaviour above does not immediately
      // re-subscribe the device on the next render.
      writeOptOut(true);
      setOptedOut(true);
      setStatus("default");
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not turn off notifications." };
    }
  }, []);

  /**
   * True when alerts are meant to be on but the browser still needs the one
   * tap it will not let the page perform on its own (iOS requires a user
   * gesture for the permission prompt). Drives the enable banner.
   */
  const needsPermissionTap =
    status === "default" && !optedOut && typeof Notification !== "undefined"
      ? Notification.permission === "default"
      : false;

  return { status, optedOut, needsPermissionTap, subscribe, unsubscribe };
}
