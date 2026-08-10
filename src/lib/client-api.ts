"use client";

interface ErrorEnvelope {
  error?: string | { message?: string; requestId?: string };
}

export async function apiErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ErrorEnvelope;
    const message =
      typeof body.error === "string" ? body.error : body.error?.message;
    const id =
      typeof body.error === "object"
        ? body.error?.requestId
        : response.headers.get("x-request-id");
    return `${message ?? fallback}${id ? ` (Reference ${id})` : ""}`;
  } catch {
    return fallback;
  }
}
