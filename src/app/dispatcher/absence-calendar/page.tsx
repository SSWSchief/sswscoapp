"use client";

import { Topbar } from "@/components/dispatcher/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/StatusBadge";
import { useOperations } from "@/components/system/OperationsProvider";
import { formatDate } from "@/lib/utils";

export default function AbsenceCalendarPage() {
  const { users, absenceEvents: absences, timeRequests: requests } = useOperations();
  const drivers = users.filter((user) => user.role === "driver");

  return (
    <>
      <Topbar title="Absence Calendar" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {drivers.map((driver) => (
            <Card key={driver.id} className="p-4">
              <div className="font-heading text-xl font-semibold text-brand-charcoal">
                {driver.initials}
              </div>
              <div className="text-sm font-medium text-brand-charcoal">{driver.fullName}</div>
              <div className="text-xs text-brand-steel mt-1">
                PTO {driver.ptoBalanceHours ?? 0}h · Week {driver.weeklyHours ?? 0}h
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader title="Scheduling Accommodations" />
          <div className="divide-y divide-brand-ice/50">
            {absences.map((absence) => {
              const user = users.find((item) => item.id === absence.userId);
              return (
                <div key={absence.id} className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-charcoal">{user?.fullName}</div>
                    <div className="text-sm text-brand-steel">
                      {formatDate(absence.date)} · {absence.note}
                    </div>
                  </div>
                  <Badge tone={absence.status === "approved" ? "green" : "amber"} label={`${absence.type} ${absence.status}`} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Time & PTO Requests" />
          <div className="divide-y divide-brand-ice/50">
            {requests.map((request) => {
              const user = users.find((item) => item.id === request.userId);
              return (
                <div key={request.id} className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-charcoal">{user?.fullName}</div>
                    <div className="text-sm text-brand-steel">
                      {request.kind === "pto" ? "PTO" : "Time edit"} · {request.hours}h · {request.reason}
                    </div>
                  </div>
                  <Badge tone={request.status === "approved" ? "green" : "amber"} label={request.status} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
