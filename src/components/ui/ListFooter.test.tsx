import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListFooter } from "./ListFooter";

afterEach(cleanup);

describe("list count lines", () => {
  it("stays quiet when the whole table is loaded", () => {
    render(<ListFooter shown={4} loaded={12} total={12} noun="customers" />);
    expect(screen.getByText(/Showing 4 of 12 customers/)).toBeInTheDocument();
    expect(screen.queryByText(/in total/)).not.toBeInTheDocument();
  });

  it("says how many exist when the list is capped", () => {
    // The line used to read "Showing 50 of 50 customers" against a table of
    // 312 — a number an owner would take as a fact about the business.
    render(<ListFooter shown={50} loaded={50} total={312} noun="customers" />);
    expect(screen.getByText("312 in total")).toBeInTheDocument();
    expect(
      screen.getByText(/searching here only covers the 50 loaded/),
    ).toBeInTheDocument();
  });
});
