import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Input, FormField } from "./Field";
import { Modal } from "./Modal";

describe("shared form and modal accessibility", () => {
  it("connects labels, hints, and invalid state", () => {
    render(<FormField label="Employee ID" error="Required"><Input /></FormField>);
    const input = screen.getByLabelText("Employee ID");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Required");
  });

  it("moves focus into the dialog and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Confirm change" footer={<Button>Save</Button>}><Input aria-label="Reason" /></Modal>);
    expect(screen.getByRole("dialog", { name: "Confirm change" })).toBeInTheDocument();
    expect(screen.getByLabelText("Close dialog")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
