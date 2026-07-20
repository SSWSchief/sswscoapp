"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/system/ToastProvider";
import { customers, dumpsters, trucks } from "@/lib/mock-data";
import { getDrivers } from "@/lib/data";
import { truckStatusLabel } from "@/lib/utils";

// Screen 3 — Create / Edit Job. Grouped into sections with client-side
// validation and availability-aware asset pickers.
type Form = {
  customer: string;
  address: string;
  serviceType: string;
  driver: string;
  scheduledFor: string;
};

const empty: Form = {
  customer: "",
  address: "",
  serviceType: "",
  driver: "",
  scheduledFor: "",
};

export function CreateJobModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
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
    if (!form.customer) next.customer = "Select a customer.";
    if (!form.address.trim()) next.address = "Enter a job address.";
    if (!form.serviceType) next.serviceType = "Choose a service type.";
    if (!form.driver) next.driver = "Assign a driver.";
    if (!form.scheduledFor) next.scheduledFor = "Pick a date and time.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = () => {
    if (!validate()) return;
    toast("Job created", { tone: "success" });
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
                  placeholder="Enter address"
                  className="pr-9"
                />
                <Icon
                  name="pin"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-500"
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
                <Input placeholder="Add gate codes, notes, etc..." />
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
                <option>Dumpster Drop Off</option>
                <option>Dumpster Pickup</option>
                <option>Dumpster Swap</option>
                <option>Roll-off Delivery</option>
              </Select>
            </FormField>
            <FormField label="Dumpster Size">
              <Select defaultValue="">
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
              <Select defaultValue="">
                <option value="" disabled>
                  Select truck
                </option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.status === "in_shop"}>
                    {t.number}
                    {t.status === "in_shop" ? ` (${truckStatusLabel.in_shop})` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Assign Dumpster">
              <Select defaultValue="">
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
            <Textarea placeholder="Add notes or special instructions..." />
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}
