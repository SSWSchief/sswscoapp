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
          <div className="flex gap-6 px-6 border-b border-gray-100">
            {["Company", "General", "Users & Roles"].map((tab, i) => (
              <button
                key={tab}
                className={
                  i === 0
                    ? "py-4 text-sm font-medium text-brand-500 border-b-2 border-brand-500"
                    : "py-4 text-sm font-medium text-gray-500 hover:text-gray-800"
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

          <div className="flex justify-end px-6 py-4 border-t border-gray-100">
            <Button>Save Changes</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
