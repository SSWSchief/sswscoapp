"use client";

import * as React from "react";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { PretripResult } from "@/lib/types";

const answers: Array<{ value: PretripResult; label: string }> = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "N/A" },
];

export default function PostTripPage() {
  const { pretripTemplates, submitVehicleInspection, uploadInspectionPhotos } = useExpandedOperations();
  const { trucks, canMutate } = useOperations();
  const { toast } = useToast();
  const template = pretripTemplates.find((item) => item.isPublished);
  const [truckId, setTruckId] = React.useState("");
  const [mileage, setMileage] = React.useState("");
  const [signature, setSignature] = React.useState("");
  const [results, setResults] = React.useState<Record<string, PretripResult>>({});
  const [defectsFound, setDefectsFound] = React.useState("");
  const [repairsRequired, setRepairsRequired] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    if (!template || !truckId || !signature.trim() || !Number.isInteger(Number(mileage)) || !files.length || template.items.some((item) => !results[item.id])) {
      toast("Answer every item, add a truck, mileage, signature, and at least one photo.", { tone: "error" });
      return;
    }
    setBusy(true);
    const submitted = await submitVehicleInspection({
      inspectionType: "post_trip",
      templateId: template.id,
      truckId,
      mileage: Number(mileage),
      signature,
      results,
      safeToOperate: !Object.values(results).includes("fail"),
      defectsFound,
      repairsRequired,
    });
    if (!submitted.ok) {
      setBusy(false);
      toast(submitted.error.message, { tone: "error" });
      return;
    }
    const uploaded = await uploadInspectionPhotos(submitted.data, files);
    setBusy(false);
    toast(uploaded.ok ? "Post-trip inspection submitted" : uploaded.error.message, { tone: uploaded.ok ? "success" : "error" });
    if (uploaded.ok) {
      setResults({});
      setTruckId("");
      setMileage("");
      setSignature("");
      setDefectsFound("");
      setRepairsRequired("");
      setFiles([]);
    }
  };

  return (
    <>
      <MobileHeader title="Post-Trip Inspection" />
      <div className="flex-1 overflow-y-auto bg-surface p-4">
        <Card>
          <CardHeader title={template ? `${template.title} · Post-trip` : "Post-trip inspection"} />
          {template ? <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Truck<Select value={truckId} onChange={(event) => setTruckId(event.target.value)}><option value="">Select truck</option>{trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.number}</option>)}</Select></label>
              <label className="text-sm font-medium">Final mileage<Input type="number" min="0" value={mileage} onChange={(event) => setMileage(event.target.value)} /></label>
            </div>
            <div className="space-y-2">{template.items.map((item) => <div key={item.id} className="grid gap-2 border-b border-brand-ice py-2 sm:grid-cols-[1fr_auto]"><span className="text-sm">{item.label}</span><div className="flex gap-3">{answers.map((answer) => <label key={answer.value} className="text-xs"><input type="radio" name={item.id} checked={results[item.id] === answer.value} onChange={() => setResults((current) => ({ ...current, [item.id]: answer.value }))} /> {answer.label}</label>)}</div></div>)}</div>
            <Textarea value={defectsFound} onChange={(event) => setDefectsFound(event.target.value)} placeholder="Defects found" aria-label="Defects found" />
            <Textarea value={repairsRequired} onChange={(event) => setRepairsRequired(event.target.value)} placeholder="Repairs required" aria-label="Repairs required" />
            <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded border-2 border-dashed border-brand-ice px-3 text-sm text-brand-steel"><Icon name="photo" width={20} height={20} /> Add condition photos<input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>
            {files.length > 0 && <p className="text-xs text-brand-steel">{files.length} photo{files.length === 1 ? "" : "s"} selected</p>}
            <Input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="Driver signature" aria-label="Driver signature" />
            <Button disabled={!canMutate || busy} onClick={() => void save()}>{busy ? "Submitting..." : "Submit post-trip inspection"}</Button>
          </div> : <p className="p-4 text-sm text-brand-steel">No inspection template is published.</p>}
        </Card>
      </div>
    </>
  );
}
