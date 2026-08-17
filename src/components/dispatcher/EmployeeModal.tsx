"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { AccessRole, UserRole } from "@/lib/types";
import { apiErrorDetail } from "@/lib/client-api";
import { employeeConflictMessage } from "@/lib/employee-conflict";
import { emailDeliveryEnabled } from "@/lib/email-delivery";

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
  // Kept beside the field rather than only in a toast: a duplicate Employee ID
  // is fixed by editing that field, and a message that has already faded is no
  // help while doing it.
  const [fieldErrors, setFieldErrors] = React.useState<{
    employeeId?: string;
    email?: string;
  }>({});
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
      setFieldErrors({});
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
  const save = async () => {
    const trimmed = {
      employeeId: form.employeeId.trim(),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    };
    if (!trimmed.employeeId || !trimmed.fullName || !trimmed.email) {
      toast("Employee ID, name, and email are required.", { tone: "error" });
      return;
    }
    // Caught before the round trip where the list on screen already proves it.
    // The server stays authoritative — it also sees inactive and removed
    // employees, which never reach this list.
    const takenId = users.find(
      (employee) => employee.employeeId === trimmed.employeeId,
    );
    const takenEmail = users.find(
      (employee) =>
        employee.email.toLowerCase() === trimmed.email.toLowerCase(),
    );
    if (takenId || takenEmail) {
      // Worded by the same helper the routes use, so the sentence does not
      // change depending on which side noticed.
      setFieldErrors({
        employeeId: takenId
          ? employeeConflictMessage("employee_id", trimmed.employeeId, {
              fullName: takenId.fullName,
              removed: false,
              inactive: takenId.status === "inactive",
            })
          : undefined,
        email: takenEmail
          ? employeeConflictMessage("email", trimmed.email, {
              fullName: takenEmail.fullName,
              removed: false,
              inactive: takenEmail.status === "inactive",
            })
          : undefined,
      });
      toast("That employee could not be created — see the highlighted field.", {
        tone: "error",
      });
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const response = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, ...trimmed }),
      });
      if (!response.ok) {
        const failure = await apiErrorDetail(
          response,
          "The employee could not be created.",
        );
        // A conflict is the administrator's to resolve, so it is pinned to the
        // field it belongs to and shown without the support reference. Anything
        // else keeps the reference: it is the only handle on a server fault.
        const field =
          failure.code === "employee_id_taken"
            ? "employeeId"
            : failure.code === "email_taken" || failure.code === "account_exists"
              ? "email"
              : null;
        if (field) {
          setFieldErrors(
            field === "employeeId"
              ? { employeeId: failure.message }
              : { email: failure.message },
          );
          toast(failure.message, { tone: "error" });
          return;
        }
        throw new Error(
          `${failure.message}${failure.requestId ? ` (Reference ${failure.requestId})` : ""}`,
        );
      }
      const body = (await response.json()) as {
        data?: { temporaryPassword?: string };
      };
      await refresh();
      if (body.data?.temporaryPassword) {
        // Held on screen rather than closing: this is the only time the
        // password is ever shown.
        setIssued({
          name: trimmed.fullName,
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
        <FormField
          label="Employee ID"
          required
          hint="Their own unique label — a number, initials, or a title nobody else has."
          error={fieldErrors.employeeId}
        >
          <Input
            value={form.employeeId}
            onChange={(e) => {
              setFieldErrors({ ...fieldErrors, employeeId: undefined });
              setForm({ ...form, employeeId: e.target.value });
            }}
          />
        </FormField>
        <FormField label="Full Name" required>
          <Input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </FormField>
        <FormField label="Email" required error={fieldErrors.email}>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => {
              setFieldErrors({ ...fieldErrors, email: undefined });
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
        <FormField label="Operational Role">
          <Select
            value={form.role}
            onChange={(e) => {
              const role = e.target.value as UserRole;
              setForm({
                ...form,
                role,
                accessRole:
                  role === "driver"
                    ? "driver"
                    : role === "management"
                      ? "admin"
                      : "dispatcher",
              });
            }}
          >
            <option value="driver">Driver</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="office">Office</option>
            <option value="management">Management</option>
          </Select>
        </FormField>
        <FormField label="Access Role">
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
