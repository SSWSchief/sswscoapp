"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { customers, dumpsters, trucks } from "@/lib/mock-data";
import { getDrivers } from "@/lib/data";

// Screen 3 — Create / Edit Job. Presentational only in the skeleton.
export function CreateJobModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const drivers = getDrivers();

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
          <Button onClick={onClose}>Save Job</Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Customer" required>
          <Select defaultValue="">
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

        <FormField label="Job Address" required>
          <div className="relative">
            <Input placeholder="Enter address" className="pr-9" />
            <Icon
              name="pin"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-500"
              width={18}
              height={18}
            />
          </div>
        </FormField>

        <FormField label="Service Type" required>
          <Select defaultValue="">
            <option value="" disabled>
              Select service type
            </option>
            <option>Dumpster Drop Off</option>
            <option>Dumpster Pickup</option>
            <option>Dumpster Swap</option>
            <option>Roll-off Delivery</option>
          </Select>
        </FormField>

        <FormField label="Traffic Instructions">
          <Input placeholder="Add gate codes, notes, etc..." />
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

        <FormField label="Assign Driver" required>
          <Select defaultValue="">
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

        <FormField label="Scheduled Date" required>
          <Input type="datetime-local" />
        </FormField>

        <FormField label="Assign Truck">
          <Select defaultValue="">
            <option value="" disabled>
              Select truck
            </option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.number}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Notes">
          <Textarea placeholder="Add notes or special instructions..." />
        </FormField>

        <FormField label="Assign Dumpster">
          <Select defaultValue="">
            <option value="" disabled>
              Select dumpster
            </option>
            {dumpsters.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.size}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  );
}
