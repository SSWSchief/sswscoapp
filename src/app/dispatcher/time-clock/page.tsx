"use client";

import { Topbar } from "@/components/dispatcher/Topbar";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useOperations } from "@/components/system/OperationsProvider";
import { summarizeTime, formatPacificTime, pacificDate } from "@/lib/time-clock";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/system/ToastProvider";

// Time Clock — dispatcher review of employee time entries (PRD §4 Time Clock).
export default function TimeClockPage() {
  const { users, timeEntries, timeRequests: requests, reviewTimeRequest, canMutate } = useOperations();
  const {toast}=useToast();
  const drivers = users.filter((user) => user.accessRole === "driver");

  const rows = drivers.map(driver=>{const summary=summarizeTime(driver.id,timeEntries);const hours=Math.floor(summary.workedSeconds/3600);const minutes=Math.floor(summary.workedSeconds%3600/60);return {driver,clockIn:summary.clockIn?formatPacificTime(summary.clockIn):"—",breaks:summary.breaks.map(item=>`${formatPacificTime(item.start)} – ${item.end?formatPacificTime(item.end):"Now"}`).join(", ")||"—",clockOut:summary.clockOut?formatPacificTime(summary.clockOut):"—",hours:`${hours}:${String(minutes).padStart(2,"0")}`,active:summary.phase!=="out"};});
  const decide=async(id:string,decision:"approved"|"denied")=>{const result=await reviewTimeRequest(id,decision);toast(result.ok?`Request ${decision}`:result.error.message,{tone:result.ok?"success":"error"});};

  return (
    <>
      <Topbar title="Time Clock" />
      <div className="portal-content">
        <Card>
          <div className="px-5 py-4 border-b border-brand-ice/60">
            <h2 className="font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal">
              Today&apos;s Time Entries
            </h2>
            <p className="text-xs text-brand-steel mt-0.5">{pacificDate(new Date())} · Exact time, no payroll rounding</p>
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
                <TR key={r.driver.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar initials={r.driver.initials} size="sm" />
                      <span className="font-medium text-brand-charcoal">
                        {r.driver.fullName}
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
              <li key={row.driver.id} className="p-4">
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Avatar initials={row.driver.initials} size="sm" /><h3 className="font-semibold text-brand-charcoal">{row.driver.fullName}</h3></div><Badge tone={row.active ? "green" : "gray"} label={row.active ? "Clocked In" : "Clocked Out"} /></div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <TimeValue label="Clock In" value={row.clockIn} /><TimeValue label="Break" value={row.breaks} /><TimeValue label="Clock Out" value={row.clockOut} /><TimeValue label="Hours" value={row.hours} />
                </dl>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="mt-5">
          <div className="px-5 py-4 border-b border-brand-ice/60">
            <h2 className="font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal">
              Time Change / PTO Requests
            </h2>
          </div>
          <div className="divide-y divide-brand-ice/50">
            {requests.map((request) => {
              const driver = drivers.find((d) => d.id === request.userId);
              return (
                <div key={request.id} className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-charcoal">{driver?.fullName}</div>
                    <div className="text-sm text-brand-steel">
                      {request.kind === "pto" ? "PTO option" : "Change time"} · {request.hours}h · {request.reason}
                    </div>
                  </div>
                  <Badge tone={request.status === "approved" ? "green" : "amber"} label={request.status} />
                  {request.status==="pending"&&<div className="flex gap-2"><Button disabled={!canMutate} variant="secondary" onClick={()=>void decide(request.id,"denied")}>Deny</Button><Button disabled={!canMutate} onClick={()=>void decide(request.id,"approved")}>Approve</Button></div>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

function TimeValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase text-brand-silver">{label}</dt><dd className="mt-0.5 break-words font-medium text-brand-charcoal">{value}</dd></div>;
}
