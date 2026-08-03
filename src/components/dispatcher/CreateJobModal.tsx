"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/system/ToastProvider";
import { useDemoState } from "@/components/system/DemoStateProvider";
import { getCustomers, getDumpsters, getDrivers, getTrucks } from "@/lib/data";
import { truckStatusLabel } from "@/lib/utils";
import type { DumpsterSize, ServiceType } from "@/lib/types";

// Screen 3 — Create / Edit Job. Grouped into sections with client-side
// validation and availability-aware asset pickers.
type Form = {
  customer: string;
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
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { createJob } = useDemoState();
  const customers = getCustomers();
  const dumpsters = getDumpsters();
  const trucks = getTrucks();
  const drivers = getDrivers();
  const [form, setForm] = React.useState<Form>(empty);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Form, string>>>({});

  React.useEffect(() => {
    if (open) {
      setForm(empty);
      setErrors({});
    }
  }, [open]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = (): boolean => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.customer) next.customer = "Select or create a customer.";
    if (!form.address.trim()) next.address = "Enter a job address.";
    if (!form.serviceType) next.serviceType = "Choose a service type.";
    if (!form.dumpsterSize) next.dumpsterSize = "Choose a dumpster size.";
    if (!form.driver) next.driver = "Assign a driver.";
    if (!form.scheduledFor) next.scheduledFor = "Pick a date and time.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = () => {
    if (!validate()) return;
    const customer = customers.find((item) => item.id === form.customer);
    const job = createJob({
      customerId: form.customer,
      address: form.address.trim(),
      phone: customer?.phone ?? "",
      serviceType: form.serviceType as ServiceType,
      dumpsterSize: form.dumpsterSize as DumpsterSize,
      assignedDriverId: form.driver,
      assignedTruckId: form.truck || null,
      assignedDumpsterId: form.dumpster || null,
      scheduledFor: form.scheduledFor,
      trafficInstructions: form.trafficInstructions.trim(),
      notes: form.notes.trim(),
    });
    toast(`${job.reference} created and driver notified`, { tone: "success" });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Job"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save Job</Button>
        </>
      }
    >
      <div className="space-y-6">
        <Section title="Customer & Location">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Customer" required error={errors.customer}>
              <Select value={form.customer} onChange={set("customer")}>
                <option value="" disabled>
                  Select customer
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
            <FormField label="Dumpster Size" required error={errors.dumpsterSize}>
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
            <FormField label="Scheduled Date" required error={errors.scheduledFor}>
              <Input
                type="datetime-local"
                autoComplete="off"
                value={form.scheduledFor}
                onChange={set("scheduledFor")}
              />
            </FormField>
            <FormField label="Assign Driver" required error={errors.driver}>
              <Select value={form.driver} onChange={set("driver")}>
                <option value="" disabled>
                  Select driver
                </option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Assign Truck" hint="Trucks in the shop can't be assigned.">
              <Select value={form.truck} onChange={set("truck")}>
                <option value="" disabled>
                  Select truck
                </option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.status !== "in_use"}>
                    {t.number}
                    {t.status !== "in_use" ? ` (${truckStatusLabel[t.status]})` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Assign Dumpster">
              <Select value={form.dumpster} onChange={set("dumpster")}>
                <option value="" disabled>
                  Select dumpster
                </option>
                {dumpsters.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.status === "in_shop"}>
                    {d.code} · {d.size}
                    {d.status === "in_shop" ? " (In Shop)" : ""}
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
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
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
