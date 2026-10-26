import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmailLink, PhoneLink, hasContact } from "./ContactLink";

describe("PhoneLink", () => {
  afterEach(cleanup);

  it("dials the number with the punctuation stripped", () => {
    render(<PhoneLink phone="(702) 555-0100" />);
    expect(screen.getByRole("link", { name: "(702) 555-0100" })).toHaveAttribute(
      "href",
      "tel:7025550100",
    );
  });

  it("renders no link at all when there is no number", () => {
    // A customer booked from the job form has a name and an address and
    // nothing else; `tel:` looks tappable and does nothing.
    render(<PhoneLink phone="" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/no phone number/i)).toBeInTheDocument();
  });

  it("treats whitespace and null as absent", () => {
    render(
      <>
        <PhoneLink phone="   " missingLabel="—" />
        <PhoneLink phone={null} missingLabel="—" />
      </>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});

describe("EmailLink", () => {
  afterEach(cleanup);

  it("addresses a mail to the address", () => {
    render(<EmailLink email="ap@example.com" />);
    expect(screen.getByRole("link", { name: "ap@example.com" })).toHaveAttribute(
      "href",
      "mailto:ap@example.com",
    );
  });

  it("says so when there is no address", () => {
    render(<EmailLink email={undefined} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/no email address/i)).toBeInTheDocument();
  });
});

describe("hasContact", () => {
  it("is what callers use to decide whether to offer the action at all", () => {
    expect(hasContact("702-555-0100")).toBe(true);
    expect(hasContact(" ")).toBe(false);
    expect(hasContact(null)).toBe(false);
  });
});
