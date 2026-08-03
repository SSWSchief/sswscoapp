"use client";

import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Field";
import { useDemoState } from "@/components/system/DemoStateProvider";
import { useConfirm } from "@/components/system/ConfirmProvider";
import { useToast } from "@/components/system/ToastProvider";

// Screen 12 — Settings (Company tab shown).
export default function SettingsPage() {
  const { resetDemoData } = useDemoState();
  const confirm = useConfirm();
  const { toast } = useToast();
  const reset = async () => {
    const ok = await confirm({ title: "Reset demo data?", message: "This restores seeded jobs, alerts, acknowledgements, and employee access settings in this browser.", confirmLabel: "Reset Demo", tone: "danger" });
    if (!ok) return;
    resetDemoData();
    toast("Demo data reset", { tone: "success" });
  };
  return (
    <>
      <Topbar title="Settings" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Card className="max-w-3xl">
          <div className="flex gap-5 overflow-x-auto px-4 sm:px-6 border-b border-brand-ice/60">
            {["Company", "General", "Users & Roles"].map((tab, i) => (
              <button
                key={tab}
                className={
                  i === 0
                    ? "min-h-11 shrink-0 py-3 font-heading text-sm font-medium uppercase tracking-wide text-brand-blue border-b-2 border-brand-blue"
                    : "min-h-11 shrink-0 py-3 font-heading text-sm font-medium uppercase tracking-wide text-brand-steel hover:text-brand-charcoal"
                }
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-4 grid gap-5 sm:p-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Company Name">
                <Input name="organization" autoComplete="organization" defaultValue="Silver State Waste Solutions" />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Address">
                <Input name="address" autoComplete="street-address" defaultValue="123 Industrial Rd, Las Vegas, NV 89118" />
              </FormField>
            </div>
            <FormField label="Phone">
              <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue="(702) 555-0100" />
            </FormField>
            <FormField label="Email">
              <Input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" defaultValue="dispatch@ssware.com" />
            </FormField>
            <FormField label="Time Zone">
              <Select defaultValue="pt">
                <option value="pt">(GMT-08:00) Pacific Time (US &amp; Canada)</option>
                <option value="mt">(GMT-07:00) Mountain Time (US &amp; Canada)</option>
              </Select>
            </FormField>
            <FormField label="Date Format">
              <Select defaultValue="mdy">
                <option value="mdy">MM/DD/YYYY</option>
                <option value="dmy">DD/MM/YYYY</option>
              </Select>
            </FormField>
          </div>

          <div className="flex justify-end px-4 py-4 sm:px-6 border-t border-brand-ice/60 bg-brand-mist/40">
            <Button className="w-full sm:w-auto">Save Changes</Button>
          </div>
        </Card>
        <Card className="mt-5 max-w-3xl p-6">
          <h2 className="font-heading text-lg font-semibold uppercase tracking-wide text-brand-charcoal">Local Demo Data</h2>
          <p className="mt-1 text-sm text-brand-steel">Restore seeded jobs, notifications, acknowledgement state, and access-control settings for a fresh walkthrough.</p>
          <Button variant="danger" className="mt-4" onClick={reset}>Reset Demo Data</Button>
        </Card>
      </div>
    </>
  );
}
