"use client";

import * as React from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useOperations } from "@/components/system/OperationsProvider";
import { createClient } from "@/lib/supabase/client";
import { mapTimeCorrection, mapTimeEntry } from "@/lib/supabase/mappers";
import {
  applyTimeCorrections,
  clocksIn,
  formatHoursDuration,
  pacificDate,
  pacificDayEnd,
  pacificDayStart,
  summarizeRange,
} from "@/lib/time-clock";
import type { TimeEntry } from "@/lib/types";

/**
 * Hours worked per employee over a chosen range, for management.
 *
 * The live operations provider deliberately holds only the current day, so
 * this loads its own window on demand rather than inflating the state every
 * portal keeps in memory.
 */
export function StaffHoursPanel() {
  const { users } = useOperations();
  const [from, setFrom] = React.useState(() =>
    pacificDate(new Date(Date.now() - 6 * 86_400_000)),
  );
  const [to, setTo] = React.useState(() => pacificDate(new Date()));
  const [entries, setEntries] = React.useState<TimeEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
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
          Exact time, no payroll rounding.
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
      ) : (
        <>
          <Table className="hidden sm:block">
            <THead>
              <TH>Employee</TH>
              <TH>Role</TH>
              <TH>Hours</TH>
              <TH>Missed clock-outs</TH>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.member.id}>
                  <TD>
                    <span className="font-medium text-brand-charcoal">
                      {row.member.fullName}
                    </span>
                  </TD>
                  <TD className="text-brand-steel capitalize">
                    {row.member.role}
                  </TD>
                  <TD className="font-medium tabular-nums text-brand-charcoal">
                    {formatHoursDuration(row.totalSeconds / 3600)}
                  </TD>
                  <TD>
                    {row.openDays > 0 ? (
                      <Badge tone="amber" label={`${row.openDays} to fix`} />
                    ) : (
                      <span className="text-brand-steel">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <ul className="divide-y divide-brand-ice/60 sm:hidden">
            {rows.map((row) => (
              <li
                key={row.member.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-brand-charcoal">
                    {row.member.fullName}
                  </div>
                  <div className="text-xs capitalize text-brand-steel">
                    {row.member.role}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium tabular-nums text-brand-charcoal">
                    {formatHoursDuration(row.totalSeconds / 3600)}
                  </div>
                  {row.openDays > 0 && (
                    <div className="text-xs text-status-pending">
                      {row.openDays} missed clock-out
                    </div>
                  )}
                </div>
              </li>
            ))}
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
