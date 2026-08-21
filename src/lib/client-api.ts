"use client";

interface ErrorEnvelope {
  error?: string | { code?: string; message?: string; requestId?: string };
}

/** A failed API response, split so callers can act on the code. */
interface ApiFailure {
  code: string | null;
  message: string;
  requestId: string | null;
}

/**
 * The parts of a failure response. `code` lets a form point the administrator
 * at the field that was rejected instead of dropping the whole sentence into a
 * toast that vanishes before it can be acted on.
 */
export async function apiErrorDetail(
  response: Response,
  fallback: string,
): Promise<ApiFailure> {
  try {
    const body = (await response.json()) as ErrorEnvelope;
    const error = body.error;
    const structured = typeof error === "object" ? error : null;
    return {
      code: structured?.code ?? null,
      message:
        (typeof error === "string" ? error : structured?.message) ?? fallback,
      requestId:
        (structured
          ? structured.requestId
          : response.headers.get("x-request-id")) ?? null,
    };
  } catch {
    return { code: null, message: fallback, requestId: null };
  }
}

export async function apiErrorMessage(response: Response, fallback: string) {
  const failure = await apiErrorDetail(response, fallback);
  return `${failure.message}${failure.requestId ? ` (Reference ${failure.requestId})` : ""}`;
}
