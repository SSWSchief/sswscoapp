"use client";

import * as React from "react";

/**
 * Opens Apple's Find My app on the Items tab.
 *
 * Three limits are deliberate and visible to the user rather than hidden:
 *
 * 1. Apple publishes no AirTag API, so this hands off to their app. It cannot
 *    read a position back into Overwatch.
 * 2. The scheme addresses the Items list, not one tag — Apple offers no
 *    per-item link — so the operator picks the asset in Find My themselves.
 * 3. It only exists on Apple platforms. iCloud.com does not show AirTags at
 *    all, so there is no web fallback to offer a Windows or Android user;
 *    the button hides itself and the caller explains why.
 *
 * `findmy://` is undocumented. If a future iOS drops it the link becomes a
 * no-op, which is why nothing depends on it succeeding.
 */
const findMyItemsUrl = "findmy://items";

export function useApplePlatform(): boolean {
  // Server render and first paint assume no Apple app, so the markup matches
  // before hydration and the button only appears once the platform is known.
  const [isApple, setIsApple] = React.useState(false);
  React.useEffect(() => {
    setIsApple(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent));
  }, []);
  return isApple;
}

export function FindMyLink({ className }: { className?: string }) {
  const isApple = useApplePlatform();
  if (!isApple) return null;
  return (
    <a href={findMyItemsUrl} className={className}>
      Open Find My
    </a>
  );
}
