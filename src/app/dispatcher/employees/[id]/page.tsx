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
import { FormField, Input, Select } from "@/components/ui/Field";
import {
  accessRoleLabel,
  effectivePermissions,
  permissionKeys,
  permissionLabels,
} from "@/lib/permissions";
import { isProtectedAdministrator } from "@/lib/owners";
import type { AccessRole, UserRole } from "@/lib/types";
import { useToast } from "@/components/system/ToastProvider";
import { apiErrorMessage } from "@/lib/client-api";
import { emailDeliveryEnabled } from "@/lib/email-delivery";

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
    updateEmployeeDetails,
    protectedAdministratorIds,
  } = useOperations();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [issuedPassword, setIssuedPassword] = React.useState<string | null>(
    null,
  );
  const [detailsForm, setDetailsForm] = React.useState({
    employeeId: "",
    fullName: "",
    email: "",
    phone: "",
    role: "driver" as UserRole,
  });
  const [savingDetails, setSavingDetails] = React.useState(false);
  const employee = users.find((user) => user.id === id);
  React.useEffect(() => {
    if (employee)
      setDetailsForm({
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
      });
    // Re-seeds only when navigating to a different employee, not on every
    // background refresh — otherwise a save-in-flight would clobber
    // whatever the administrator is mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);
  if (!hydrated) return <div className="flex-1 bg-surface" />;
  if (!employee) return notFound();
  const effective = effectivePermissions(employee);
  const owner = isProtectedAdministrator(employee, protectedAdministratorIds);
  const visible = permissionKeys.filter((key) => effective[key]);
  const hidden = permissionKeys.filter((key) => !effective[key]);
  const detailsEditable = canMutate && currentUser?.accessRole === "admin";
  const detailsDirty =
    detailsForm.employeeId !== employee.employeeId ||
    detailsForm.fullName !== employee.fullName ||
    detailsForm.email !== employee.email ||
    detailsForm.phone !== employee.phone ||
    detailsForm.role !== employee.role;
  const saveDetails = async () => {
    setSavingDetails(true);
    const patch: {
      employeeId?: string;
      fullName?: string;
      email?: string;
      phone?: string;
      role?: UserRole;
    } = {};
    if (detailsForm.employeeId !== employee.employeeId)
      patch.employeeId = detailsForm.employeeId;
    if (detailsForm.fullName !== employee.fullName)
      patch.fullName = detailsForm.fullName;
    if (detailsForm.email !== employee.email) patch.email = detailsForm.email;
    if (detailsForm.phone !== employee.phone) patch.phone = detailsForm.phone;
    if (detailsForm.role !== employee.role) patch.role = detailsForm.role;
    const result = await updateEmployeeDetails(employee.id, patch);
    toast(result.ok ? "Employee details updated" : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
    setSavingDetails(false);
  };

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

        <Card>
          <CardHeader
            title="Employee Details"
            action={
              <Button
                disabled={!detailsEditable || !detailsDirty || savingDetails}
                onClick={() => void saveDetails()}
              >
                {savingDetails ? "Saving…" : "Save Changes"}
              </Button>
            }
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <FormField label="Employee ID" required>
              <Input
                disabled={!detailsEditable}
                value={detailsForm.employeeId}
                onChange={(e) =>
                  setDetailsForm({ ...detailsForm, employeeId: e.target.value })
                }
              />
            </FormField>
            <FormField label="Full Name" required>
              <Input
                disabled={!detailsEditable}
                value={detailsForm.fullName}
                onChange={(e) =>
                  setDetailsForm({ ...detailsForm, fullName: e.target.value })
                }
              />
            </FormField>
            <FormField
              label="Email"
              hint={
                owner
                  ? "Protected administrator email cannot be changed."
                  : "Also updates their sign-in email if they already have an account."
              }
            >
              <Input
                type="email"
                disabled={!detailsEditable || owner}
                value={detailsForm.email}
                onChange={(e) =>
                  setDetailsForm({ ...detailsForm, email: e.target.value })
                }
              />
            </FormField>
            <FormField label="Phone">
              <Input
                type="tel"
                disabled={!detailsEditable}
                value={detailsForm.phone}
                onChange={(e) =>
                  setDetailsForm({ ...detailsForm, phone: e.target.value })
                }
              />
            </FormField>
            <FormField
              label="Operational Role"
              hint={
                owner
                  ? "Protected administrators stay Management."
                  : "Must stay compatible with the Role Preset below — driver operational role requires the Driver access preset, and vice versa."
              }
            >
              <Select
                disabled={!detailsEditable || owner}
                value={detailsForm.role}
                onChange={(e) =>
                  setDetailsForm({
                    ...detailsForm,
                    role: e.target.value as UserRole,
                  })
                }
              >
                <option value="driver">Driver</option>
                <option value="dispatcher">Dispatcher</option>
                <option value="office">Office</option>
                <option value="management">Owner / Management</option>
              </Select>
            </FormField>
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
                  {issuedPassword && (
                    <div className="rounded border border-brand-ice bg-brand-mist p-3">
                      <p className="text-xs text-brand-steel">
                        Give this to {employee.fullName}. Shown once only.
                      </p>
                      <code className="mt-1 block select-all break-all font-mono text-sm font-semibold text-brand-charcoal">
                        {issuedPassword}
                      </code>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={!canMutate || pending}
                    onClick={async () => {
                      setPending(true);
                      setIssuedPassword(null);
                      const response = await fetch(
                        `/api/admin/employees/${employee.id}/temporary-password`,
                        { method: "POST" },
                      );
                      if (response.ok) {
                        const body = (await response.json()) as {
                          data?: { temporaryPassword?: string };
                        };
                        setIssuedPassword(body.data?.temporaryPassword ?? null);
                        toast("Temporary password issued.", {
                          tone: "success",
                        });
                      } else {
                        toast(
                          await apiErrorMessage(
                            response,
                            "The password could not be issued.",
                          ),
                          { tone: "error" },
                        );
                      }
                      setPending(false);
                    }}
                  >
                    Issue Temporary Password
                  </Button>
                  {/*
                    Supabase reports resetPasswordForEmail as successful with
                    no SMTP connected — it just never delivers anything — so
                    this button used to toast "Password reset email
                    initiated" while sending nothing. Matthew is that failure:
                    an administrator clicked it, believed it, and he never
                    heard anything. The login page already treats this
                    correctly (see the "Forgot password?" link there); this
                    button gets the same treatment now.
                  */}
                  {emailDeliveryEnabled() ? (
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
                      Send Password Reset Email
                    </Button>
                  ) : (
                    <p className="rounded bg-brand-mist p-3 text-xs text-brand-steel">
                      Email is not configured, so no reset email can be sent.
                      Use Issue Temporary Password above and hand it to them
                      directly.
                    </p>
                  )}
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
