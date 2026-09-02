"use client";
import { useOperations } from "./OperationsProvider";

export function OperationsStatus() {
  const { connectionState, connectionMessage, refresh } = useOperations();
  if (connectionState === "ready" || connectionState === "loading") return null;

  /**
   * "unauthorized" used to render nothing, which made the worst failure the
   * quietest one: with no profile loaded every query is filtered out by row
   * level security, so dispatch saw "Total 0 dumpsters" and an empty job list
   * and had no way to tell that from the truth. It is now the loudest state on
   * the screen, because empty data presented as fact is worse than an outage.
   */
  const unauthorized = connectionState === "unauthorized";
  return (
    <div
      role={unauthorized ? "alert" : "status"}
      className={`fixed inset-x-0 top-0 z-[120] flex min-h-11 flex-wrap items-center justify-center gap-3 px-4 py-2 text-center text-sm font-medium shadow ${
        unauthorized
          ? "bg-red-700 text-white"
          : "bg-amber-100 text-amber-950"
      }`}
    >
      <span>
        {unauthorized
          ? (connectionMessage ??
            "You are not signed in, so no records can be shown. Anything on screen is incomplete.")
          : connectionMessage}
      </span>
      {unauthorized ? (
        <a
          href="/login"
          className="rounded border border-white px-2 py-1 text-xs font-semibold uppercase"
        >
          Sign in again
        </a>
      ) : (
        connectionState !== "offline" && (
          <button
            onClick={() => void refresh()}
            className="rounded border border-amber-700 px-2 py-1 text-xs font-semibold uppercase"
          >
            Retry
          </button>
        )
      )}
    </div>
  );
}
