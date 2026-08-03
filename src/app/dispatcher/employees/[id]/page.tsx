"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/dispatcher/Topbar";
import { useDemoState } from "@/components/system/DemoStateProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Field";
import { accessRoleLabel, effectivePermissions, permissionKeys, permissionLabels } from "@/lib/permissions";
import type { AccessRole } from "@/lib/types";

export default function EmployeeAccessPage({ params }: { params: { id: string } }) {
  const { users, hydrated, setUserAccessRole, setPermissionOverride, resetPermissionOverrides } = useDemoState();
  const employee = users.find((user) => user.id === params.id);
  if (!hydrated) return <div className="flex-1 bg-surface" />;
  if (!employee) return notFound();
  const effective = effectivePermissions(employee);
  const visible = permissionKeys.filter((key) => effective[key]);
  const hidden = permissionKeys.filter((key) => !effective[key]);

  return (
    <>
      <Topbar title="Employee Access Control" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        <Link href="/dispatcher/employees" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-brand-steel hover:text-brand-charcoal"><Icon name="chevron-right" width={16} height={16} className="rotate-180" />Back to Employees</Link>
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Not securely enforced:</strong> this is a local access-control demo. Supabase Auth and Row Level Security are required before these settings protect real data.
        </div>

        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar initials={employee.initials} size="lg" />
            <div className="flex-1"><h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-charcoal">{employee.fullName}</h2><p className="text-sm text-brand-steel">{employee.employeeId} · {employee.email}</p></div>
            <div className="w-full sm:w-52"><label className="mb-1 block font-heading text-xs font-semibold uppercase tracking-wide text-brand-steel">Role Preset</label><Select value={employee.accessRole} onChange={(event) => setUserAccessRole(employee.id, event.target.value as AccessRole)}>{(["admin", "dispatcher", "driver"] as AccessRole[]).map((role) => <option key={role} value={role}>{accessRoleLabel[role]}</option>)}</Select></div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader title="Module Permissions" action={<Button variant="secondary" onClick={() => resetPermissionOverrides(employee.id)}>Reset to {accessRoleLabel[employee.accessRole]}</Button>} />
            <div className="divide-y divide-brand-ice/60">
              {permissionKeys.map((permission) => {
                const overridden = permission in employee.permissionOverrides;
                return (
                  <div key={permission} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1"><div className="text-sm font-medium text-brand-charcoal">{permissionLabels[permission]}</div><div className="text-xs text-brand-steel">{overridden ? "Individual override" : `${accessRoleLabel[employee.accessRole]} preset`}</div></div>
                    <button role="switch" aria-checked={effective[permission]} onClick={() => setPermissionOverride(employee.id, permission, !effective[permission])} className={`relative h-7 w-12 rounded-full transition-colors ${effective[permission] ? "bg-brand-blue" : "bg-brand-silver"}`} aria-label={`Toggle ${permissionLabels[permission]}`}><span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${effective[permission] ? "translate-x-6" : "translate-x-1"}`} /></button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="self-start">
            <CardHeader title="Effective Access Preview" />
            <div className="p-5 space-y-5">
              <AccessList title={`Visible (${visible.length})`} items={visible.map((key) => permissionLabels[key])} enabled />
              <AccessList title={`Hidden (${hidden.length})`} items={hidden.map((key) => permissionLabels[key])} />
              <p className="text-xs leading-5 text-brand-steel">Role defaults come from the {accessRoleLabel[employee.accessRole]} preset. Individual overrides take priority and are saved in this browser.</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function AccessList({ title, items, enabled }: { title: string; items: string[]; enabled?: boolean }) {
  return <section><h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-brand-steel">{title}</h3><ul className="mt-2 space-y-1.5">{items.map((item) => <li key={item} className="flex items-center gap-2 text-sm text-brand-charcoal"><Icon name={enabled ? "check" : "close"} width={14} height={14} className={enabled ? "text-emerald-600" : "text-brand-silver"} />{item}</li>)}</ul></section>;
}
