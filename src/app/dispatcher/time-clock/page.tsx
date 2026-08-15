"use client";

import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useOperations } from "@/components/system/OperationsProvider";
import { useTimeClock } from "@/components/system/useTimeClock";
import { TimeRequestModal } from "@/components/time/TimeRequestModal";
import {
  clocksIn,
  reviewBlockedReason,
  summarizeTime,
  formatPacificTime,
  pacificDate,
} from "@/lib/time-clock";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/system/ToastProvider";
import type { TimeEntry, TimeRequest, User } from "@/lib/types";

// Time Clock — dispatch review of employee time, and the desk clock for staff
// who are on it themselves (PRD §4 Time Clock).
export default function TimeClockPage() {
  const {
    users,
    currentUser,
    timeEntries,
    timeRequests: requests,
    reviewTimeRequest,
    canMutate,
  } = useOperations();
  const { toast } = useToast();

  // Owners and management are salaried, so the roster is the people actually on
  // the clock — drivers plus dispatch and office — split so the driver view
  // dispatch already knows stays recognisable.
  const roster = users.filter(
    (user) => clocksIn(user) && user.status === "active",
  );
  const groups = [
    {
      label: "Drivers",
      members: roster.filter((user) => user.role === "driver"),
    },
    {
      label: "Dispatch & Office",
      members: roster.filter((user) => user.role !== "driver"),
    },
  ].filter((group) => group.members.length > 0);

  const decide = async (id: string, decision: "approved" | "denied") => {
    const result = await reviewTimeRequest(id, decision);
    toast(result.ok ? `Request ${decision}` : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
  };

  return (
    <>
      <Topbar title="Time Clock" />
      <div className="portal-content">
        {clocksIn(currentUser) ? <MyTimeCard /> : null}
        {groups.map((group) => (
          <TimeRoster
            key={group.label}
            label={group.label}
            members={group.members}
            timeEntries={timeEntries}
            className={clocksIn(currentUser) ? "mt-5" : undefined}
          />
        ))}
        <Card className="mt-5">
          <div className="px-5 py-4 border-b border-brand-ice/60">
            <h2 className="font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal">
              Time Change / PTO Requests
            </h2>
            <p className="text-xs text-brand-steel mt-0.5">
              PTO is approved by management. Nobody reviews their own request.
            </p>
          </div>
          <div className="divide-y divide-brand-ice/50">
            {requests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                author={users.find((user) => user.id === request.userId)}
                viewer={currentUser}
                canMutate={canMutate}
                onDecide={decide}
              />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

/** The signed-in staff member's own clock, for dispatch and office. */
function MyTimeCard() {
  const {
    phase,
    canMutate,
    hhmmss,
    todayDuration,
    startedAt,
    statusText,
    clockIn,
    startBreak,
    endBreak,
    clockOut,
  } = useTimeClock();
  const [requestKind, setRequestKind] = React.useState<
    "edit_time" | "pto" | null
  >(null);

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal">
            My Time
          </h2>
          <p className="mt-0.5 text-sm text-brand-steel">
            {statusText}
            {startedAt ? ` · Started ${startedAt}` : ""} · {todayDuration} today
          </p>
          <div className="mt-2 font-heading text-4xl font-bold tabular-nums text-brand-charcoal">
            {hhmmss}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {phase === "out" ? (
            <Button disabled={!canMutate} onClick={() => void clockIn()}>
              Clock In
            </Button>
          ) : (
            <>
              {phase === "in" ? (
                <Button
                  variant="secondary"
                  disabled={!canMutate}
                  onClick={() => void startBreak()}
                >
                  Start Break
                </Button>
              ) : (
                <Button disabled={!canMutate} onClick={() => void endBreak()}>
                  End Break
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={!canMutate}
                onClick={() => void clockOut()}
              >
                Clock Out
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-brand-ice/60 pt-4">
        <Button
          variant="secondary"
          disabled={!canMutate}
          onClick={() => setRequestKind("edit_time")}
        >
          Change Time
        </Button>
        <Button
          variant="secondary"
          disabled={!canMutate}
          onClick={() => setRequestKind("pto")}
        >
          Request PTO
        </Button>
      </div>
      {requestKind && (
        <TimeRequestModal
          open
          kind={requestKind}
          onClose={() => setRequestKind(null)}
        />
      )}
    </Card>
  );
}

function TimeRoster({
  label,
  members,
  timeEntries,
  className,
}: {
  label: string;
  members: User[];
  timeEntries: TimeEntry[];
  className?: string;
}) {
  const rows = members.map((member) => {
    const summary = summarizeTime(member.id, timeEntries);
    const hours = Math.floor(summary.workedSeconds / 3600);
    const minutes = Math.floor((summary.workedSeconds % 3600) / 60);
    return {
      member,
      clockIn: summary.clockIn ? formatPacificTime(summary.clockIn) : "—",
      breaks:
        summary.breaks
          .map(
            (item) =>
              `${formatPacificTime(item.start)} – ${item.end ? formatPacificTime(item.end) : "Now"}`,
          )
          .join(", ") || "—",
      clockOut: summary.clockOut ? formatPacificTime(summary.clockOut) : "—",
      hours: `${hours}:${String(minutes).padStart(2, "0")}`,
      active: summary.phase !== "out",
    };
  });

  return (
    <Card className={className}>
      <div className="px-5 py-4 border-b border-brand-ice/60">
        <h2 className="font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal">
          {label}
        </h2>
        <p className="text-xs text-brand-steel mt-0.5">
          {pacificDate(new Date())} · Exact time, no payroll rounding
        </p>
      </div>
      <Table className="hidden lg:block">
        <THead>
          <TH>Employee</TH>
          <TH>Clock In</TH>
          <TH>Break</TH>
          <TH>Clock Out</TH>
          <TH>Hours</TH>
          <TH>Status</TH>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.member.id}>
              <TD>
                <div className="flex items-center gap-3">
                  <Avatar initials={r.member.initials} size="sm" />
                  <span className="font-medium text-brand-charcoal">
                    {r.member.fullName}
                  </span>
                </div>
              </TD>
              <TD>{r.clockIn}</TD>
              <TD className="text-brand-steel">{r.breaks}</TD>
              <TD>{r.clockOut}</TD>
              <TD className="font-medium text-brand-charcoal">{r.hours}</TD>
              <TD>
                <Badge
                  tone={r.active ? "green" : "gray"}
                  label={r.active ? "Clocked In" : "Clocked Out"}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <ul className="divide-y divide-brand-ice/60 lg:hidden">
        {rows.map((row) => (
          <li key={row.member.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar initials={row.member.initials} size="sm" />
                <h3 className="font-semibold text-brand-charcoal">
                  {row.member.fullName}
                </h3>
              </div>
              <Badge
                tone={row.active ? "green" : "gray"}
                label={row.active ? "Clocked In" : "Clocked Out"}
              />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <TimeValue label="Clock In" value={row.clockIn} />
              <TimeValue label="Break" value={row.breaks} />
              <TimeValue label="Clock Out" value={row.clockOut} />
              <TimeValue label="Hours" value={row.hours} />
            </dl>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RequestRow({
  request,
  author,
  viewer,
  canMutate,
  onDecide,
}: {
  request: TimeRequest;
  author: User | undefined;
  viewer: User | null;
  canMutate: boolean;
  onDecide: (id: string, decision: "approved" | "denied") => Promise<void>;
}) {
  const blocked = reviewBlockedReason(request, viewer);
  return (
    <div className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <div className="font-semibold text-brand-charcoal">
          {author?.fullName ?? "Unknown employee"}
        </div>
        <div className="text-sm text-brand-steel">
          {request.kind === "pto" ? "PTO option" : "Change time"} ·{" "}
          {request.hours}h · {request.reason}
        </div>
      </div>
      <Badge
        tone={request.status === "approved" ? "green" : "amber"}
        label={request.status}
      />
      {request.status === "pending" &&
        (blocked ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
            {blocked}
          </span>
        ) : (
          <div className="flex gap-2">
            <Button
              disabled={!canMutate}
              variant="secondary"
              onClick={() => void onDecide(request.id, "denied")}
            >
              Deny
            </Button>
            <Button
              disabled={!canMutate}
              onClick={() => void onDecide(request.id, "approved")}
            >
              Approve
            </Button>
          </div>
        ))}
    </div>
  );
}

function TimeValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-brand-silver">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-brand-charcoal">
        {value}
      </dd>
    </div>
  );
}
