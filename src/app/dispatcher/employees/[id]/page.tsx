"use client";

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/dispatcher/Topbar";
import { useOperations } from "@/components/system/OperationsProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Field";
import {
  accessRoleLabel,
  effectivePermissions,
  permissionKeys,
  permissionLabels,
} from "@/lib/permissions";
import { isProtectedAdministrator } from "@/lib/owners";
import type { AccessRole } from "@/lib/types";
import { useToast } from "@/components/system/ToastProvider";
import { apiErrorMessage } from "@/lib/client-api";

export default function EmployeeAccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const {
    users,
    hydrated,
    canMutate,
    currentUser,
    refresh,
    setUserAccessRole,
    setPermissionOverride,
    resetPermissionOverrides,
    protectedAdministratorIds,
  } = useOperations();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const employee = users.find((user) => user.id === id);
  if (!hydrated) return <div className="flex-1 bg-surface" />;
  if (!employee) return notFound();
  const effective = effectivePermissions(employee);
  const owner = isProtectedAdministrator(employee, protectedAdministratorIds);
  const visible = permissionKeys.filter((key) => effective[key]);
  const hidden = permissionKeys.filter((key) => !effective[key]);

  return (
    <>
      <Topbar title="Employee Access Control" />
      <div className="portal-content space-y-5">
        <Link
          href="/dispatcher/employees"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-brand-steel hover:text-brand-charcoal"
        >
          <Icon
            name="chevron-right"
            width={16}
            height={16}
            className="rotate-180"
          />
          Back to Employees
        </Link>
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar initials={employee.initials} size="lg" />
            <div className="flex-1">
              <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">
                {employee.fullName}
              </h2>
              <p className="text-sm text-brand-steel">
                {employee.employeeId} · {employee.email}
              </p>
              {owner && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-blue">
                  Protected administrator · full administrator access
                </p>
              )}
            </div>
            <div className="w-full sm:w-52">
              <label className="mb-1 block font-heading text-xs font-semibold uppercase tracking-wide text-brand-steel">
                Role Preset
              </label>
              <Select
                disabled={
                  owner || !canMutate || currentUser?.accessRole !== "admin"
                }
                value={employee.accessRole}
                onChange={async (event) => {
                  const result = await setUserAccessRole(
                    employee.id,
                    event.target.value as AccessRole,
                  );
                  toast(
                    result.ok ? "Access role updated" : result.error.message,
                    { tone: result.ok ? "success" : "error" },
                  );
                }}
              >
                {(["admin", "dispatcher", "driver"] as AccessRole[]).map(
                  (role) => (
                    <option key={role} value={role}>
                      {accessRoleLabel[role]}
                    </option>
                  ),
                )}
              </Select>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader
              title="Module Permissions"
              action={
                <Button
                  disabled={
                    owner || !canMutate || currentUser?.accessRole !== "admin"
                  }
                  variant="secondary"
                  onClick={async () => {
                    const result = await resetPermissionOverrides(employee.id);
                    toast(
                      result.ok ? "Overrides reset" : result.error.message,
                      { tone: result.ok ? "success" : "error" },
                    );
                  }}
                >
                  Reset to{" "}
                  {owner
                    ? "Protected Admin"
                    : accessRoleLabel[employee.accessRole]}
                </Button>
              }
            />
            <div className="divide-y divide-brand-ice/60">
              {permissionKeys.map((permission) => {
                const overridden = permission in employee.permissionOverrides;
                return (
                  <div
                    key={permission}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-brand-charcoal">
                        {permissionLabels[permission]}
                      </div>
                      <div className="text-xs text-brand-steel">
                        {overridden
                          ? "Individual override"
                          : `${accessRoleLabel[employee.accessRole]} preset`}
                      </div>
                    </div>
                    <button
                      disabled={
                        owner ||
                        !canMutate ||
                        currentUser?.accessRole !== "admin"
                      }
                      role="switch"
                      aria-checked={effective[permission]}
                      onClick={async () => {
                        const result = await setPermissionOverride(
                          employee.id,
                          permission,
                          !effective[permission],
                        );
                        toast(
                          result.ok
                            ? "Permission updated"
                            : result.error.message,
                          { tone: result.ok ? "success" : "error" },
                        );
                      }}
                      className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${effective[permission] ? "bg-brand-blue" : "bg-brand-silver"}`}
                      aria-label={`Toggle ${permissionLabels[permission]}`}
                    >
                      <span
                        className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${effective[permission] ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="self-start">
            <CardHeader title="Effective Access Preview" />
            <div className="p-5 space-y-5">
              <AccessList
                title={`Visible (${visible.length})`}
                items={visible.map((key) => permissionLabels[key])}
                enabled
              />
              <AccessList
                title={`Hidden (${hidden.length})`}
                items={hidden.map((key) => permissionLabels[key])}
              />
              <p className="text-xs leading-5 text-brand-steel">
                Role defaults come from the{" "}
                {accessRoleLabel[employee.accessRole]} preset. Individual
                overrides take priority and are enforced by the live
                authorization policy.
              </p>
              {currentUser?.accessRole === "admin" && (
                <div className="space-y-2 border-t border-brand-ice pt-4">
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={!canMutate || pending}
                    onClick={async () => {
                      setPending(true);
                      const response = await fetch(
                        `/api/admin/employees/${employee.id}/invite`,
                        { method: "POST" },
                      );
                      setPending(false);
                      toast(
                        response.ok
                          ? "Password reset email initiated"
                          : await apiErrorMessage(
                              response,
                              "Reset could not be initiated",
                            ),
                        { tone: response.ok ? "success" : "error" },
                      );
                    }}
                  >
                    Send Password Reset
                  </Button>
                  {owner ? (
                    <p className="rounded bg-brand-mist p-3 text-xs text-brand-steel">
                      Protected administrators cannot be deactivated or
                      downgraded from the app.
                    </p>
                  ) : (
                    <Button
                      className="w-full"
                      variant={
                        employee.status === "active" ? "danger" : "secondary"
                      }
                      disabled={!canMutate || pending}
                      onClick={async () => {
                        setPending(true);
                        const status =
                          employee.status === "active" ? "inactive" : "active";
                        const response = await fetch(
                          `/api/admin/employees/${employee.id}`,
                          {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ status }),
                          },
                        );
                        if (response.ok) await refresh();
                        setPending(false);
                        toast(
                          response.ok
                            ? `Employee ${status}`
                            : await apiErrorMessage(
                                response,
                                "Employee status could not be updated",
                              ),
                          { tone: response.ok ? "success" : "error" },
                        );
                      }}
                    >
                      {employee.status === "active"
                        ? "Deactivate Employee"
                        : "Activate Employee"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function AccessList({
  title,
  items,
  enabled,
}: {
  title: string;
  items: string[];
  enabled?: boolean;
}) {
  return (
    <section>
      <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-brand-steel">
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 text-sm text-brand-charcoal"
          >
            <Icon
              name={enabled ? "check" : "close"}
              width={14}
              height={14}
              className={enabled ? "text-emerald-600" : "text-brand-silver"}
            />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
