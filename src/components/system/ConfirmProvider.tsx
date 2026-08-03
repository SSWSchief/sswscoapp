"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
}

type Resolver = (ok: boolean) => void;

const ConfirmContext = React.createContext<
  ((opts: ConfirmOptions) => Promise<boolean>) | null
>(null);

/** `const confirm = useConfirm(); if (await confirm({...})) { ... }` */
export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) return async () => true;
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmOptions | null>(null);
  const resolver = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    setState(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setState(null);
  };

  React.useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="safe-area-all fixed inset-0 z-[90] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-brand-navy/50 backdrop-blur-[1px]"
            onClick={() => close(false)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={state.title}
            className="relative w-full max-w-sm rounded-card bg-white shadow-xl p-5 sm:p-6 border border-brand-ice"
          >
            <h2 className="font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal">
              {state.title}
            </h2>
            {state.message && (
              <p className="text-sm text-brand-steel mt-1.5">{state.message}</p>
            )}
            <div className="grid grid-cols-2 gap-3 mt-5 sm:flex sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
              <Button variant="secondary" onClick={() => close(false)}>
                {state.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={state.tone === "danger" ? "danger" : "primary"}
                onClick={() => close(true)}
                autoFocus
              >
                {state.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
