"use client";

import * as React from "react";
import { BottomNav } from "./BottomNav";

interface DriverTheme {
  dark: boolean;
  toggle: () => void;
}

const DriverThemeContext = React.createContext<DriverTheme>({
  dark: false,
  toggle: () => {},
});

export const useDriverTheme = () => React.useContext(DriverThemeContext);

const STORAGE_KEY = "ssws-driver-theme";

/**
 * Mobile-first driver shell. On larger screens it presents inside a phone frame
 * so it can be demoed on a laptop. Supports an optional night mode (persisted)
 * to cut glare on evening pickups.
 */
export function DriverShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    setDark(localStorage.getItem(STORAGE_KEY) === "dark");
  }, []);

  const toggle = React.useCallback(() => {
    setDark((d) => {
      const next = !d;
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  return (
    <DriverThemeContext.Provider value={{ dark, toggle }}>
      <div className="min-h-screen bg-brand-navy flex items-center justify-center sm:py-8 dark:bg-black">
        <div className="w-full max-w-full min-w-0 sm:max-w-[420px] sm:rounded-[2.25rem] sm:border-[10px] sm:border-brand-charcoal sm:shadow-2xl overflow-hidden bg-white dark:bg-gray-950">
          <div className={dark ? "dark" : undefined}>
            <div className="flex min-w-0 flex-col h-screen sm:h-[860px] bg-surface dark:bg-gray-950">
              {children}
              <BottomNav />
            </div>
          </div>
        </div>
      </div>
    </DriverThemeContext.Provider>
  );
}
