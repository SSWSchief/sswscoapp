export type OperationsConnectionState =
  | "loading"
  | "ready"
  | "stale"
  | "offline"
  | "unauthorized"
  | "error";

/**
 * A failed background read must not strand dispatch when the database can
 * still accept a server-validated command. `stale` is only entered after a
 * successful load while the browser still reports an online connection.
 * Offline, signed-out, and never-loaded screens remain read-only.
 */
export function canAttemptOperation(state: OperationsConnectionState) {
  return state === "ready" || state === "stale";
}

export function operationErrorContext(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    return {
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      message:
        typeof candidate.message === "string" ? candidate.message : "unknown",
      details:
        typeof candidate.details === "string" ? candidate.details : undefined,
      hint: typeof candidate.hint === "string" ? candidate.hint : undefined,
    };
  }
  return { message: String(error ?? "unknown") };
}
