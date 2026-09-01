"use client";

import * as React from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useOperations } from "@/components/system/OperationsProvider";
import { daysOnSite } from "@/lib/billing/measures";
import { formatDate } from "@/lib/utils";

/**
 * Containers currently standing at a jobsite, longest out first.
 *
 * Days are shown plainly rather than flagged against the included rental
 * period. The binder's allowances are known -- 7 days on a 20 yard, 14 on a
 * 40 -- but whether every customer is on that sheet is not, so marking a
 * rental "over" here would be a guess printed in front of dispatch. The
 * threshold arrives with the rate card.
 */
export function OnSitePanel() {
  const { openPlacements, dumpsters, customers } = useOperations();
  const rows = React.useMemo(
    () =>
      openPlacements
        .map((placement) => ({
          placement,
          days: daysOnSite(placement.deliveredAt, null),
          code:
            dumpsters.find((item) => item.id === placement.dumpsterId)?.code ??
            "—",
          customer:
            customers.find((item) => item.id === placement.customerId)?.name ??
            "Unknown customer",
        }))
        .sort((left, right) => right.days - left.days),
    [openPlacements, dumpsters, customers],
  );

  return (
    <Card>
      <CardHeader
        title="On Site"
        action={
          rows.length ? (
            <span className="text-sm text-brand-steel">
              {rows.length} container{rows.length === 1 ? "" : "s"} out
            </span>
          ) : undefined
        }
      />

      {!rows.length && (
        <p className="p-6 text-center text-sm text-brand-steel">
          No containers are out. A rental opens when a delivery is completed.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <Table className="hidden md:block">
            <THead>
              <TH>Dumpster</TH>
              <TH>Customer</TH>
              <TH>Jobsite</TH>
              <TH>Delivered</TH>
              <TH>Days Out</TH>
            </THead>
            <TBody>
              {rows.map(({ placement, days, code, customer }) => (
                <TR key={placement.id}>
                  <TD className="font-semibold text-brand-charcoal">{code}</TD>
                  <TD>{customer}</TD>
                  <TD className="text-brand-steel">{placement.address}</TD>
                  <TD className="text-brand-steel">
                    {formatDate(placement.deliveredAt)}
                  </TD>
                  <TD className="font-semibold tabular-nums">{days}</TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <ul className="divide-y divide-brand-ice/60 md:hidden">
            {rows.map(({ placement, days, code, customer }) => (
              <li key={placement.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-brand-charcoal">
                      {code}
                    </h3>
                    <p className="mt-0.5 truncate text-sm text-brand-steel">
                      {customer}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-heading text-xl font-bold tabular-nums">
                      {days}
                    </div>
                    <div className="text-xs uppercase text-brand-silver">
                      days out
                    </div>
                  </div>
                </div>
                <p className="mt-2 break-words text-sm text-brand-steel">
                  {placement.address}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
