import { Topbar } from "@/components/dispatcher/Topbar";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getDrivers } from "@/lib/data";

// Time Clock — dispatcher review of employee time entries (PRD §4 Time Clock).
export default function TimeClockPage() {
  const drivers = getDrivers();

  // Illustrative daily entries for the skeleton.
  const rows = drivers.map((d, i) => ({
    driver: d,
    clockIn: ["7:30 AM", "7:45 AM", "8:00 AM", "8:05 AM"][i % 4],
    breaks: ["10:00 – 10:15 AM", "12:00 – 12:30 PM", "—", "11:00 – 11:20 AM"][i % 4],
    clockOut: ["—", "—", "4:30 PM", "—"][i % 4],
    hours: ["4:15", "3:45", "8:30", "3:20"][i % 4],
    active: i % 4 !== 2,
  }));

  return (
    <>
      <Topbar title="Time Clock" />
      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Today&apos;s Time Entries
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">May 15, 2024</p>
          </div>
          <Table>
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
                      <span className="font-medium text-gray-900">
                        {r.driver.fullName}
                      </span>
                    </div>
                  </TD>
                  <TD>{r.clockIn}</TD>
                  <TD className="text-gray-500">{r.breaks}</TD>
                  <TD>{r.clockOut}</TD>
                  <TD className="font-medium text-gray-900">{r.hours}</TD>
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
        </Card>
      </div>
    </>
  );
}
