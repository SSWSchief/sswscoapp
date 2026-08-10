"use client";

import * as React from "react";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { Button } from "@/components/ui/Button";
import { CardHeader } from "@/components/ui/Card";
import { FormField, Input, Select } from "@/components/ui/Field";
import { formatCurrency } from "@/lib/utils";
import type { DumpsterSize, ServiceType } from "@/lib/types";

const serviceTypes: ServiceType[] = [
  "Delivery",
  "Pick-Up",
  "Dump & Return",
  "Swap / Exchange",
  "Relocation",
  "Dry Run",
  "Service Call",
];
const dumpsterSizes: DumpsterSize[] = [
  "10 Yard",
  "20 Yard",
  "30 Yard",
  "40 Yard",
];

/** Parses "450", "450.00" or "$450.00" into whole cents. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function PriceListPanel() {
  const { priceList, savePriceListItem, deletePriceListItem } =
    useExpandedOperations();
  const { canMutate } = useOperations();
  const { toast } = useToast();
  const [serviceType, setServiceType] = React.useState<ServiceType>("Delivery");
  const [dumpsterSize, setDumpsterSize] =
    React.useState<DumpsterSize>("20 Yard");
  const [price, setPrice] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const existing = priceList.find(
    (item) =>
      item.serviceType === serviceType && item.dumpsterSize === dumpsterSize,
  );

  const save = async () => {
    const cents = parsePriceToCents(price);
    if (cents === null) {
      toast("Enter a price such as 450 or 450.00.", { tone: "error" });
      return;
    }
    setBusy(true);
    const result = await savePriceListItem({
      serviceType,
      dumpsterSize,
      priceCents: cents,
      notes,
    });
    setBusy(false);
    if (result.ok) {
      setPrice("");
      setNotes("");
    }
    toast(result.ok ? "Rate saved." : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
  };

  const remove = async (id: string) => {
    const result = await deletePriceListItem(id);
    toast(result.ok ? "Rate removed." : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
  };

  return (
    <section>
      <CardHeader title="Dumpster Pricing" />
      <div className="space-y-5 p-4 sm:p-5">
        <p className="text-sm text-brand-steel">
          Reference rates by service and container size. New invoices start from
          the matching rate and remain editable. Changing a rate here never
          alters an invoice that has already been created.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Service">
            <Select
              value={serviceType}
              onChange={(event) =>
                setServiceType(event.target.value as ServiceType)
              }
            >
              {serviceTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Container size">
            <Select
              value={dumpsterSize}
              onChange={(event) =>
                setDumpsterSize(event.target.value as DumpsterSize)
              }
            >
              {dumpsterSizes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Price"
            hint={
              existing
                ? `Currently ${formatCurrency(existing.priceCents)}`
                : "No rate set yet"
            }
          >
            <Input
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="450.00"
            />
          </FormField>
          <FormField label="Notes">
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
            />
          </FormField>
        </div>

        <Button disabled={!canMutate || busy} onClick={() => void save()}>
          {busy ? "Saving…" : existing ? "Update Rate" : "Add Rate"}
        </Button>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-brand-ice text-left text-xs uppercase tracking-wide text-brand-steel">
                <th className="py-2 pr-3">Service</th>
                <th className="py-2 pr-3">Size</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Notes</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {priceList.map((item) => (
                <tr key={item.id} className="border-b border-brand-ice/60">
                  <td className="py-2 pr-3">{item.serviceType}</td>
                  <td className="py-2 pr-3">{item.dumpsterSize}</td>
                  <td className="py-2 pr-3 font-semibold">
                    {formatCurrency(item.priceCents)}
                  </td>
                  <td className="py-2 pr-3 text-brand-steel">{item.notes}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => void remove(item.id)}
                      className="text-xs font-semibold text-status-cancelled disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!priceList.length && (
                <tr>
                  <td colSpan={5} className="py-4 text-brand-steel">
                    No rates configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
