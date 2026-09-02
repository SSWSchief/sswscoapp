"use client";

import * as React from "react";
import Link from "next/link";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { effectivePermissions, permissionLabels } from "@/lib/permissions";
import { isProtectedAdministrator } from "@/lib/owners";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/client-api";
import { emailDeliveryEnabled } from "@/lib/email-delivery";
import type {
  AcknowledgementEntry,
  CompanySettings,
  SopDocument,
} from "@/lib/types";
import { TrainingDataPanel } from "@/components/dispatcher/TrainingDataPanel";
import { PriceListPanel } from "@/components/dispatcher/PriceListPanel";

const defaults: CompanySettings = {
  companyName: "Silver State Waste Solutions",
  address: "",
  phone: "",
  email: "",
  timeZone: "America/Los_Angeles",
  dateFormat: "MM/DD/YYYY",
  messageRetentionDays: 365,
  invoicePrefix: "INV",
  invoiceTerms: "",
};
const tabs = [
  "company",
  "defaults",
  "checklist",
  "sops",
  "users",
  "pricing",
  "training",
] as const;
type Tab = (typeof tabs)[number];
const tabLabels: Record<Tab, string> = {
  company: "Company",
  defaults: "App Defaults",
  checklist: "Driver Checklist",
  sops: "SOP Library",
  users: "Users & Roles",
  pricing: "Pricing",
  training: "Training Data",
};

/**
 * Who still owes an acknowledgement on the published SOP. Publishing a new
 * version retires the previous one, so this always reports against the version
 * currently in force.
 */
function SopCoverage({ sops }: { sops: SopDocument[] }) {
  const { loadSopCoverage } = useExpandedOperations();
  const published = sops.find((item) => item.isPublished);
  const [entries, setEntries] = React.useState<AcknowledgementEntry[] | null>(
    null,
  );

  React.useEffect(() => {
    if (!published) return;
    let active = true;
    void loadSopCoverage(published.id).then((result) => {
      if (active) setEntries(result.ok ? result.data : []);
    });
    return () => {
      active = false;
    };
  }, [published, loadSopCoverage]);

  if (!published) return null;
  const outstanding = entries?.filter((entry) => !entry.acknowledgedAt) ?? [];
  const done = (entries?.length ?? 0) - outstanding.length;

  return (
    <div className="rounded border border-brand-ice p-3 text-sm">
      <p className="font-semibold text-brand-charcoal">
        Acknowledgement of “{published.title}”
      </p>
      {!entries ? (
        <p className="mt-1 text-brand-steel">Checking…</p>
      ) : !entries.length ? (
        <p className="mt-1 text-brand-steel">No active drivers to track.</p>
      ) : (
        <>
          <p className="mt-1 text-brand-steel">
            {done} of {entries.length} drivers acknowledged.
          </p>
          {outstanding.length > 0 && (
            <p className="mt-1 text-brand-steel">
              Outstanding:{" "}
              <span className="text-brand-charcoal">
                {outstanding.map((entry) => entry.fullName).join(", ")}
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function validateSettings(settings: CompanySettings) {
  const errors: Partial<Record<keyof CompanySettings, string>> = {};
  if (settings.companyName.trim().length < 2)
    errors.companyName = "Company name is required.";
  if (
    settings.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email.trim())
  )
    errors.email = "Enter a valid email address.";
  if (
    !Number.isInteger(settings.messageRetentionDays) ||
    settings.messageRetentionDays < 30 ||
    settings.messageRetentionDays > 3650
  )
    errors.messageRetentionDays = "Use 30 to 3650 days.";
  if (!/^[A-Z0-9]{2,12}$/.test(settings.invoicePrefix.trim().toUpperCase()))
    errors.invoicePrefix = "Use 2 to 12 letters or numbers.";
  // Stripe refuses an invoice footer over 5000 characters, so terms that would
  // not fit are caught here rather than when an invoice fails to send.
  if (settings.invoiceTerms.length > 5000)
    errors.invoiceTerms = "Trim to 5000 characters or fewer.";
  return errors;
}

export default function Page() {
  const {
    loading,
    settings,
    saveSettings,
    publishSop,
    publishPretripTemplate,
    sops,
    pretripTemplates,
  } = useExpandedOperations();
  const {
    currentUser,
    canMutate,
    connectionState,
    connectionMessage,
    users,
    protectedAdministratorIds,
  } = useOperations();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<Tab>("company");

  /**
   * Open the tab named in `?tab=`, so a link can point at one section rather
   * than dropping people on Company and leaving them to find the rest. Read
   * from `window` instead of `useSearchParams` to keep this page out of a
   * Suspense boundary it otherwise does not need.
   */
  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && (tabs as readonly string[]).includes(requested)) {
      setActiveTab(requested as Tab);
    }
  }, []);

  // Keep the address bar on the visible tab so the page can be linked or
  // reloaded where it stands. Replaces rather than pushes: tabs are not
  // separate pages and should not each cost a press of the back button.
  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  };
  const [form, setForm] = React.useState(defaults);
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof CompanySettings, string>>
  >({});
  const [busy, setBusy] = React.useState<
    "settings" | "sop" | "checklist" | null
  >(null);
  const [resettingUserId, setResettingUserId] = React.useState<string | null>(
    null,
  );
  const [sop, setSop] = React.useState({
    title: "",
    category: "Procedure",
    body: "",
    required: true,
  });
  const [checklist, setChecklist] = React.useState({
    title: "Daily Truck Pre-Trip",
    items: "",
  });

  React.useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (currentUser && currentUser.accessRole !== "admin") {
    return (
      <>
        <Topbar title="Settings" />
        <div className="portal-content">
          <Card className="p-5">
            <h2 className="font-heading text-lg font-semibold uppercase">
              Administrator access required
            </h2>
            <p className="mt-2 text-sm text-brand-steel">
              Settings are restricted to active administrator accounts.
            </p>
          </Card>
        </div>
      </>
    );
  }

  const save = async () => {
    const nextErrors = validateSettings(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast("Resolve the highlighted settings before saving.", {
        tone: "error",
      });
      return;
    }
    setBusy("settings");
    const result = await saveSettings({
      ...form,
      invoicePrefix: form.invoicePrefix.trim().toUpperCase(),
      email: form.email.trim().toLowerCase(),
    });
    setBusy(null);
    toast(result.ok ? "Settings saved." : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
  };

  const submitSop = async () => {
    if (sop.title.trim().length < 2 || sop.body.trim().length < 10) {
      toast("SOP title and meaningful content are required.", {
        tone: "error",
      });
      return;
    }
    setBusy("sop");
    const result = await publishSop({
      title: sop.title,
      category: sop.category,
      body: sop.body,
      requiredForDrivers: sop.required,
    });
    setBusy(null);
    toast(result.ok ? "SOP published." : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
    if (result.ok)
      setSop({ title: "", category: "Procedure", body: "", required: true });
  };

  const submitChecklist = async () => {
    const items = checklist.items
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (checklist.title.trim().length < 2 || !items.length) {
      toast("Checklist title and at least one item are required.", {
        tone: "error",
      });
      return;
    }
    setBusy("checklist");
    const result = await publishPretripTemplate({
      title: checklist.title,
      items,
    });
    setBusy(null);
    toast(result.ok ? "Checklist published." : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
    if (result.ok) setChecklist((current) => ({ ...current, items: "" }));
  };

  const sendPasswordReset = async (userId: string, name: string) => {
    setResettingUserId(userId);
    const response = await fetch(`/api/admin/employees/${userId}/invite`, {
      method: "POST",
    });
    setResettingUserId(null);
    toast(
      response.ok
        ? `Password reset sent to ${name}.`
        : await apiErrorMessage(response, "Password reset could not be sent."),
      { tone: response.ok ? "success" : "error" },
    );
  };

  const administrators = users.filter(
    (user) => user.accessRole === "admin" && user.status === "active",
  );
  const newestSopVersion = Math.max(0, ...sops.map((item) => item.version));
  const newestChecklist = pretripTemplates[0];
  const disabled = !canMutate || Boolean(busy);

  return (
    <>
      <Topbar title="Settings" />
      <div className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-10">
        <Card className="mx-auto max-w-5xl overflow-hidden">
          <div className="relative border-b border-brand-ice/70">
            <div
              className="flex overflow-x-auto px-4 sm:px-5"
              role="tablist"
              aria-label="Settings sections"
            >
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => selectTab(tab)}
                  className={cn(
                    "min-h-14 shrink-0 border-b-4 px-3 font-heading text-sm font-semibold uppercase tracking-wide sm:px-5 sm:text-base",
                    activeTab === tab
                      ? "border-brand-blue text-brand-blue"
                      : "border-transparent text-brand-steel hover:text-brand-charcoal",
                  )}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>
            {/* Seven tabs overflow a phone-width strip with no other hint
                that more exist off-screen to the right. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent dark:from-gray-900 sm:hidden"
            />
          </div>

          {connectionState !== "ready" && connectionMessage && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              {connectionMessage}
            </div>
          )}
          {loading && (
            <div className="border-b border-brand-ice/70 px-5 py-3 text-sm text-brand-steel">
              Loading settings...
            </div>
          )}
          {!loading && !settings && (
            <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
              Company settings could not be loaded. Changes are disabled until
              the live record is available.
            </div>
          )}

          {activeTab === "company" && (
            <section className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField
                    label="Company Name"
                    required
                    error={errors.companyName}
                  >
                    <Input
                      value={form.companyName}
                      onChange={(event) =>
                        setForm({ ...form, companyName: event.target.value })
                      }
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Address">
                    <Input
                      value={form.address}
                      onChange={(event) =>
                        setForm({ ...form, address: event.target.value })
                      }
                    />
                  </FormField>
                </div>
                <FormField label="Phone">
                  <Input
                    inputMode="tel"
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                  />
                </FormField>
                <FormField label="Email" error={errors.email}>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                  />
                </FormField>
                <FormField label="Time Zone">
                  <Select
                    value={form.timeZone}
                    onChange={(event) =>
                      setForm({ ...form, timeZone: event.target.value })
                    }
                  >
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </Select>
                </FormField>
                <FormField label="Date Format">
                  <Select
                    value={form.dateFormat}
                    onChange={(event) =>
                      setForm({ ...form, dateFormat: event.target.value })
                    }
                  >
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                  </Select>
                </FormField>
              </div>
              <div className="sticky bottom-0 -mx-5 mt-6 border-t border-brand-ice/70 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:-mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pt-5">
                <Button
                  className="w-full sm:w-auto"
                  disabled={disabled || !settings}
                  onClick={() => void save()}
                >
                  {busy === "settings" ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </section>
          )}

          {activeTab === "defaults" && (
            <section className="p-5">
              <div className="space-y-4">
                <CardHeader
                  title="Simple app defaults"
                  className="-mx-5 -mt-5"
                />
                <p className="text-sm text-brand-steel">
                  These values control how long app records stay visible and how
                  invoice numbers start. Security keys and secrets stay outside
                  the app.
                </p>
                <FormField
                  label="Keep messages for"
                  required
                  error={errors.messageRetentionDays}
                  hint="30 to 3650 days"
                >
                  <Input
                    type="number"
                    min="30"
                    max="3650"
                    value={form.messageRetentionDays}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        messageRetentionDays: Number(event.target.value),
                      })
                    }
                  />
                </FormField>
                <FormField
                  label="Invoice numbers start with"
                  required
                  error={errors.invoicePrefix}
                  hint="Example: INV, SSWS, or ROLL"
                >
                  <Input
                    value={form.invoicePrefix}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        invoicePrefix: event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, ""),
                      })
                    }
                  />
                </FormField>
                <FormField
                  label="Invoice Terms"
                  error={errors.invoiceTerms}
                  hint={`Printed on every invoice — rental terms and prohibited materials. ${form.invoiceTerms.length}/5000 characters.`}
                >
                  <Textarea
                    rows={10}
                    value={form.invoiceTerms}
                    placeholder="Terms of the rental, prohibited materials, and anything else that must travel with the bill."
                    onChange={(event) =>
                      setForm({ ...form, invoiceTerms: event.target.value })
                    }
                  />
                </FormField>
                <Button
                  disabled={disabled || !settings}
                  onClick={() => void save()}
                >
                  {busy === "settings" ? "Saving..." : "Save App Defaults"}
                </Button>
              </div>
            </section>
          )}

          {activeTab === "checklist" && (
            <section className="p-5">
              <div className="space-y-4">
                <CardHeader
                  title="Driver pre-trip checklist"
                  className="-mx-5 -mt-5"
                />
                <div className="rounded border border-brand-ice p-3 text-sm text-brand-steel">
                  Published checklist:{" "}
                  <span className="font-semibold text-brand-charcoal">
                    {newestChecklist
                      ? `${newestChecklist.title} v${newestChecklist.version}`
                      : "None"}
                  </span>
                </div>
                <p className="text-sm text-brand-steel">
                  Publish a new version when the approved inspection form
                  changes. Failed items alert dispatch but do not automatically
                  block truck assignment.
                </p>
                <FormField label="Checklist name">
                  <Input
                    value={checklist.title}
                    onChange={(event) =>
                      setChecklist({ ...checklist, title: event.target.value })
                    }
                  />
                </FormField>
                <FormField label="Inspection Items" hint="One item per line">
                  <Textarea
                    rows={8}
                    value={checklist.items}
                    onChange={(event) =>
                      setChecklist({ ...checklist, items: event.target.value })
                    }
                  />
                </FormField>
                <Button
                  disabled={disabled}
                  onClick={() => void submitChecklist()}
                >
                  {busy === "checklist"
                    ? "Publishing..."
                    : "Publish New Checklist"}
                </Button>
              </div>
            </section>
          )}

          {activeTab === "sops" && (
            <section className="p-5">
              <div className="space-y-4">
                <CardHeader title="SOP Library" className="-mx-5 -mt-5" />
                <div className="rounded border border-brand-ice p-3 text-sm text-brand-steel">
                  Latest SOP version:{" "}
                  <span className="font-semibold text-brand-charcoal">
                    {newestSopVersion || "None"}
                  </span>
                </div>
                <p className="text-sm text-brand-steel">
                  Publish a new SOP when instructions change. Required SOPs ask
                  drivers to acknowledge the updated version.
                </p>
                <FormField label="SOP name">
                  <Input
                    value={sop.title}
                    onChange={(event) =>
                      setSop({ ...sop, title: event.target.value })
                    }
                  />
                </FormField>
                <FormField label="Category">
                  <Input
                    value={sop.category}
                    onChange={(event) =>
                      setSop({ ...sop, category: event.target.value })
                    }
                  />
                </FormField>
                <FormField label="Instructions">
                  <Textarea
                    rows={8}
                    value={sop.body}
                    onChange={(event) =>
                      setSop({ ...sop, body: event.target.value })
                    }
                  />
                </FormField>
                <label className="flex min-h-11 items-center gap-2 text-sm text-brand-charcoal">
                  <input
                    type="checkbox"
                    checked={sop.required}
                    onChange={(event) =>
                      setSop({ ...sop, required: event.target.checked })
                    }
                  />
                  Require drivers to acknowledge this SOP
                </label>
                <Button disabled={disabled} onClick={() => void submitSop()}>
                  {busy === "sop" ? "Publishing..." : "Publish New SOP"}
                </Button>
                <SopCoverage sops={sops} />
              </div>
            </section>
          )}

          {activeTab === "users" && (
            <section className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-semibold uppercase">
                    Users & Roles
                  </h2>
                  <p className="mt-1 text-sm text-brand-steel">
                    Role and permission changes live in employee management so
                    administrator safeguards stay centralized.
                  </p>
                </div>
                <Link
                  href="/dispatcher/employees"
                  className="inline-flex min-h-11 items-center justify-center rounded border border-brand-blue px-4 font-heading text-sm font-semibold uppercase text-brand-blue"
                >
                  Manage Employees
                </Link>
              </div>
              <div className="mt-5 overflow-hidden rounded border border-brand-ice">
                {administrators.map((admin) => (
                  <div
                    key={admin.id}
                    className="border-b border-brand-ice p-4 last:border-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-brand-charcoal">
                          {admin.fullName}
                        </div>
                        <div className="text-sm text-brand-steel">
                          {admin.email}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-brand-mist px-2 py-1 text-xs font-semibold uppercase text-brand-steel">
                          {isProtectedAdministrator(
                            admin,
                            protectedAdministratorIds,
                          )
                            ? "Protected Admin"
                            : "Admin"}
                        </span>
                        {/*
                          Reports success with no SMTP connected without
                          sending anything — see the matching note on the
                          employee page. Hidden rather than captioned for the
                          same reason the Add Employee delivery choice is
                          hidden: a working path needs no decision from them.
                        */}
                        {emailDeliveryEnabled() ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={resettingUserId === admin.id || !canMutate}
                            onClick={() =>
                              void sendPasswordReset(admin.id, admin.fullName)
                            }
                          >
                            {resettingUserId === admin.id
                              ? "Sending..."
                              : "Send Reset"}
                          </Button>
                        ) : (
                          <Link
                            href={`/dispatcher/employees/${admin.id}`}
                            className="text-xs font-semibold text-brand-blue hover:underline"
                          >
                            Issue temporary password →
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(effectivePermissions(admin))
                        .filter(([, enabled]) => enabled)
                        .slice(0, 6)
                        .map(([key]) => (
                          <span
                            key={key}
                            className="rounded bg-white px-2 py-1 text-xs text-brand-steel ring-1 ring-brand-ice"
                          >
                            {
                              permissionLabels[
                                key as keyof typeof permissionLabels
                              ]
                            }
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
                {!administrators.length && (
                  <div className="p-4 text-sm text-brand-steel">
                    No active administrators were visible to this session.
                  </div>
                )}
              </div>
            </section>
          )}
          {activeTab === "pricing" && <PriceListPanel />}
          {activeTab === "training" && <TrainingDataPanel />}
        </Card>
      </div>
    </>
  );
}
