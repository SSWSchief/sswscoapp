"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { AccessRole, UserRole } from "@/lib/types";
import { apiErrorMessage } from "@/lib/client-api";
import { emailDeliveryEnabled } from "@/lib/email-delivery";
import { deriveEmployeeId } from "@/lib/employee-id";
import { accessRoleLabel, defaultAccessRole } from "@/lib/permissions";

export function EmployeeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { canMutate, refresh, users } = useOperations();
  const { toast } = useToast();
  const canEmail = emailDeliveryEnabled();
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    employeeId?: string;
    email?: string;
  }>({});
  const [accessOpen, setAccessOpen] = React.useState(false);
  const [issued, setIssued] = React.useState<{
    name: string;
    password: string;
  } | null>(null);
  const [form, setForm] = React.useState({
    employeeId: "",
    fullName: "",
    email: "",
    phone: "",
    role: "driver" as UserRole,
    accessRole: "driver" as AccessRole,
    delivery: "temporary_password" as "invitation" | "temporary_password",
  });
  React.useEffect(() => {
    if (open) {
      setIssued(null);
      setErrors({});
      setAccessOpen(false);
      setForm({
        employeeId: "",
        fullName: "",
        email: "",
        phone: "",
        role: "driver",
        accessRole: "driver",
        delivery: "temporary_password",
      });
    }
  }, [open]);
  // Shown rather than silently applied: the administrator should recognise the
  // ID on a report later without having been quizzed about it now.
  const suggestedId = form.fullName.trim()
    ? deriveEmployeeId(form.fullName)
    : "";
  const save = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      toast("Name and email are required.", { tone: "error" });
      return;
    }
    // Only a typed ID is checked. A blank one is assigned by the server, which
    // is the only side that can see soft-deleted employees still holding one.
    const employeeId = form.employeeId.trim();
    const email = form.email.trim().toLowerCase();
    const idHolder = employeeId
      ? users.find((user) => user.employeeId === employeeId)
      : undefined;
    const emailHolder = users.find(
      (user) => user.email.toLowerCase() === email,
    );
    if (idHolder || emailHolder) {
      setErrors({
        employeeId: idHolder
          ? `Employee ID "${employeeId}" already belongs to ${idHolder.fullName}. Each employee needs their own.`
          : undefined,
        email: emailHolder
          ? `${emailHolder.fullName} already uses this email address.`
          : undefined,
      });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const response = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          employeeId: employeeId || undefined,
        }),
      });
      if (!response.ok)
        throw new Error(
          await apiErrorMessage(response, "The employee could not be created."),
        );
      const body = (await response.json()) as {
        data?: { temporaryPassword?: string };
      };
      await refresh();
      if (body.data?.temporaryPassword) {
        // Held on screen rather than closing: this is the only time the
        // password is ever shown.
        setIssued({
          name: form.fullName,
          password: body.data.temporaryPassword,
        });
        toast("Employee created.", { tone: "success" });
        return;
      }
      toast("Employee created and invitation sent.", { tone: "success" });
      onClose();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "The employee could not be created.",
        { tone: "error" },
      );
    } finally {
      setSaving(false);
    }
  };
  if (issued)
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Employee Created"
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-steel">
            Give this password to {issued.name}. It is shown once and cannot be
            retrieved later — if it is lost, issue a new one from their employee
            page.
          </p>
          <div className="rounded border border-brand-ice bg-brand-mist p-4 text-center">
            <code className="select-all font-mono text-lg font-semibold tracking-wider text-brand-charcoal">
              {issued.password}
            </code>
          </div>
          <p className="text-sm text-brand-steel">
            They sign in with their email and this password, then set their own
            from Change Password.
          </p>
        </div>
      </Modal>
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Employee"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canMutate || saving} onClick={() => void save()}>
            {saving
              ? "Creating…"
              : form.delivery === "temporary_password"
                ? "Create Employee"
                : "Create & Invite"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* The name leads: it is the thing the administrator actually knows. */}
        <FormField label="Full Name" required>
          <Input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </FormField>
        <FormField label="Email" required error={errors.email}>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => {
              setErrors((current) => ({ ...current, email: undefined }));
              setForm({ ...form, email: e.target.value });
            }}
          />
        </FormField>
        <FormField label="Phone">
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </FormField>
        <FormField label="What do they do?">
          <Select
            value={form.role}
            onChange={(e) => {
              const role = e.target.value as UserRole;
              setForm({
                ...form,
                role,
                accessRole: defaultAccessRole(role),
              });
            }}
          >
            <option value="driver">Driver</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="office">Office</option>
            <option value="management">Owner / Management</option>
          </Select>
        </FormField>
        <p className="text-xs text-brand-steel">
          They get {accessRoleLabel[form.accessRole].toLowerCase()} access.{" "}
          <button
            type="button"
            onClick={() => setAccessOpen((open) => !open)}
            aria-expanded={accessOpen}
            className="font-semibold text-brand-blue underline"
          >
            {accessOpen ? "Use the usual access" : "Change what they can see"}
          </button>
        </p>
        {/*
          Access role is a separate question only when someone's permissions do
          not follow their job — a rare enough case that leading with it made
          every ordinary employee look like a decision to be reasoned about.
        */}
        {accessOpen ? (
          <FormField
            label="Access Role"
            hint="Sets which parts of the app they can open. Reset by changing what they do."
          >
            <Select
              value={form.accessRole}
              onChange={(e) =>
                setForm({ ...form, accessRole: e.target.value as AccessRole })
              }
            >
              <option value="driver">Driver</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="admin">Administrator</option>
            </Select>
          </FormField>
        ) : null}
        <FormField
          label="Employee ID"
          hint={
            form.employeeId.trim()
              ? undefined
              : `Assigned automatically${
                  suggestedId ? ` — ${suggestedId}` : ""
                }. Set one only if you use staff numbers.`
          }
          error={errors.employeeId}
        >
          <Input
            value={form.employeeId}
            placeholder={suggestedId}
            onChange={(e) => {
              setErrors((current) => ({ ...current, employeeId: undefined }));
              setForm({ ...form, employeeId: e.target.value });
            }}
          />
        </FormField>
        {/*
          The invitation option is hidden rather than merely captioned when
          email sending is off. Offering a choice that always fails is how an
          administrator ends up staring at an error reference instead of a new
          employee; the one mode that works needs no decision from them.
        */}
        {canEmail ? (
          <FormField label="How they get in">
            <Select
              value={form.delivery}
              onChange={(e) =>
                setForm({
                  ...form,
                  delivery: e.target.value as typeof form.delivery,
                })
              }
            >
              <option value="temporary_password">
                Give them a temporary password
              </option>
              <option value="invitation">Email them an invitation</option>
            </Select>
          </FormField>
        ) : null}
        <p className="text-xs text-brand-steel">
          {form.delivery === "temporary_password"
            ? "No email is sent. A password is shown once for you to pass on, and they change it after signing in."
            : "Sends an invitation email. This requires company email sending to be configured."}
        </p>
      </div>
    </Modal>
  );
}
