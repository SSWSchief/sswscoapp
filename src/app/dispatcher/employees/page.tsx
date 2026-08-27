"use client";

import * as React from "react";
import Link from "next/link";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/Field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useOperations } from "@/components/system/OperationsProvider";
import { ListFooter } from "@/components/ui/ListFooter";
import { accessRoleLabel } from "@/lib/permissions";
import { isProtectedAdministrator } from "@/lib/owners";
import {
  employeeDisplayStatus,
  employeeStatusLabel,
  employeeStatusTone,
} from "@/lib/employee-status";
import { EmployeeModal } from "@/components/dispatcher/EmployeeModal";

export default function EmployeesPage() {
  const { users, currentUser, canMutate, protectedAdministratorIds, totals } =
    useOperations();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const employees = users.filter((employee) =>
    `${employee.employeeId} ${employee.fullName} ${employee.email}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <Topbar
        title="Employees"
        action={
          <Button
            disabled={!canMutate || currentUser?.accessRole !== "admin"}
            onClick={() => setOpen(true)}
            aria-label="Add employee"
          >
            <Icon name="plus" width={18} height={18} />
            <span className="hidden sm:inline">Add Employee</span>
          </Button>
        }
      />
      <div className="portal-content">
        <Card>
          <div className="p-5 border-b border-brand-ice/60">
            <div className="relative max-w-md">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-steel"
                width={18}
                height={18}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, or employee ID..."
                className="pl-10"
              />
            </div>
          </div>
          <Table className="hidden lg:block">
            <THead>
              <TH>Employee ID</TH>
              <TH>Employee</TH>
              <TH>Access Role</TH>
              <TH>Phone</TH>
              <TH>Status</TH>
              <TH className="text-right">Access</TH>
            </THead>
            <TBody>
              {employees.map((employee) => (
                <TR key={employee.id}>
                  <TD className="font-mono text-sm font-semibold text-brand-charcoal">
                    {employee.employeeId}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar
                        initials={employee.initials}
                        src={employee.avatarUrl}
                        alt={employee.fullName}
                        size="sm"
                      />
                      <div>
                        <div className="font-medium text-brand-charcoal">
                          {employee.fullName}
                        </div>
                        <div className="text-xs text-brand-steel">
                          {employee.email}
                        </div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    {isProtectedAdministrator(
                      employee,
                      protectedAdministratorIds,
                    )
                      ? "Protected Admin"
                      : accessRoleLabel[employee.accessRole]}
                  </TD>
                  <TD>{employee.phone}</TD>
                  <TD>
                    <Badge
                      tone={employeeStatusTone[employeeDisplayStatus(employee)]}
                      label={
                        employeeStatusLabel[employeeDisplayStatus(employee)]
                      }
                    />
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/dispatcher/employees/${employee.id}`}
                      className="inline-flex items-center gap-1.5 font-medium text-brand-blue hover:underline"
                    >
                      <Icon name="settings" width={17} height={17} />
                      Manage
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <ul className="divide-y divide-brand-ice/60 lg:hidden">
            {employees.map((employee) => (
              <li key={employee.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar
                    initials={employee.initials}
                    src={employee.avatarUrl}
                    alt={employee.fullName}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-brand-charcoal">
                      {employee.fullName}
                    </h2>
                    <p className="font-mono text-xs text-brand-steel">
                      {employee.employeeId}
                    </p>
                    <a
                      href={`tel:${employee.phone.replace(/[^\d+]/g, "")}`}
                      className="mt-1 flex min-h-11 items-center text-sm text-brand-blue"
                    >
                      {employee.phone}
                    </a>
                  </div>
                  <Badge
                    tone={employeeStatusTone[employeeDisplayStatus(employee)]}
                    label={employeeStatusLabel[employeeDisplayStatus(employee)]}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-brand-ice/50 pt-2">
                  <span className="text-sm text-brand-steel">
                    {isProtectedAdministrator(
                      employee,
                      protectedAdministratorIds,
                    )
                      ? "Protected Admin"
                      : accessRoleLabel[employee.accessRole]}
                  </span>
                  <Link
                    href={`/dispatcher/employees/${employee.id}`}
                    className="flex min-h-11 items-center gap-2 px-2 font-medium text-brand-blue"
                  >
                    <Icon name="settings" width={17} height={17} />
                    Manage Access
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <ListFooter
            shown={employees.length}
            loaded={users.length}
            total={totals.users}
            noun="employees"
          />
        </Card>
      </div>
      <EmployeeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
