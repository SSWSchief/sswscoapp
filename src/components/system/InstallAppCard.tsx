"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppCard() {
  const [prompt, setPrompt] = React.useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = React.useState(false);
  const [ios, setIos] = React.useState(false);

  React.useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    );
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  if (standalone) return null;

  return (
    <section className="mt-3 border-y border-brand-ice/60 bg-white p-5 dark:border-white/10 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-brand-blue/10 text-brand-blue">
          <Icon name="plus" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white">
            Install Overwatch
          </h2>
          <p className="mt-1 text-sm text-brand-steel dark:text-gray-400">
            {ios
              ? "In Safari, tap Share, then Add to Home Screen for app-style access."
              : "Install Overwatch for quicker app-style access from this device."}
          </p>
          {prompt && (
            <Button
              className="mt-3"
              onClick={async () => {
                await prompt.prompt();
                await prompt.userChoice;
                setPrompt(null);
              }}
            >
              Install App
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
