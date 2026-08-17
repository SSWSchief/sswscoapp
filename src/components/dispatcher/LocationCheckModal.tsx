"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { FindMyLink } from "@/components/ui/FindMyLink";
import { useToast } from "@/components/system/ToastProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { locationSourceLabel } from "@/lib/location-checks";
import type { LocationCheckSource } from "@/lib/types";

export interface CheckableAsset {
  type: "truck" | "dumpster";
  id: string;
  label: string;
  airTagId?: string | null;
}

export function LocationCheckModal({
  open,
  onClose,
  asset,
}: {
  open: boolean;
  onClose: () => void;
  asset: CheckableAsset | null;
}) {
  const { toast } = useToast();
  const { recordLocationCheck, canMutate } = useOperations();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    source: "visual" as LocationCheckSource,
    location: "",
    note: "",
  });
  React.useEffect(() => {
    if (open)
      setForm({
        // An asset carrying a tag is usually checked by reading Find My.
        source: asset?.airTagId ? "airtag" : "visual",
        location: "",
        note: "",
      });
  }, [open, asset]);

  const save = async () => {
    if (!asset) return;
    if (!form.location.trim()) {
      toast("Enter where the asset was found.", { tone: "error" });
      return;
    }
    setSaving(true);
    const r = await recordLocationCheck({
      truckId: asset.type === "truck" ? asset.id : undefined,
      dumpsterId: asset.type === "dumpster" ? asset.id : undefined,
      source: form.source,
      location: form.location,
      note: form.note,
    });
    setSaving(false);
    toast(r.ok ? "Location check recorded" : r.error.message, {
      tone: r.ok ? "success" : "error",
    });
    if (r.ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={asset ? `Record Location — ${asset.label}` : "Record Location"}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !canMutate}>
            {saving ? "Saving…" : "Record Check"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {asset?.airTagId && (
          <div className="rounded border border-brand-ice bg-brand-mist p-3">
            <p className="text-xs text-brand-steel">
              AirTag{" "}
              <span className="font-mono text-brand-blue">{asset.airTagId}</span>
              . Look the position up in Find My, then type what it shows.
            </p>
            <FindMyLink className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-blue" />
          </div>
        )}
        <FormField
          label="How was it confirmed?"
          hint="Recorded with the check so a stale AirTag reading is never mistaken for a live position."
        >
          <Select
            value={form.source}
            onChange={(e) =>
              setForm({
                ...form,
                source: e.target.value as LocationCheckSource,
              })
            }
          >
            {(
              Object.keys(locationSourceLabel) as LocationCheckSource[]
            ).map((source) => (
              <option key={source} value={source}>
                {locationSourceLabel[source]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Location" required>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="1420 Glendale Ave, Sparks NV"
          />
        </FormField>
        <FormField label="Note">
          <Textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Anything the address alone does not say."
          />
        </FormField>
      </div>
    </Modal>
  );
}
