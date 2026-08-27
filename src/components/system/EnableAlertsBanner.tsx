"use client";

import * as React from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "./ToastProvider";
import { useWebPush } from "@/lib/push/useWebPush";

/**
 * Push alerts are on by default, but browsers will not hand a page the
 * notification permission without a user gesture — on iOS the prompt is only
 * allowed from a real tap. So the one unavoidable tap gets asked for here,
 * in front of the user, instead of hiding in a menu nobody opens.
 *
 * "Not now" only hides the banner for this session; declining for good is the
 * toggle in Account / Profile, which records a real opt-out.
 */
export function EnableAlertsBanner() {
  const { needsPermissionTap, subscribe } = useWebPush();
  const { toast } = useToast();
  const [dismissed, setDismissed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (!needsPermissionTap || dismissed) return null;

  const enable = async () => {
    setBusy(true);
    const result = await subscribe();
    setBusy(false);
    if (result.ok) {
      toast("Alerts are on for this device.", { tone: "success" });
      return;
    }
    setDismissed(true);
    toast(result.message ?? "Could not turn on alerts.", {
      tone: "error",
    });
  };

  return (
    // Sits above the page header, so it owns the notch inset itself.
    <div className="safe-area-banner-top safe-area-x shrink-0 border-b border-brand-blue/20 bg-brand-blue/10 pb-2.5">
      <div className="mx-auto flex w-full max-w-[100rem] items-center gap-3">
        <span className="shrink-0 text-brand-blue">
          <Icon name="bell" width={18} height={18} />
        </span>
        <p className="min-w-0 flex-1 text-xs text-brand-charcoal sm:text-sm">
          Turn on alerts so you hear about new jobs and messages.
        </p>
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="shrink-0 rounded bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Enabling…" : "Turn on"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Not now"
          className="shrink-0 rounded p-1 text-brand-steel hover:text-brand-charcoal"
        >
          <Icon name="close" width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
