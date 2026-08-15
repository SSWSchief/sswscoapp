import { describe, expect, it } from "vitest";
import {
  applyTimeCorrections,
  clocksIn,
  formatPacificTime,
  formatHoursDuration,
  pacificDate,
  pacificDayEnd,
  pacificDaysBetween,
  pacificDayStart,
  reviewBlockedReason,
  summarizeDay,
  summarizeRange,
  summarizeTime,
} from "./time-clock";
import type { TimeEntry, TimeEntryCorrection, User } from "./types";
const entry = (id: string, type: TimeEntry["type"], at: string): TimeEntry => ({
  id,
  userId: "u1",
  type,
  at,
});
describe("summarizeTime", () => {
  it("totals active time and excludes breaks", () => {
    const rows = [
      entry("1", "clock_in", "2026-08-06T15:00:00Z"),
      entry("2", "break_start", "2026-08-06T17:00:00Z"),
      entry("3", "break_end", "2026-08-06T17:30:00Z"),
      entry("4", "clock_out", "2026-08-06T20:00:00Z"),
    ];
    const result = summarizeTime("u1", rows, new Date("2026-08-06T21:00:00Z"));
    expect(result.phase).toBe("out");
    expect(result.workedSeconds).toBe(4.5 * 3600);
    expect(result.expected).toBe("clock_in");
  });
  it("reports the next strict event", () => {
    const result = summarizeTime(
      "u1",
      [entry("1", "clock_in", "2026-08-06T15:00:00Z")],
      new Date("2026-08-06T16:00:00Z"),
    );
    expect(result.phase).toBe("in");
    expect(result.expected).toBe("break_start");
  });
});
describe("applyTimeCorrections", () => {
  it("projects approved corrections without mutating source entries", () => {
    const rows = [
      entry("1", "clock_in", "2026-08-06T15:00:00Z"),
      entry("2", "clock_out", "2026-08-06T20:00:00Z"),
    ];
    const corrections: TimeEntryCorrection[] = [
      {
        id: "c1",
        requestId: "r1",
        originalEntryId: "2",
        userId: "u1",
        replacementType: "clock_out",
        replacementAt: "2026-08-06T21:00:00Z",
      },
    ];
    const projected = applyTimeCorrections(rows, corrections);
    expect(rows[1].at).toBe("2026-08-06T20:00:00Z");
    expect(projected.map((row) => row.id)).toEqual(["1", "correction:c1"]);
    expect(
      summarizeTime("u1", projected, new Date("2026-08-06T22:00:00Z"))
        .workedSeconds,
    ).toBe(6 * 3600);
  });
});
describe("formatHoursDuration", () => {
  it("renders decimal hours as readable hours and minutes", () => {
    expect(formatHoursDuration(2.76)).toBe("2h 46m");
    expect(formatHoursDuration(34.5)).toBe("34h 30m");
    expect(formatHoursDuration(0.5)).toBe("30m");
    expect(formatHoursDuration(0)).toBe("0h");
  });

  it("formats dates and times in the operating timezone", () => {
    expect(pacificDate("2026-08-07T06:30:00Z")).toBe("2026-08-06");
    expect(formatPacificTime("2026-08-07T06:30:00Z")).toBe("11:30 PM");
  });
});

describe("clocksIn", () => {
  const member = (role: User["role"]) => ({ role });

  it("puts drivers, dispatch, and office on the clock", () => {
    expect(clocksIn(member("driver"))).toBe(true);
    expect(clocksIn(member("dispatcher"))).toBe(true);
    expect(clocksIn(member("office"))).toBe(true);
  });

  it("keeps management and owners off the clock", () => {
    expect(clocksIn(member("management"))).toBe(false);
  });

  it("treats a missing user as not clocking in", () => {
    expect(clocksIn(null)).toBe(false);
    expect(clocksIn(undefined)).toBe(false);
  });
});

describe("pacificDayStart", () => {
  it("uses daylight time in summer", () => {
    expect(pacificDayStart("2026-08-06")).toBe("2026-08-06T07:00:00.000Z");
  });

  it("uses standard time in winter", () => {
    expect(pacificDayStart("2026-01-15")).toBe("2026-01-15T08:00:00.000Z");
  });

  it("lands on real midnight across both DST changeovers", () => {
    // Spring forward and fall back. The offset cannot be inferred from the date
    // alone, and the standard-time candidate also falls inside a daylight date
    // — at 1 a.m. — so a date-only check would silently pick the wrong one.
    for (const day of ["2026-03-08", "2026-11-01"]) {
      expect(pacificDate(pacificDayStart(day))).toBe(day);
      expect(formatPacificTime(pacificDayStart(day))).toBe("12:00 AM");
    }
  });

  it("starts a window that excludes the previous day's final entry", () => {
    const start = pacificDayStart("2026-08-06");
    // 11:59 PM on the 5th Pacific is 06:59Z on the 6th — inside the UTC day but
    // outside the Pacific one, which is exactly the boundary the query relies on.
    expect(Date.parse("2026-08-06T06:59:00Z") < Date.parse(start)).toBe(true);
  });
});

describe("reviewBlockedReason", () => {
  const dispatcher = { id: "d1", accessRole: "dispatcher" as const };
  const owner = { id: "a1", accessRole: "admin" as const };

  it("lets dispatch approve someone else's time correction", () => {
    expect(
      reviewBlockedReason({ kind: "edit_time", userId: "other" }, dispatcher),
    ).toBeNull();
  });

  it("sends PTO to management even when dispatch could otherwise review", () => {
    expect(
      reviewBlockedReason({ kind: "pto", userId: "other" }, dispatcher),
    ).toBe("Awaiting management");
  });

  it("lets an owner approve someone else's PTO", () => {
    expect(reviewBlockedReason({ kind: "pto", userId: "other" }, owner)).toBeNull();
  });

  it("blocks self-review for both kinds, owners included", () => {
    expect(reviewBlockedReason({ kind: "pto", userId: "d1" }, dispatcher)).toBe(
      "Your request",
    );
    expect(
      reviewBlockedReason({ kind: "edit_time", userId: "d1" }, dispatcher),
    ).toBe("Your request");
    expect(reviewBlockedReason({ kind: "pto", userId: "a1" }, owner)).toBe(
      "Your request",
    );
  });

  it("blocks review when nobody is signed in", () => {
    expect(reviewBlockedReason({ kind: "pto", userId: "other" }, null)).toBe(
      "Sign in to review",
    );
  });
});

describe("summarizeDay", () => {
  it("totals a closed shift and excludes the break", () => {
    const rows = [
      entry("1", "clock_in", "2026-08-06T15:00:00Z"),
      entry("2", "break_start", "2026-08-06T17:00:00Z"),
      entry("3", "break_end", "2026-08-06T17:30:00Z"),
      entry("4", "clock_out", "2026-08-06T23:00:00Z"),
    ];
    const day = summarizeDay("u1", rows, "2026-08-06");
    expect(day.workedSeconds).toBe(7.5 * 3600);
    expect(day.open).toBe(false);
  });

  it("does not invent hours when someone forgets to clock out", () => {
    // The live view accrues an open shift up to now, which is right for today
    // and wrong for history: run over a past day it would pay out every hour
    // since. Payroll needs the missed punch flagged, not silently billed.
    const rows = [
      entry("1", "clock_in", "2026-08-06T15:00:00Z"),
      entry("2", "break_start", "2026-08-06T19:00:00Z"),
    ];
    const day = summarizeDay("u1", rows, "2026-08-06");
    expect(day.workedSeconds).toBe(4 * 3600);
    expect(day.open).toBe(true);
  });

  it("ignores other people and other days", () => {
    const rows = [
      entry("1", "clock_in", "2026-08-06T15:00:00Z"),
      entry("2", "clock_out", "2026-08-06T17:00:00Z"),
      { ...entry("3", "clock_in", "2026-08-07T15:00:00Z") },
      { ...entry("4", "clock_in", "2026-08-06T15:00:00Z"), userId: "u2" },
    ];
    expect(summarizeDay("u1", rows, "2026-08-06").workedSeconds).toBe(2 * 3600);
  });

  it("reports a day with no entries as closed and empty", () => {
    expect(summarizeDay("u1", [], "2026-08-06")).toEqual({
      day: "2026-08-06",
      workedSeconds: 0,
      open: false,
    });
  });
});

describe("pacificDaysBetween", () => {
  it("includes both ends", () => {
    expect(pacificDaysBetween("2026-08-04", "2026-08-06")).toEqual([
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
    ]);
  });

  it("returns a single day when the ends match", () => {
    expect(pacificDaysBetween("2026-08-06", "2026-08-06")).toEqual([
      "2026-08-06",
    ]);
  });

  it("does not skip or repeat a day across a DST change", () => {
    // Stepping at midday keeps the cursor clear of the 1am/3am shift, so a
    // 23-hour and a 25-hour day both still count once.
    const spring = pacificDaysBetween("2026-03-07", "2026-03-09");
    expect(spring).toEqual(["2026-03-07", "2026-03-08", "2026-03-09"]);
    const fall = pacificDaysBetween("2026-10-31", "2026-11-02");
    expect(fall).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("summarizeRange", () => {
  it("adds up days and counts the ones needing a correction", () => {
    const rows = [
      entry("1", "clock_in", "2026-08-05T15:00:00Z"),
      entry("2", "clock_out", "2026-08-05T23:00:00Z"),
      entry("3", "clock_in", "2026-08-06T15:00:00Z"),
    ];
    const range = summarizeRange("u1", rows, "2026-08-05", "2026-08-06");
    expect(range.totalSeconds).toBe(8 * 3600);
    expect(range.openDays).toBe(1);
    expect(range.days).toHaveLength(2);
  });
});

describe("pacificDayEnd", () => {
  it("is the start of the following day, so the range excludes it", () => {
    expect(pacificDayEnd("2026-08-06")).toBe(pacificDayStart("2026-08-07"));
  });

  it("covers the last minute of the day it ends on", () => {
    const end = pacificDayEnd("2026-08-06");
    // 11:59 PM Pacific on the 6th is 06:59Z on the 7th, and must fall inside.
    expect(Date.parse("2026-08-07T06:59:00Z") < Date.parse(end)).toBe(true);
  });
});
