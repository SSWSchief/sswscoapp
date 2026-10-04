"use client";
import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Field";
import { netTons } from "@/lib/billing/measures";
import { createClient } from "@/lib/supabase/client";

export interface DisposalTicketDraft {
  netWeightLbs: number;
  ticketNumber: string;
  grossWeightLbs: number | null;
  tareWeightLbs: number | null;
  notes: string;
  /** What the landfill charged, in cents; null when the ticket shows none. */
  disposalFeeCents: number | null;
  disposalSiteId: string | null;
}

/** "$268.40" or "268.4" as cents; blank means not recorded. */
const toCents = (value: string): number | null | "invalid" => {
  const trimmed = value.trim().replace(/[$,\s]/g, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return "invalid";
  return Math.round(Number(trimmed) * 100);
};

const toPounds = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
};

/**
 * Records the scale ticket for a haul, in the units the ticket is printed in.
 *
 * Weights are entered in pounds because that is what the landfill hands the
 * driver; the tons figure underneath is shown only so a mistyped digit is
 * obvious before it is filed. Gross and tare are optional — most tickets show
 * a net, and asking for three numbers in a truck cab to capture one is how
 * data entry stops happening.
 *
 * The landfill's charge and the site are asked for too (Austin, 2026-09-30),
 * because they are what a job's dump cost really was. Both stay optional so
 * a missing figure never holds up the driver; management can fill it in on
 * the Profitability page.
 */
export function DisposalTicketDialog({
  open,
  onClose,
  onSubmit,
  busy = false,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: DisposalTicketDraft) => void | Promise<void>;
  busy?: boolean;
  existing?: DisposalTicketDraft;
}) {
  const [net, setNet] = React.useState("");
  const [ticket, setTicket] = React.useState("");
  const [gross, setGross] = React.useState("");
  const [tare, setTare] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [charge, setCharge] = React.useState("");
  const [siteId, setSiteId] = React.useState("");
  const [sites, setSites] = React.useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void createClient()
      .from("disposal_sites")
      .select("id,name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (!cancelled && data) setSites(data);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setError("");
    setNet(existing ? String(existing.netWeightLbs) : "");
    setTicket(existing?.ticketNumber ?? "");
    setGross(existing?.grossWeightLbs ? String(existing.grossWeightLbs) : "");
    setTare(existing?.tareWeightLbs ? String(existing.tareWeightLbs) : "");
    setNotes(existing?.notes ?? "");
    setCharge(existing?.disposalFeeCents != null ? (existing.disposalFeeCents / 100).toFixed(2) : "");
    setSiteId(existing?.disposalSiteId ?? "");
  }, [open, existing]);

  // Filling gross and tare implies the net, so compute it rather than asking
  // the driver to do subtraction on a tailgate.
  React.useEffect(() => {
    const g = toPounds(gross);
    const t = toPounds(tare);
    if (g !== null && t !== null && g >= t) setNet(String(g - t));
  }, [gross, tare]);

  const netLbs = toPounds(net);
  const tons = netLbs === null ? 0 : netTons(netLbs);

  const submit = () => {
    if (netLbs === null || netLbs <= 0) {
      setError("Enter the net weight from the ticket, in pounds.");
      return;
    }
    const g = toPounds(gross);
    const t = toPounds(tare);
    if (g !== null && t !== null && g < t) {
      setError("Gross weight cannot be less than tare weight.");
      return;
    }
    const fee = toCents(charge);
    if (fee === "invalid") {
      setError("Enter the landfill charge in dollars, like 268.40.");
      return;
    }
    void onSubmit({
      disposalFeeCents: fee,
      disposalSiteId: siteId || null,
      netWeightLbs: netLbs,
      ticketNumber: ticket.trim(),
      grossWeightLbs: g,
      tareWeightLbs: t,
      notes: notes.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={existing ? "Update Disposal Ticket" : "Disposal Ticket"}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Saving…" : existing ? "Update Ticket" : "Save Ticket"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <FormField label="Net Weight (lbs)" required error={error}>
          <Input
            autoFocus
            type="text"
            inputMode="numeric"
            placeholder="e.g. 9340"
            value={net}
            onChange={(event) => {
              setError("");
              setNet(event.target.value);
            }}
          />
        </FormField>
        {tons > 0 && (
          <p className="-mt-2 text-sm text-brand-steel dark:text-gray-400">
            That&rsquo;s <span className="font-semibold">{tons} tons</span>.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Landfill Charge ($)">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 268.40"
              value={charge}
              onChange={(event) => {
                setError("");
                setCharge(event.target.value);
              }}
            />
          </FormField>
          <FormField label="Disposal Site">
            <Select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
              <option value="">Choose site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Ticket Number">
          <Input
            type="text"
            placeholder="From the scale house"
            value={ticket}
            onChange={(event) => setTicket(event.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Gross (lbs)">
            <Input
              type="text"
              inputMode="numeric"
              value={gross}
              onChange={(event) => setGross(event.target.value)}
            />
          </FormField>
          <FormField label="Tare (lbs)">
            <Input
              type="text"
              inputMode="numeric"
              value={tare}
              onChange={(event) => setTare(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Notes">
          <Textarea
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
