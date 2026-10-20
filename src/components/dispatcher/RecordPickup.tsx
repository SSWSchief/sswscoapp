"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/Field";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { effectivePermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { formatPacificDayLabel, pacificDate } from "@/lib/time-clock";
import type { ContainerPlacement } from "@/lib/types";

/**
 * "Mark picked up" for a can that came back without a Pick-Up job in
 * Overwatch. Until this existed a rental only closed through a completed
 * Pick-Up job, so a can the office or management hauled back stayed "out"
 * (Austin, 2026-10-19: 20001, 20002 and 40001). `record_pickup` closes the
 * rental on the day given and returns the can to the yard.
 */
export function RecordPickupButton({
  placement,
  code,
  className,
}: {
  placement: ContainerPlacement;
  code: string;
  className?: string;
}) {
  const { currentUser, canMutate, refresh } = useOperations();
  const { toast } = useToast();
  const today = pacificDate(new Date());
  const delivered = pacificDate(placement.deliveredAt);
  const [open, setOpen] = React.useState(false);
  const [day, setDay] = React.useState(today);
  const [busy, setBusy] = React.useState(false);

  if (!currentUser || !effectivePermissions(currentUser).jobs) return null;

  const save = async () => {
    if (!day || day > today || day < delivered) {
      toast(`Pick a day from ${formatPacificDayLabel(delivered)} to today.`, { tone: "error" });
      return;
    }
    setBusy(true);
    const { error } = await createClient().rpc("record_pickup", {
      target_placement_id: placement.id,
      picked_up_on: day,
    });
    setBusy(false);
    if (error) {
      toast(error.message, { tone: "error" });
      return;
    }
    toast(`${code} is back in the yard.`, { tone: "success" });
    setOpen(false);
    await refresh();
  };

  return (
    <>
      <button
        type="button"
        disabled={!canMutate}
        onClick={() => {
          setDay(today);
          setOpen(true);
        }}
        className={
          className ??
          "min-h-11 text-sm font-medium text-brand-blue hover:underline disabled:text-brand-silver"
        }
      >
        Mark picked up
      </button>
      <Modal
        open={open}
        onClose={busy ? () => {} : () => setOpen(false)}
        title={`Mark ${code} picked up`}
        widthClass="max-w-md"
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !canMutate} onClick={() => void save()}>
              {busy ? "Saving…" : "Back in Yard"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-steel">
            {placement.address} · delivered {formatPacificDayLabel(delivered)}
          </p>
          <FormField label="Day it was picked up" required>
            <Input
              type="date"
              value={day}
              min={delivered}
              max={today}
              onChange={(event) => setDay(event.target.value)}
            />
          </FormField>
          <p className="text-xs text-brand-steel">
            Ends the rental on that day and sets {code} to In Yard. Use this when
            the can came back without a Pick-Up job in Overwatch.
          </p>
        </div>
      </Modal>
    </>
  );
}
