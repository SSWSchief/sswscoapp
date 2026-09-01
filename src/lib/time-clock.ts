import type {
  TimeEntry,
  TimeEntryCorrection,
  TimeEntryType,
  TimeRequest,
  User,
  UserRole,
} from "./types";

/**
 * Why a viewer may not decide a time request, or `null` when they may.
 *
 * `review_time_request` enforces both rules in the database; this exists so the
 * buttons never appear for a decision that would be rejected. PTO belongs to
 * management alone, and reviewing your own request is self-approval whichever
 * kind it is — a dispatcher editing their own clock-in is the same conflict as
 * one approving their own time off.
 */
export function reviewBlockedReason(
  request: Pick<TimeRequest, "kind" | "userId">,
  viewer: Pick<User, "id" | "accessRole"> | null | undefined,
): string | null {
  if (!viewer) return "Sign in to review";
  if (request.userId === viewer.id) return "Your request";
  if (request.kind === "pto" && viewer.accessRole !== "admin")
    return "Awaiting management";
  return null;
}

/**
 * Operational roles that are on the clock.
 *
 * Owners and management are salaried and do not clock in, so they get no clock
 * control and no row in the review roster. This keys off the operational role
 * rather than the access role on purpose: a dispatcher granted administrator
 * access is still a dispatcher who works a shift, and gating on `accessRole`
 * would quietly take their time clock away.
 */
const clockableRoles: UserRole[] = ["driver", "dispatcher", "office"];

export function clocksIn(user: Pick<User, "role"> | null | undefined): boolean {
  return user ? clockableRoles.includes(user.role) : false;
}

type ClockPhase = "out" | "in" | "break";
interface TimeSummary {
  phase: ClockPhase;
  expected: TimeEntryType;
  clockIn: string | null;
  clockOut: string | null;
  breaks: Array<{ start: string; end: string | null }>;
  workedSeconds: number;
  entries: TimeEntry[];
}
const zone = "America/Los_Angeles";
export const pacificDate = (date: Date | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
const pacificHour = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);

/**
 * The instant a Pacific calendar day begins, as an ISO timestamp.
 *
 * Used to scope time-entry queries to a single working day. The offset cannot
 * be hard-coded because it changes twice a year, and it cannot be derived from
 * the date alone, so both candidates are tried and the one that really lands on
 * Pacific midnight wins. Checking the date is not enough on its own: on a PDT
 * day the PST candidate still falls inside the same date, at 1 a.m.
 */
export function pacificDayStart(day: string): string {
  for (const offset of ["-08:00", "-07:00"]) {
    const candidate = new Date(`${day}T00:00:00${offset}`);
    if (pacificDate(candidate) === day && pacificHour(candidate) === "00")
      return candidate.toISOString();
  }
  // Unreachable while US DST changes at 2 a.m. rather than midnight; standard
  // time is the safe fallback because it starts the window earlier.
  return new Date(`${day}T00:00:00-08:00`).toISOString();
}

/**
 * The exclusive upper bound for a Pacific day range ending on `day` — that is,
 * the instant the following day begins.
 */
export function pacificDayEnd(day: string): string {
  const nextDay = pacificDate(
    new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000),
  );
  return pacificDayStart(nextDay);
}

/**
 * A Pacific calendar day as a person reads it — "Thu, Aug 20". Takes the
 * YYYY-MM-DD form the day summaries are keyed by, and reads it at midday so
 * the zone conversion can never land on the day before.
 */
export const formatPacificDayLabel = (day: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));

export const formatPacificTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
export function formatHoursDuration(hours: number): string {
  const totalMinutes = Math.round(
    Math.max(0, Number.isFinite(hours) ? hours : 0) * 60,
  );
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (wholeHours && minutes) return `${wholeHours}h ${minutes}m`;
  if (wholeHours) return `${wholeHours}h`;
  return minutes ? `${minutes}m` : "0h";
}
export function applyTimeCorrections(
  entries: TimeEntry[],
  corrections: TimeEntryCorrection[],
): TimeEntry[] {
  const replaced = new Set(
    corrections.map((c) => c.originalEntryId).filter(Boolean),
  );
  const projected = entries.filter((e) => !replaced.has(e.id));
  for (const c of corrections) {
    projected.push({
      id: `correction:${c.id}`,
      userId: c.userId,
      type: c.replacementType,
      at: c.replacementAt,
      correctedByRequestId: c.requestId,
      originalEntryId: c.originalEntryId,
    });
  }
  return projected.sort((a, b) => a.at.localeCompare(b.at));
}
interface DaySummary {
  day: string;
  workedSeconds: number;
  /** The day ended while still on the clock — a missed clock-out. */
  open: boolean;
  /** Unpaid break time between the first punch and the last, in seconds. */
  breakSeconds: number;
  /** First clock-in of the day, as an ISO timestamp, or null if there was none. */
  firstIn: string | null;
  /** Last clock-out of the day, or null while the shift is still open. */
  lastOut: string | null;
  /** How many punches the day holds, corrections included. */
  entryCount: number;
}

/**
 * Worked time for one person on one finished day.
 *
 * Unlike `summarizeTime`, an unclosed shift accrues nothing beyond its last
 * recorded event. Running the live rule over history would bill a forgotten
 * clock-out through to the present, inventing hours nobody worked; payroll
 * needs the missed punch surfaced and corrected, not silently paid.
 */
export function summarizeDay(
  userId: string,
  all: TimeEntry[],
  day: string,
): DaySummary {
  const entries = all
    .filter((e) => e.userId === userId && pacificDate(e.at) === day)
    .sort((a, b) => a.at.localeCompare(b.at));
  let phase: ClockPhase = "out";
  let activeStart: number | null = null;
  let breakStart: number | null = null;
  let worked = 0;
  let breaks = 0;
  let firstIn: string | null = null;
  let lastOut: string | null = null;
  for (const entry of entries) {
    const at = new Date(entry.at).getTime();
    if (entry.type === "clock_in") {
      phase = "in";
      activeStart = at;
      firstIn ??= entry.at;
    } else if (entry.type === "break_start" && phase === "in") {
      if (activeStart !== null) worked += Math.max(0, at - activeStart);
      phase = "break";
      activeStart = null;
      breakStart = at;
    } else if (entry.type === "break_end" && phase === "break") {
      if (breakStart !== null) breaks += Math.max(0, at - breakStart);
      phase = "in";
      activeStart = at;
      breakStart = null;
    } else if (entry.type === "clock_out" && phase === "in") {
      if (activeStart !== null) worked += Math.max(0, at - activeStart);
      phase = "out";
      activeStart = null;
      lastOut = entry.at;
    }
  }
  return {
    day,
    workedSeconds: Math.floor(worked / 1000),
    open: entries.length > 0 && phase !== "out",
    breakSeconds: Math.floor(breaks / 1000),
    firstIn,
    lastOut,
    entryCount: entries.length,
  };
}

/** Every Pacific calendar day from `from` to `to`, inclusive. */
export function pacificDaysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  // Steps at midday so a DST shift never lands the cursor on the wrong date.
  while (cursor <= end && days.length <= 400) {
    days.push(pacificDate(new Date(cursor)));
    cursor += 86_400_000;
  }
  return days;
}

/** Per-day and total worked time for one person across a date range. */
export function summarizeRange(
  userId: string,
  all: TimeEntry[],
  from: string,
  to: string,
) {
  const days = pacificDaysBetween(from, to).map((day) =>
    summarizeDay(userId, all, day),
  );
  return {
    days,
    totalSeconds: days.reduce((total, day) => total + day.workedSeconds, 0),
    openDays: days.filter((day) => day.open).length,
  };
}

export function summarizeTime(
  userId: string,
  all: TimeEntry[],
  now = new Date(),
): TimeSummary {
  const day = pacificDate(now);
  const entries = all
    .filter((e) => e.userId === userId && pacificDate(e.at) === day)
    .sort((a, b) => a.at.localeCompare(b.at));
  let phase: ClockPhase = "out",
    expected: TimeEntryType = "clock_in",
    clockIn: string | null = null,
    clockOut: string | null = null,
    activeStart: number | null = null,
    worked = 0;
  const breaks: Array<{ start: string; end: string | null }> = [];
  for (const entry of entries) {
    const at = new Date(entry.at).getTime();
    if (entry.type === "clock_in") {
      phase = "in";
      expected = "break_start";
      clockIn = entry.at;
      activeStart = at;
    } else if (entry.type === "break_start" && phase === "in") {
      if (activeStart !== null) worked += Math.max(0, at - activeStart);
      phase = "break";
      expected = "break_end";
      activeStart = null;
      breaks.push({ start: entry.at, end: null });
    } else if (entry.type === "break_end" && phase === "break") {
      phase = "in";
      expected = "clock_out";
      activeStart = at;
      if (breaks.length) breaks[breaks.length - 1].end = entry.at;
    } else if (entry.type === "clock_out" && phase === "in") {
      if (activeStart !== null) worked += Math.max(0, at - activeStart);
      phase = "out";
      expected = "clock_in";
      activeStart = null;
      clockOut = entry.at;
    }
  }
  if (phase === "in" && activeStart !== null)
    worked += Math.max(0, now.getTime() - activeStart);
  return {
    phase,
    expected,
    clockIn,
    clockOut,
    breaks,
    workedSeconds: Math.floor(worked / 1000),
    entries,
  };
}

/**
 * What a time request is actually asking for, in the words the person filing
 * it would use.
 *
 * The review row previously read "Change time · 0h · <reason>", which told a
 * reviewer nothing about the change they were approving — the hours on a
 * correction are always zero, and the punch and its new time were never shown
 * at all. A request with no target entry is adding a punch that was never
 * made, and says so, because approving that is a different act from nudging
 * an existing one.
 */
export function describeTimeRequest(request: TimeRequest): string {
  if (request.kind === "pto") return `PTO · ${formatHoursDuration(request.hours)}`;
  const punch = (request.requestedEntryType ?? "clock_in").replace("_", " ");
  const at = request.requestedAt ? formatPacificTime(request.requestedAt) : null;
  if (!at) return `Change ${punch}`;
  return request.targetEntryId
    ? `Change ${punch} to ${at}`
    : `Add missing ${punch} at ${at}`;
}
