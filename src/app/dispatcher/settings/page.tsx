import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Field";

// Screen 12 — Settings (Company tab shown).
export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <Card className="max-w-3xl">
          <div className="flex gap-6 px-6 border-b border-brand-ice/60">
            {["Company", "General", "Users & Roles"].map((tab, i) => (
              <button
                key={tab}
                className={
                  i === 0
                    ? "py-4 font-heading text-sm font-medium uppercase tracking-wide text-brand-blue border-b-2 border-brand-blue"
                    : "py-4 font-heading text-sm font-medium uppercase tracking-wide text-brand-steel hover:text-brand-charcoal"
                }
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Company Name">
                <Input defaultValue="Silver State Waste Solutions" />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Address">
                <Input defaultValue="123 Industrial Rd, Las Vegas, NV 89118" />
              </FormField>
            </div>
            <FormField label="Phone">
              <Input defaultValue="(702) 555-0100" />
            </FormField>
            <FormField label="Email">
              <Input defaultValue="dispatch@ssware.com" />
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

          <div className="flex justify-end px-6 py-4 border-t border-brand-ice/60 bg-brand-mist/40">
            <Button>Save Changes</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
