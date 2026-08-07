import { NextResponse } from "next/server";
import { log } from "./logger";

interface ApiError {
  code: string;
  message: string;
  requestId: string;
}

export function requestId(request: Request): string {
  return request.headers.get("x-vercel-id") ?? crypto.randomUUID();
}

export function apiSuccess<T>(data: T, requestIdValue: string, status = 200) {
  return NextResponse.json(
    { data, requestId: requestIdValue },
    { status, headers: { "x-request-id": requestIdValue } },
  );
}

export function apiFailure(
  code: string,
  message: string,
  status: number,
  requestIdValue: string,
) {
  const error: ApiError = { code, message, requestId: requestIdValue };
  return NextResponse.json(
    { error },
    { status, headers: { "x-request-id": requestIdValue } },
  );
}

export function logRequest(
  level: "info" | "warn" | "error",
  event: string,
  context: {
    requestId: string;
    route: string;
    method: string;
    startedAt: number;
    status: number;
    code?: string;
  },
) {
  log(level, event, {
    requestId: context.requestId,
    route: context.route,
    method: context.method,
    status: context.status,
    code: context.code,
    durationMs: Date.now() - context.startedAt,
  });
}
