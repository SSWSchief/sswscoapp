"use client";

import * as React from "react";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { Button } from "@/components/ui/Button";
import { CardHeader } from "@/components/ui/Card";
import { FormField, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";

const confirmationPhrase = "DELETE TRAINING DATA";
const records = [
  ["Customer", "TRAINING — DELETE ME"],
  ["Truck", "TRAINING-TRUCK-01"],
  ["Dumpster", "TRAINING-DUMPSTER-01 · 20 Yard"],
  ["Job", "#TRAINING-001 · pending and unassigned"],
  ["Invoice", "TRAINING-INV-001 · $0 draft"],
] as const;

export function TrainingDataPanel() {
  const {
    trainingDataset,
    provisionTrainingDataset,
    removeTrainingDataset,
  } = useExpandedOperations();
  const { canMutate } = useOperations();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<"provision" | "remove" | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const active = trainingDataset.status === "active";
  const closeConfirmation = React.useCallback(() => {
    if (busy) return;
    setConfirmOpen(false);
    setConfirmation("");
  }, [busy]);

  const provision = async () => {
    setBusy("provision");
    const result = await provisionTrainingDataset();
    setBusy(null);
    toast(
      result.ok
        ? result.data.idempotent
          ? "Training data was already ready."
          : "Training data created."
        : result.error.message,
      { tone: result.ok ? "success" : "error" },
    );
  };

  const remove = async () => {
    setBusy("remove");
    const result = await removeTrainingDataset("training-v1");
    setBusy(null);
    if (result.ok) {
      setConfirmOpen(false);
      setConfirmation("");
    }
    toast(
      result.ok
        ? result.data.idempotent
          ? "Training data was already removed."
          : "Training data removed."
        : result.error.message,
      { tone: result.ok ? "success" : "error" },
    );
  };

  return (
    <section className="p-5">
      <div className="space-y-5">
        <CardHeader title="Controlled training data" className="-mx-5 -mt-5" />
        <div
          className={`rounded border px-4 py-3 text-sm ${
            active
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-brand-ice bg-brand-mist/50 text-brand-steel"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="font-semibold">
            {active ? "Training dataset is active." : "No training dataset is active."}
          </span>{" "}
          {active
            ? "Every record is clearly marked and can be removed together."
            : "Create one linked example when the client is ready to practice."}
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold uppercase text-brand-charcoal">
            Included records
          </h2>
          <ul className="mt-3 divide-y divide-brand-ice overflow-hidden rounded border border-brand-ice">
            {records.map(([label, value]) => (
              <li
                key={label}
                className="flex min-h-12 flex-col justify-center gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-semibold text-brand-charcoal">
                  {label}
                </span>
                <span className="text-sm text-brand-steel">{value}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm leading-6 text-brand-steel">
          This creates no fake employee, login, message, time record, photo,
          SOP, or safety checklist. The training job stays unassigned.
        </p>
        {active ? (
          <Button
            variant="danger"
            disabled={!canMutate || Boolean(busy)}
            onClick={() => setConfirmOpen(true)}
          >
            Remove Training Data
          </Button>
        ) : (
          <Button
            disabled={!canMutate || Boolean(busy)}
            onClick={() => void provision()}
          >
            {busy === "provision" ? "Creating..." : "Create Training Data"}
          </Button>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={closeConfirmation}
        title="Remove Training Data"
        widthClass="max-w-lg"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={closeConfirmation}
            >
              Keep Data
            </Button>
            <Button
              variant="danger"
              disabled={
                !canMutate ||
                busy === "remove" ||
                confirmation !== confirmationPhrase
              }
              onClick={() => void remove()}
            >
              {busy === "remove" ? "Removing..." : "Remove All Five Records"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-brand-steel">
          This removes only the five records registered to training-v1. Real
          company records and the Company Announcements and Dispatch channels
          are not affected.
        </p>
        <div className="mt-4">
          <FormField
            label={`Type ${confirmationPhrase} to confirm`}
            required
          >
            <Input
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </FormField>
        </div>
      </Modal>
    </section>
  );
}
