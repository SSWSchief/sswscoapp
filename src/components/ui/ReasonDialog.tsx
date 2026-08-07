"use client";
import * as React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { FormField, Textarea } from "./Field";

export function ReasonDialog({
  open,
  onClose,
  onSubmit,
  title,
  label = "Reason",
  confirmLabel = "Continue",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void | Promise<void>;
  title: string;
  label?: string;
  confirmLabel?: string;
  busy?: boolean;
}) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setReason("");
      setError("");
    }
  }, [open]);
  const submit = () => {
    const value = reason.trim();
    if (value.length < 3) {
      setError("Enter at least 3 characters.");
      return;
    }
    void onSubmit(value);
  };
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </>
      }
    >
      <FormField label={label} required error={error}>
        <Textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
    </Modal>
  );
}
