"use client";

import * as React from "react";
import { appleMapsUrl, googleMapsUrl } from "@/lib/utils";

export function PlatformMapLink({ address, className, children }: { address: string; className?: string; children: React.ReactNode }) {
  const [href, setHref] = React.useState(() => googleMapsUrl(address));
  React.useEffect(() => {
    const applePlatform = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    setHref(applePlatform ? appleMapsUrl(address) : googleMapsUrl(address));
  }, [address]);
  return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>;
}
