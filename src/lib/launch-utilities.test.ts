import { afterEach, describe, expect, it, vi } from "vitest";
import { isProtectedAdministrator } from "./owners";
import { log } from "./logger";
import {
  appleMapsUrl,
  avatarColor,
  cn,
  dumpsterStatusLabel,
  formatDate,
  formatDateTime,
  formatTime,
  googleMapsUrl,
  jobStatusLabel,
  relativeTime,
  truckStatusLabel,
} from "./utils";

afterEach(() => vi.restoreAllMocks());

describe("launch utilities", () => {
  it("uses database IDs for protected administrator presentation", () => {
    expect(isProtectedAdministrator({ id: "owner" }, ["owner"])).toBe(true);
    expect(isProtectedAdministrator({ id: "other" }, ["owner"])).toBe(false);
    expect(isProtectedAdministrator(null, ["owner"])).toBe(false);
  });

  it("formats navigation, status, date, and relative time values", () => {
    expect(cn("one", false, "two", null)).toBe("one two");
    expect(formatDate("2026-08-07")).toContain("2026");
    expect(formatTime("2026-08-07T12:30:00.000Z")).toBeTruthy();
    expect(formatDateTime("2026-08-07T12:30:00.000Z")).toContain("2026");
    expect(appleMapsUrl("1 Main St")).toContain("1%20Main%20St");
    expect(googleMapsUrl("1 Main St")).toContain("destination=1%20Main%20St");
    expect(relativeTime("2026-08-07T11:59:40.000Z", Date.parse("2026-08-07T12:00:00.000Z"))).toBe("just now");
    expect(relativeTime("2026-08-07T11:45:00.000Z", Date.parse("2026-08-07T12:00:00.000Z"))).toBe("15m ago");
    expect(relativeTime("2026-08-07T09:00:00.000Z", Date.parse("2026-08-07T12:00:00.000Z"))).toBe("3h ago");
    expect(relativeTime("2026-08-04T12:00:00.000Z", Date.parse("2026-08-07T12:00:00.000Z"))).toBe("3d ago");
    expect(relativeTime("2026-07-01T12:00:00.000Z", Date.parse("2026-08-07T12:00:00.000Z"))).toContain("2026");
    expect(avatarColor("AD")).toMatch(/^bg-/);
    expect(jobStatusLabel.en_route).toBe("En Route");
    expect(truckStatusLabel.in_shop).toBe("In Shop");
    expect(dumpsterStatusLabel.in_yard).toBe("In Yard");
  });

  it("writes structured redacted logs at each level", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    log("info", "test", { email: "person@example.com", nested: ["Bearer abc"] });
    log("warn", "test", { value: "person@example.com" });
    log("error", "test", { token: "secret" });
    expect(info.mock.calls[0]?.[0]).not.toContain("person@example.com");
    expect(info.mock.calls[0]?.[0]).toContain("[REDACTED]");
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });
});
