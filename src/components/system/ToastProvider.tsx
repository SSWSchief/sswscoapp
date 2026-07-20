"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info" | "error";

interface ToastOptions {
  tone?: ToastTone;
  /** Optional action button (e.g. Undo). */
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface Toast extends Required<Omit<ToastOptions, "action">> {
  id: number;
  message: string;
  action?: ToastOptions["action"];
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    // No-op fallback so components never crash outside a provider.
    return { toast: () => {} };
  }
  return ctx;
}

const toneMeta: Record<ToastTone, { icon: IconName; className: string }> = {
  success: { icon: "check", className: "text-status-complete" },
  info: { icon: "info", className: "text-brand-500" },
  error: { icon: "info", className: "text-red-500" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = ++idRef.current;
      const duration = options.duration ?? 4000;
      setToasts((t) => [
        ...t,
        { id, message, tone: options.tone ?? "info", duration, action: options.action },
      ]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 w-full max-w-sm px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const meta = toneMeta[t.tone];
          return (
            <div
              key={t.id}
              className="w-full flex items-center gap-3 rounded-lg bg-gray-900 text-white shadow-lg px-4 py-3 animate-[toastIn_.18s_ease-out]"
            >
              <Icon name={meta.icon} width={18} height={18} className={cn("shrink-0", meta.className)} />
              <span className="text-sm flex-1">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="text-sm font-semibold text-brand-500 hover:text-brand-500/80"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="text-white/50 hover:text-white"
                aria-label="Dismiss"
              >
                <Icon name="close" width={16} height={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
