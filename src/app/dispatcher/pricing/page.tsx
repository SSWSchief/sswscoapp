"use client";

import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { extendedRentalWeekCents, quoteValidDays, rentalDaysLabel, type CustomerKind } from "@/lib/pricing-terms";
import type { DumpsterSize, ServiceType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const sizes: DumpsterSize[] = ["10 Yard", "20 Yard", "30 Yard", "40 Yard"];
const rentalSizes: DumpsterSize[] = ["20 Yard", "40 Yard"];
const kinds: Array<{ kind: CustomerKind; label: string }> = [
  { kind: "commercial", label: "Commercial" },
  { kind: "residential", label: "Residential" },
];

// A read-only quick reference for dispatch and management, so a quote call no
// longer means opening the website. Rates come from the Settings price list.
export default function PricingTermsPage() {
  const { priceList, priceListReady } = useExpandedOperations();
  const services = Array.from(new Set(priceList.map((item) => item.serviceType))) as ServiceType[];
  const rate = (service: ServiceType, size: DumpsterSize) => priceList.find((item) => item.serviceType === service && item.dumpsterSize === size);
  return (
    <React.Fragment>
      <Topbar title="Pricing & Terms" />
      <div className="portal-content portal-stack">
        <Card>
          <CardHeader title="Rental length" />
          <Table>
            <THead><TR><TH>Customer</TH>{rentalSizes.map((size) => <TH key={size}>{size}</TH>)}</TR></THead>
            <TBody>
              {kinds.map(({ kind, label }) => (
                <TR key={kind}><TD className="font-medium">{label}</TD>{rentalSizes.map((size) => <TD key={size}>{rentalDaysLabel(kind, size)}</TD>)}</TR>
              ))}
            </TBody>
          </Table>
          <p className="px-4 py-3 text-sm text-brand-steel sm:px-5">
            Rates are the same for commercial and residential. Only the rental length differs.
          </p>
        </Card>

        <Card>
          <CardHeader title="Rates" />
          {!priceListReady ? (
            <p className="p-5 text-sm text-brand-steel" role="status">Loading rates…</p>
          ) : services.length === 0 ? (
            <p className="p-5 text-sm text-brand-steel">No rates are set up yet. Management can add them in Settings.</p>
          ) : (
            <Table>
              <THead><TR><TH>Service</TH>{sizes.map((size) => <TH key={size}>{size}</TH>)}</TR></THead>
              <TBody>
                {services.map((service) => (
                  <TR key={service}>
                    <TD className="font-medium">{service}</TD>
                    {sizes.map((size) => <TD key={size}>{rate(service, size) ? formatCurrency(rate(service, size)!.priceCents) : "—"}</TD>)}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Extensions and quotes" />
          <ul className="list-disc space-y-2 p-5 pl-9 text-sm text-brand-charcoal">
            <li>A rental kept past its length is billed at {formatCurrency(extendedRentalWeekCents)} a week. Management can adjust it with how close the other pickups are.</li>
            <li>A quote is good for {quoteValidDays} days.</li>
            <li>The 5% fuel and environmental recovery fee and sales tax are added per invoice, only when they apply.</li>
          </ul>
        </Card>
      </div>
    </React.Fragment>
  );
}
