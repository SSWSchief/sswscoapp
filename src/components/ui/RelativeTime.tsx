"use client";

import * as React from "react";
import { relativeTime } from "@/lib/utils";

/**
 * Self-updating relative timestamp. Renders the absolute time on the server and
 * first client paint (to avoid hydration mismatch), then ticks live.
 */
export function RelativeTime({ iso }: { iso: string }) {
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const label =
    now === null
      ? new Date(iso).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : relativeTime(iso, now);

  return <time dateTime={iso}>{label}</time>;
}
