"use client";
import * as React from "react";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { PretripResult, PretripTemplateItem } from "@/lib/types";

const answers: Array<{ value: PretripResult; label: string; tone: string }> = [
  { value: "pass", label: "Pass", tone: "text-emerald-800" },
  { value: "fail", label: "Fail", tone: "text-red-700" },
  { value: "na", label: "N/A", tone: "text-brand-steel" },
];

/**
 * Groups items under their section heading, preserving template order and
 * keeping older flat templates (no `section`) working as a single group.
 */
function groupSections(items: PretripTemplateItem[]) {
  const order: string[] = [];
  const bySection = new Map<string, PretripTemplateItem[]>();
  for (const item of items) {
    const key = item.section ?? "";
    if (!bySection.has(key)) {
      bySection.set(key, []);
      order.push(key);
    }
    bySection.get(key)!.push(item);
  }
  return order.map((key) => ({ section: key, items: bySection.get(key)! }));
}
export default function Page() {
  const { pretripTemplates, pretripSubmissions, submitPretrip } =
    useExpandedOperations();
  const { trucks, currentUser, canMutate } = useOperations();
  const { toast } = useToast();
  const template = pretripTemplates.find((t) => t.isPublished);
  const [truckId, setTruckId] = React.useState("");
  const [mileage, setMileage] = React.useState("");
  const [signature, setSignature] = React.useState("");
  const [results, setResults] = React.useState<Record<string, PretripResult>>({});
  const [defectsFound, setDefectsFound] = React.useState("");
  const [repairsRequired, setRepairsRequired] = React.useState("");
  const [routeNote, setRouteNote] = React.useState("");
  const [safeOverride, setSafeOverride] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  const checkedCount = template
    ? template.items.filter((item) => results[item.id]).length
    : 0;
  // Any outright fail makes NO the starting answer, which is how the paper
  // form is used — a driver can still override to YES, but only with a defect
  // note explaining it, so the override leaves a record behind.
  const anyFailed = Object.values(results).includes("fail");
  const safeToOperate = safeOverride ?? !anyFailed;
  const overriddenUnsafe = anyFailed && safeToOperate;

  const save = async () => {
    if (
      !template ||
      !truckId ||
      !signature.trim() ||
      !Number.isInteger(Number(mileage)) ||
      template.items.some((i) => !results[i.id])
    ) {
      toast("Answer every inspection item, and complete truck, mileage, and signature.", {
        tone: "error",
      });
      return;
    }
    if ((anyFailed || !safeToOperate) && !defectsFound.trim()) {
      toast("Describe the defect before submitting a failed inspection.", {
        tone: "error",
      });
      return;
    }
    setBusy(true);
    const r = await submitPretrip({
      templateId: template.id,
      truckId,
      mileage: Number(mileage),
      signature,
      results,
      safeToOperate,
      defectsFound,
      repairsRequired,
      routeNote,
      vinSnapshot: trucks.find((truck) => truck.id === truckId)?.vin ?? "",
    });
    setBusy(false);
    toast(
      r.ok
        ? Object.values(results).includes("fail")
          ? "Inspection submitted; dispatch was alerted"
          : "Inspection submitted"
        : r.error.message,
      { tone: r.ok ? "success" : "error" },
    );
    if (r.ok) {
      setResults({});
      setSignature("");
      setMileage("");
      setDefectsFound("");
      setRepairsRequired("");
      setRouteNote("");
      setSafeOverride(null);
    }
  };
  return (
    <>
      <MobileHeader title="Electronic Pre-Trip" />
      <div className="flex-1 overflow-y-auto bg-surface p-4 space-y-4">
        {template ? (
          <Card>
            <CardHeader
              className="sticky top-0 z-10 bg-white dark:bg-gray-900"
              title={`${template.title} · v${template.version}`}
              action={
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    checkedCount === template.items.length
                      ? "bg-status-complete/15 text-status-complete"
                      : "bg-brand-mist text-brand-steel"
                  }`}
                >
                  {checkedCount}/{template.items.length} checked
                </span>
              }
            />
            <div className="space-y-4 p-4">
              <FormField label="Truck" required>
                <Select
                  value={truckId}
                  onChange={(e) => setTruckId(e.target.value)}
                >
                  <option value="">Select truck</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.number}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Current Mileage" required>
                <Input
                  type="number"
                  min="0"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                />
              </FormField>
              <FormField
                label="Route / Jobsite"
                hint="Where this truck is headed today. Optional."
              >
                <Input
                  value={routeNote}
                  onChange={(e) => setRouteNote(e.target.value)}
                  maxLength={200}
                  placeholder="Henderson, then yard"
                />
              </FormField>
              {/* Grouped exactly as the paper form is, with each section
                  carrying its own progress. Fifty items in one undifferentiated
                  column is not something a driver can hold their place in. */}
              <div className="space-y-4">
                {groupSections(template.items).map(({ section, items }) => {
                  const done = items.filter((item) => results[item.id]).length;
                  return (
                    <div key={section || "checklist"} className="rounded border border-brand-ice">
                      {section && (
                        <div className="flex items-center justify-between gap-2 border-b border-brand-ice bg-brand-mist px-3 py-2">
                          <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal">
                            {section}
                          </h3>
                          <span
                            className={`shrink-0 text-xs font-semibold ${done === items.length ? "text-status-complete" : "text-brand-steel"}`}
                          >
                            {done}/{items.length}
                          </span>
                        </div>
                      )}
                      <div className="divide-y divide-brand-ice">
                        {items.map((item) => (
                          <fieldset key={item.id} className="p-3">
                            <legend className="font-medium">{item.label}</legend>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {answers.map((answer) => (
                                <label
                                  key={answer.value}
                                  className={`flex min-h-11 items-center justify-center gap-2 rounded border p-2 text-sm ${answer.tone} ${
                                    results[item.id] === answer.value
                                      ? "border-brand-blue bg-brand-mist font-semibold"
                                      : "border-brand-ice"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={item.id}
                                    checked={results[item.id] === answer.value}
                                    onChange={() =>
                                      setResults({ ...results, [item.id]: answer.value })
                                    }
                                  />
                                  {answer.label}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded border border-brand-ice p-3 space-y-3">
                {/* A real fieldset: two radios with only a neighbouring span for
                    context are not announced as one question. The legend has to
                    be the fieldset's first child to become its caption. */}
                <fieldset>
                  <legend className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal">
                    Vehicle safe to operate?
                  </legend>
                  <div className="mt-2 flex gap-2">
                    {[true, false].map((value) => (
                      <label
                        key={String(value)}
                        className={`flex min-h-11 min-w-16 items-center justify-center gap-2 rounded border px-3 text-sm ${
                          safeToOperate === value
                            ? value
                              ? "border-status-complete bg-status-complete/10 font-semibold text-status-complete"
                              : "border-red-600 bg-red-50 font-semibold text-red-700"
                            : "border-brand-ice text-brand-steel"
                        }`}
                      >
                        <input
                          type="radio"
                          name="safe-to-operate"
                          checked={safeToOperate === value}
                          onChange={() => setSafeOverride(value)}
                        />
                        {value ? "Yes" : "No"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {anyFailed && (
                  <p className="text-xs text-red-700">
                    {overriddenUnsafe
                      ? "This inspection has a failed item but is marked safe to operate. Explain why below."
                      : "A failed item set this to No. Dispatch is alerted either way."}
                  </p>
                )}
                <FormField
                  label="Defects found"
                  hint={anyFailed || !safeToOperate ? undefined : "Optional."}
                >
                  <Textarea
                    maxLength={2000}
                    value={defectsFound}
                    onChange={(e) => setDefectsFound(e.target.value)}
                  />
                </FormField>
                <FormField label="Repairs required" hint="Optional.">
                  <Textarea
                    maxLength={2000}
                    value={repairsRequired}
                    onChange={(e) => setRepairsRequired(e.target.value)}
                  />
                </FormField>
              </div>
              <FormField label="Driver Signature (typed)" required>
                <Input
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder={currentUser?.fullName}
                />
              </FormField>
              <Button
                className="w-full"
                disabled={!canMutate || busy}
                onClick={() => void save()}
              >
                {busy ? "Submitting…" : "Submit Inspection"}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-center text-brand-steel">
            No published checklist is available. Contact an administrator.
          </Card>
        )}
        <Card>
          <CardHeader title="Recent Inspections" />
          <div className="divide-y divide-brand-ice">
            {pretripSubmissions
              .filter((s) => s.driverId === currentUser?.id)
              .slice(0, 5)
              .map((s) => (
                <div className="flex justify-between p-3 text-sm" key={s.id}>
                  <span>{new Date(s.submittedAt).toLocaleString()}</span>
                  <span
                    className={
                      s.hasFailures ? "text-red-700" : "text-emerald-700"
                    }
                  >
                    {s.hasFailures ? "Review required" : "Passed"}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </>
  );
}
