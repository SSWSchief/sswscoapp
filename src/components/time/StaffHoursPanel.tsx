"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/StatusBadge";
import { useOperations } from "@/components/system/OperationsProvider";
import { createClient } from "@/lib/supabase/client";
import { mapTimeCorrection, mapTimeEntry } from "@/lib/supabase/mappers";
import {
  applyTimeCorrections,
  clocksIn,
  formatHoursDuration,
  formatPacificDayLabel,
  formatPacificTime,
  pacificDate,
  pacificDayEnd,
  pacificDayStart,
  summarizeRange,
} from "@/lib/time-clock";
import type { TimeEntry } from "@/lib/types";

/**
 * Hours worked per employee over a chosen range, broken down by day.
 *
 * The live operations provider deliberately holds only the current day, so
 * this loads its own window on demand rather than inflating the state every
 * portal keeps in memory.
 *
 * The per-day breakdown is the point of the panel, not a detail of it: a
 * week's total answers "what do I pay them", while the days answer "was
 * Tuesday really eleven hours" — which is the question anyone actually opens
 * this to ask, and the one that surfaces a missed clock-out before payroll
 * inherits it.
 */
export function StaffHoursPanel() {
  const { users } = useOperations();
  const [from, setFrom] = React.useState(() =>
    pacificDate(new Date(Date.now() - 6 * 86_400_000)),
  );
  const [to, setTo] = React.useState(() => pacificDate(new Date()));
  const [entries, setEntries] = React.useState<TimeEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const invalidRange = from > to;

  React.useEffect(() => {
    if (invalidRange) return;
    let cancelled = false;
    setEntries(null);
    setError(null);
    void (async () => {
      const db = createClient();
      const [rows, corrections] = await Promise.all([
        db
          .from("time_entries")
          .select("*")
          .gte("occurred_at", pacificDayStart(from))
          .lt("occurred_at", pacificDayEnd(to))
          .order("occurred_at"),
        db
          .from("time_entry_corrections")
          .select("*")
          .gte("replacement_at", pacificDayStart(from))
          .lt("replacement_at", pacificDayEnd(to)),
      ]);
      if (cancelled) return;
      if (rows.error || corrections.error) {
        setError("Hours could not be loaded.");
        return;
      }
      // Approved corrections replace the original punch, so totals here match
      // what the review workflow actually settled on.
      setEntries(
        applyTimeCorrections(
          (rows.data ?? []).map(mapTimeEntry),
          (corrections.data ?? []).map(mapTimeCorrection),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, invalidRange]);

  const staff = users.filter(
    (user) => clocksIn(user) && user.status === "active",
  );
  const rows = staff
    .map((member) => ({
      member,
      ...summarizeRange(member.id, entries ?? [], from, to),
    }))
    .sort((left, right) => right.totalSeconds - left.totalSeconds);
  const grandTotal = rows.reduce((total, row) => total + row.totalSeconds, 0);

  return (
    <Card>
      <CardHeader title="Staff Hours" />
      <div className="flex flex-wrap items-end gap-3 border-b border-brand-ice/60 p-4">
        <label className="text-xs font-semibold text-brand-charcoal">
          <span className="mb-1 block uppercase">From</span>
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-brand-charcoal">
          <span className="mb-1 block uppercase">Through</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <p className="text-xs text-brand-steel">
          Exact time, no payroll rounding. Tap an employee for their days.
        </p>
      </div>

      {invalidRange ? (
        <p className="p-5 text-sm text-brand-steel">
          Choose a From date before the Through date.
        </p>
      ) : error ? (
        <p className="p-5 text-sm text-brand-steel">{error}</p>
      ) : entries === null ? (
        <p className="p-5 text-sm text-brand-steel">Loading hours…</p>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-brand-steel">
          Nobody on the clock to report on.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-brand-ice/60">
            {rows.map((row) => {
              const open = expanded === row.member.id;
              // Days nobody punched are noise in a review; a day with a
              // missed clock-out is the opposite, so it stays.
              const worked = row.days.filter((day) => day.entryCount > 0);
              return (
                <li key={row.member.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : row.member.id)}
                    className="flex min-h-14 w-full items-center gap-3 p-4 text-left transition-colors hover:bg-brand-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-blue"
                  >
                    <Avatar
                      initials={row.member.initials}
                      src={row.member.avatarUrl}
                      alt={row.member.fullName}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-brand-charcoal">
                        {row.member.fullName}
                      </span>
                      <span className="block text-xs capitalize text-brand-steel">
                        {row.member.role}
                      </span>
                    </span>
                    {row.openDays > 0 && (
                      <Badge
                        tone="amber"
                        label={`${row.openDays} to fix`}
                      />
                    )}
                    <span className="font-medium tabular-nums text-brand-charcoal">
                      {formatHoursDuration(row.totalSeconds / 3600)}
                    </span>
                    <Icon
                      name="chevron-right"
                      width={16}
                      height={16}
                      className={`shrink-0 text-brand-silver transition-transform ${open ? "rotate-90" : ""}`}
                    />
                  </button>
                  {open && (
                    <div className="border-t border-brand-ice/50 bg-brand-mist/40 px-4 py-2">
                      {worked.length === 0 ? (
                        <p className="py-3 text-sm text-brand-steel">
                          No time recorded in this range.
                        </p>
                      ) : (
                        <ul className="divide-y divide-brand-ice/50">
                          {worked.map((day) => (
                            <li
                              key={day.day}
                              className="flex items-baseline justify-between gap-3 py-2.5"
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-brand-charcoal">
                                  {formatPacificDayLabel(day.day)}
                                </span>
                                <span className="block text-xs text-brand-steel">
                                  {day.firstIn
                                    ? formatPacificTime(day.firstIn)
                                    : "—"}
                                  {" – "}
                                  {day.lastOut ? (
                                    formatPacificTime(day.lastOut)
                                  ) : (
                                    <span className="font-semibold text-status-pending">
                                      no clock-out
                                    </span>
                                  )}
                                  {day.breakSeconds > 0 &&
                                    ` · ${formatHoursDuration(day.breakSeconds / 3600)} break`}
                                </span>
                              </span>
                              <span className="shrink-0 font-medium tabular-nums text-brand-charcoal">
                                {formatHoursDuration(day.workedSeconds / 3600)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between border-t border-brand-ice/60 p-4 text-sm">
            <span className="font-semibold uppercase tracking-wide text-brand-steel">
              Total
            </span>
            <strong className="tabular-nums text-brand-charcoal">
              {formatHoursDuration(grandTotal / 3600)}
            </strong>
          </div>
        </>
      )}
    </Card>
  );
}
