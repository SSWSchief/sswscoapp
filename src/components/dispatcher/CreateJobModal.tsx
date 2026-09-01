"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/system/ToastProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { truckStatusLabel } from "@/lib/utils";
import type { DumpsterSize, Job, ServiceType } from "@/lib/types";

// Screen 3 — Create / Edit Job. Grouped into sections with client-side
// validation and availability-aware asset pickers.
type Form = {
  /** The customer's name as typed or picked, not an id — see resolveCustomer. */
  customer: string;
  salesRep: string;
  address: string;
  serviceType: string;
  dumpsterSize: string;
  driver: string;
  truck: string;
  dumpster: string;
  scheduledFor: string;
  trafficInstructions: string;
  notes: string;
};

const empty: Form = {
  customer: "",
  salesRep: "",
  address: "",
  serviceType: "",
  dumpsterSize: "",
  driver: "",
  truck: "",
  dumpster: "",
  scheduledFor: "",
  trafficInstructions: "",
  notes: "",
};

export function CreateJobModal({
  open,
  onClose,
  job,
}: {
  open: boolean;
  onClose: () => void;
  job?: Job;
}) {
  const { toast } = useToast();
  const {
    createJob,
    updateJob,
    customers,
    dumpsters,
    trucks,
    users,
    canMutate,
  } = useOperations();
  const drivers = users.filter(
    (user) => user.accessRole === "driver" && user.status === "active",
  );
  // Anyone on staff can bring in work, so the list is not narrowed by role.
  const representatives = users.filter((user) => user.status === "active");
  const [form, setForm] = React.useState<Form>(empty);
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof Form, string>>
  >({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(
        job
          ? {
              customer:
                customers.find((item) => item.id === job.customerId)?.name ??
                "",
              salesRep: job.salesRepId ?? "",
              address: job.address,
              serviceType: job.serviceType,
              dumpsterSize: job.dumpsterSize,
              driver: job.assignedDriverId ?? "",
              truck: job.assignedTruckId ?? "",
              dumpster: job.assignedDumpsterId ?? "",
              scheduledFor: new Date(
                new Date(job.scheduledFor).getTime() -
                  new Date(job.scheduledFor).getTimezoneOffset() * 60000,
              )
                .toISOString()
                .slice(0, 16),
              trafficInstructions: job.trafficInstructions ?? "",
              notes: job.notes,
            }
          : empty,
      );
      setErrors({});
    }
  }, [customers, job, open]);

  const set =
    (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = (): boolean => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.customer.trim())
      next.customer = "Pick a customer or type a new name.";
    if (!form.address.trim()) next.address = "Enter a job address.";
    if (!form.serviceType) next.serviceType = "Choose a service type.";
    if (!form.dumpsterSize) next.dumpsterSize = "Choose a dumpster size.";
    if (!form.scheduledFor) next.scheduledFor = "Pick a date and time.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    if (saving || !canMutate) return;
    setSaving(true);
    // An exact name match reuses that customer; anything else is sent as a
    // name for the server to resolve or create, so dispatch never has to leave
    // the form to book work for someone new.
    const typed = form.customer.trim();
    const customer = customers.find(
      (item) => item.name.toLowerCase() === typed.toLowerCase(),
    );
    const input = {
      customerId: customer?.id ?? "",
      customerName: customer ? "" : typed,
      salesRepId: form.salesRep || null,
      address: form.address.trim(),
      phone: customer?.phone ?? "",
      serviceType: form.serviceType as ServiceType,
      dumpsterSize: form.dumpsterSize as DumpsterSize,
      assignedDriverId: form.driver || null,
      assignedTruckId: form.truck || null,
      assignedDumpsterId: form.dumpster || null,
      scheduledFor: form.scheduledFor,
      trafficInstructions: form.trafficInstructions.trim(),
      notes: form.notes.trim(),
    };
    if (job) {
      const result = await updateJob(job.id, input);
      if (!result.ok) {
        setSaving(false);
        toast(result.error.message, { tone: "error" });
        return;
      }
      toast(`${job.reference} updated`, { tone: "success" });
    } else {
      const result = await createJob(input);
      if (!result.ok) {
        setSaving(false);
        toast(result.error.message, { tone: "error" });
        return;
      }
      toast(
        `${result.data.reference} created${form.driver ? " and driver notified" : " in the unassigned queue"}`,
        { tone: "success" },
      );
    }
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={job ? `Edit ${job.reference}` : "Create New Job"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || !canMutate} onClick={save}>
            {saving ? "Saving…" : "Save Job"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Section title="Customer & Location">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Customer"
              required
              hideRequiredMark
              error={errors.customer}
              hint="Pick an existing customer or type a new name."
            >
              <Input
                list="known-customers"
                value={form.customer}
                onChange={set("customer")}
                placeholder="Customer name"
              />
            </FormField>
            {/* Outside the field: FormField clones its single child to carry
                the id the label points at, so wrapping the input would hang
                the label off a div instead of the control. */}
            <datalist id="known-customers">
              {customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>

            <FormField
              label="Sales Rep"
              hint="Who brought in this job. Optional."
            >
              <Select value={form.salesRep} onChange={set("salesRep")}>
                <option value="">No rep</option>
                {representatives.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Job Address"
              required
              error={errors.address}
              hint="Start typing to reuse a customer address."
            >
              <div className="relative">
                <Input
                  list="known-addresses"
                  value={form.address}
                  onChange={set("address")}
                  autoComplete="street-address"
                  placeholder="Enter address"
                  className="pr-9"
                />
                <Icon
                  name="pin"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-blue"
                  width={18}
                  height={18}
                />
                <datalist id="known-addresses">
                  {customers.map((c) => (
                    <option key={c.id} value={c.address} />
                  ))}
                </datalist>
              </div>
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Traffic Instructions">
                <Input
                  value={form.trafficInstructions}
                  onChange={set("trafficInstructions")}
                  placeholder="Add gate codes, notes, etc..."
                />
              </FormField>
            </div>
          </div>
        </Section>

        <Section title="Service">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Service Type" required error={errors.serviceType}>
              <Select value={form.serviceType} onChange={set("serviceType")}>
                <option value="" disabled>
                  Select service type
                </option>
                <option>Delivery</option>
                <option>Pick-Up</option>
                <option>Dump &amp; Return</option>
                <option>Swap / Exchange</option>
                <option>Relocation</option>
                <option>Dry Run</option>
                <option>Service Call</option>
              </Select>
            </FormField>
            <FormField
              label="Dumpster Size"
              required
              error={errors.dumpsterSize}
            >
              <Select value={form.dumpsterSize} onChange={set("dumpsterSize")}>
                <option value="" disabled>
                  Select size
                </option>
                <option>10 Yard</option>
                <option>20 Yard</option>
                <option>30 Yard</option>
                <option>40 Yard</option>
              </Select>
            </FormField>
          </div>
        </Section>

        <Section title="Schedule & Assignment">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Scheduled Date"
              required
              error={errors.scheduledFor}
            >
              <Input
                type="datetime-local"
                autoComplete="off"
                value={form.scheduledFor}
                onChange={set("scheduledFor")}
              />
            </FormField>
            <FormField
              label="Assign Driver"
              hint="Optional; unassigned jobs remain in the dispatch queue."
            >
              <Select value={form.driver} onChange={set("driver")}>
                <option value="">Unassigned</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Assign Truck"
              hint="Trucks in the shop can't be assigned."
            >
              <Select value={form.truck} onChange={set("truck")}>
                <option value="">No truck</option>
                {trucks.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    disabled={
                      t.status !== "in_use" ||
                      Boolean(t.currentJobId && t.currentJobId !== job?.id)
                    }
                  >
                    {t.number}
                    {t.status !== "in_use"
                      ? ` (${truckStatusLabel[t.status]})`
                      : t.currentJobId && t.currentJobId !== job?.id
                        ? " (Active job)"
                        : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Assign Dumpster">
              <Select value={form.dumpster} onChange={set("dumpster")}>
                <option value="">No dumpster</option>
                {dumpsters.map((d) => (
                  <option
                    key={d.id}
                    value={d.id}
                    disabled={
                      d.status === "in_shop" ||
                      Boolean(d.currentJobId && d.currentJobId !== job?.id)
                    }
                  >
                    {d.code} · {d.size}
                    {d.status === "in_shop"
                      ? " (In Shop)"
                      : d.currentJobId && d.currentJobId !== job?.id
                        ? " (Active job)"
                        : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </Section>

        <Section title="Notes">
          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Add notes or special instructions..."
            />
          </FormField>
        </Section>
      </div>
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-brand-steel mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}
