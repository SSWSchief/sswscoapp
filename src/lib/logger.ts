type Level = "info" | "warn" | "error";
const blocked = /password|secret|token|authorization|cookie|email|phone/i;
const emailValue = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerValue = /\bBearer\s+[A-Za-z0-9._~-]+/gi;
const jwtValue = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        blocked.test(k) ? "[REDACTED]" : redact(v),
      ]),
    );
  if (typeof value === "string")
    return value
      .slice(0, 500)
      .replace(emailValue, "[REDACTED_EMAIL]")
      .replace(bearerValue, "Bearer [REDACTED]")
      .replace(jwtValue, "[REDACTED_TOKEN]");
  return value;
}
export function log(
  level: Level,
  event: string,
  context: Record<string, unknown> = {},
) {
  const entry = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...(redact(context) as object),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
