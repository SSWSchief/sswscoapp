"use client";

import * as React from "react";
import { Icon } from "./Icon";

/**
 * Accessible modal shell used by the Create Job / Add Truck / Add Dumpster
 * dialogs. Handles Escape to close, body scroll lock, focus restore to the
 * trigger, and a focus trap so keyboard and screen-reader users stay inside
 * the dialog.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog.
    const focusFirst = () => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable ?? panelRef.current)?.focus();
    };
    focusFirst();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes || nodes.length === 0) return;
      const list = Array.from(nodes).filter((n) => !n.hasAttribute("disabled"));
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div
        className="fixed inset-0 bg-brand-navy/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${widthClass} rounded-card bg-white shadow-xl outline-none border border-brand-ice/70`}
      >
        <div className="flex items-center justify-between bg-brand-navy px-6 py-4">
          <h2 className="font-heading text-base font-semibold uppercase tracking-wide text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close dialog"
          >
            <Icon name="close" width={20} height={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-brand-ice/60 bg-brand-mist/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
