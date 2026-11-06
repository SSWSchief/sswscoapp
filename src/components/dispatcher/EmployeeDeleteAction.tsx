"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { apiErrorMessage } from "@/lib/client-api";
import type { User } from "@/lib/types";

export function EmployeeDeleteAction({
  employee,
  protectedAdministrator,
  onDeleted,
}: {
  employee: Pick<User, "id" | "fullName" | "email">;
  protectedAdministrator: boolean;
  onDeleted: () => void;
}) {
  const { currentUser, canMutate, refresh } = useOperations();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const inFlight = React.useRef(false);
  const close = React.useCallback(() => {
    if (!inFlight.current) setOpen(false);
  }, []);
  if (currentUser?.accessRole !== "admin") return null;
  const blocked = protectedAdministrator
    ? "Protected administrators cannot be permanently deleted."
    : currentUser.id === employee.id
      ? "You cannot delete your own account."
      : null;
  const confirmed = email.trim().toLowerCase() === employee.email.toLowerCase();

  const remove = async () => {
    if (inFlight.current || blocked || !canMutate || !confirmed) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/employees/${encodeURIComponent(employee.id)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmationEmail: email.trim() }),
      });
      if (!response.ok) {
        setError(await apiErrorMessage(response, "The employee could not be deleted."));
        return;
      }
      setOpen(false);
      onDeleted();
      toast(`${employee.fullName} was permanently deleted.`, { tone: "success" });
      router.replace("/dispatcher/employees");
      // A refresh failure must not misreport an already committed deletion.
      await refresh().catch(() => {
        toast("Employee deleted. Refresh the employee list to see the change.", { tone: "success" });
      });
    } catch {
      setError("Deletion could not be confirmed. Refresh the employee list before trying again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <section className="mt-4 border-t border-brand-ice pt-4">
      <h3 className="text-sm font-semibold text-brand-charcoal">Permanent deletion</h3>
      <p className="mb-3 mt-1 text-xs leading-5 text-brand-steel">
        {blocked ?? "Removes the employee profile and sign-in account. Employees with business history must be deactivated instead."}
      </p>
      <Button
        variant="secondary"
        className="w-full border-red-300 text-red-700 hover:bg-red-50"
        disabled={!canMutate || Boolean(blocked)}
        onClick={() => { setEmail(""); setError(""); setOpen(true); }}
      >
        Permanently Delete Employee
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Permanently Delete Employee"
        widthClass="max-w-lg"
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={close}>Cancel</Button>
            <Button variant="danger" disabled={!canMutate || Boolean(blocked) || !confirmed || pending} onClick={() => void remove()}>
              {pending ? "Deleting…" : "Delete Permanently"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-charcoal">
            Permanently delete <strong>{employee.fullName}</strong> ({employee.email})?
            Their profile and sign-in account will be removed. This cannot be undone.
          </p>
          <p className="text-sm text-brand-steel">
            Deletion is blocked if the employee has job, time, or other business
            records. Use Deactivate Employee to remove access and keep their history.
            An audit record of deletion is retained.
          </p>
          <FormField label="Confirm employee email" hint={`Type ${employee.email} to confirm.`}>
            <Input type="email" autoComplete="off" disabled={pending} value={email} onChange={(event) => setEmail(event.target.value)} />
          </FormField>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        </div>
      </Modal>
    </section>
  );
}
