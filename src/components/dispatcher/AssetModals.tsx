"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { getDrivers } from "@/lib/data";

// Screen 13 — Add / Edit Truck.
export function AddTruckModal({
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
      title="Add Truck"
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Save Truck</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Truck Number" required>
          <Input placeholder="T-06" />
        </FormField>
        <FormField label="Type">
          <Select defaultValue="Roll-off Truck">
            <option>Roll-off Truck</option>
            <option>Front Loader</option>
            <option>Rear Loader</option>
          </Select>
        </FormField>
        <FormField label="Status">
          <Select defaultValue="In Use">
            <option>In Use</option>
            <option>In Shop</option>
            <option>Available</option>
          </Select>
        </FormField>
        <FormField label="License Plate">
          <Input placeholder="NV-88123" />
        </FormField>
        <FormField label="Driver">
          <Select defaultValue="">
            <option value="" disabled>
              Select driver
            </option>
            {drivers.map((d) => (
              <option key={d.id}>{d.fullName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Notes">
          <Textarea placeholder="Add notes..." />
        </FormField>
      </div>
    </Modal>
  );
}

// Screen 14 — Add / Edit Dumpster.
export function AddDumpsterModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Dumpster"
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Save Dumpster</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Dumpster ID" required>
          <Input placeholder="D-106" />
        </FormField>
        <FormField label="Size" required>
          <Select defaultValue="30 Yard">
            <option>10 Yard</option>
            <option>20 Yard</option>
            <option>30 Yard</option>
            <option>40 Yard</option>
          </Select>
        </FormField>
        <FormField label="Status">
          <Select defaultValue="Out">
            <option>Out</option>
            <option>In Yard</option>
            <option>In Shop</option>
          </Select>
        </FormField>
        <FormField label="Type">
          <Select defaultValue="Roll-off">
            <option>Roll-off</option>
            <option>Front Load</option>
          </Select>
        </FormField>
        <FormField label="AirTag ID (Optional)">
          <Input placeholder="AT-3F9K" />
        </FormField>
        <FormField label="Current Location">
          <Input placeholder="321 Boulder Hwy, Henderson, NV" />
        </FormField>
        <FormField label="Notes">
          <Textarea placeholder="Back gate. Call upon arrival." />
        </FormField>
      </div>
    </Modal>
  );
}
