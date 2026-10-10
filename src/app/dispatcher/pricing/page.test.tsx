import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PricingTermsPage from "./page";

const state = {
  priceListReady: true,
  priceList: [
    { id: "p1", serviceType: "Delivery", dumpsterSize: "20 Yard", priceCents: 42500 },
    { id: "p2", serviceType: "Delivery", dumpsterSize: "40 Yard", priceCents: 52500 },
    { id: "p3", serviceType: "Pick-Up", dumpsterSize: "20 Yard", priceCents: 30000 },
  ],
};
vi.mock("@/components/system/ExpandedOperationsProvider", () => ({ useExpandedOperations: () => state }));
vi.mock("@/components/dispatcher/Topbar", () => ({ Topbar: ({ title }: { title: string }) => <h1>{title}</h1> }));

afterEach(() => {
  cleanup();
  state.priceListReady = true;
});

describe("Pricing & Terms page", () => {
  it("shows the rental length for each kind of customer and size", () => {
    render(<PricingTermsPage />);
    const commercial = screen.getByRole("row", { name: /Commercial/ });
    expect(within(commercial).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Commercial", "15 days", "30 days"]);
    const residential = screen.getByRole("row", { name: /Residential/ });
    expect(within(residential).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Residential", "7 days", "14 days"]);
  });

  it("lists the rate card, with a dash where a size has no rate", () => {
    render(<PricingTermsPage />);
    const pickup = screen.getByRole("row", { name: /Pick-Up/ });
    expect(within(pickup).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Pick-Up", "—", "$300.00", "—", "—"]);
    expect(within(screen.getByRole("row", { name: /Delivery/ })).getByText("$425.00")).toBeInTheDocument();
  });

  it("states the extension rate and how long a quote is good", () => {
    render(<PricingTermsPage />);
    expect(screen.getByText(/billed at \$75\.00 a week/)).toBeInTheDocument();
    expect(screen.getByText(/A quote is good for 7 days/)).toBeInTheDocument();
  });

  it("says rates are loading rather than showing an empty rate card", () => {
    state.priceListReady = false;
    render(<PricingTermsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading rates");
  });
});
