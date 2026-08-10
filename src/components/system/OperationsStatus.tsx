"use client";
import { useOperations } from "./OperationsProvider";

export function OperationsStatus() {
  const { connectionState, connectionMessage, refresh } = useOperations();
  if (
    connectionState === "ready" ||
    connectionState === "loading" ||
    connectionState === "unauthorized"
  )
    return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[120] flex min-h-11 items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow"
    >
      <span>{connectionMessage}</span>
      {connectionState !== "offline" && (
        <button
          onClick={() => void refresh()}
          className="rounded border border-amber-700 px-2 py-1 text-xs font-semibold uppercase"
        >
          Retry
        </button>
      )}
    </div>
  );
}
