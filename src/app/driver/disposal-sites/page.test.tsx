import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DriverDisposalSitesPage from "./page";

const sites = [
  { id: "s1", name: "Apex Landfill", address: "13550 North US Highway 93, Las Vegas, NV", material_rules: ["Mixed C&D", "Call for current rate"], operating_hours: "Mon–Sat 6am–4pm", truck_restrictions: "", estimated_wait_minutes: 20, notes: "", is_active: true },
  { id: "s2", name: "Henderson Transfer Station", address: "560 Cape Horn Dr, Henderson, NV", material_rules: [], operating_hours: "", truck_restrictions: "No trailers", estimated_wait_minutes: 0, notes: "Scale house on the left.", is_active: true },
];
const eq = vi.fn();

vi.mock("@/components/driver/MobileHeader", () => ({ MobileHeader: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: (...args: unknown[]) => { eq(...args); return chain; },
        order: () => Promise.resolve({ data: sites, error: null }),
      };
      return chain;
    },
  }),
}));

afterEach(() => { cleanup(); eq.mockClear(); });

describe("driver disposal sites", () => {
  it("lists active sites with directions and details, read only", async () => {
    render(<DriverDisposalSitesPage />);
    expect(await screen.findByText("Apex Landfill")).toBeInTheDocument();
    expect(eq).toHaveBeenCalledWith("is_active", true);
    expect(screen.getByText("2 of 2 sites · Read only")).toBeInTheDocument();
    expect(screen.getByText("Mixed C&D · Call for current rate")).toBeInTheDocument();
    expect(screen.getByText("20 min")).toBeInTheDocument();
    expect(screen.getByText("No trailers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cape Horn Dr.*Directions/ })).toHaveAttribute("href", expect.stringContaining("destination=560%20Cape%20Horn"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await userEvent.setup().type(screen.getByPlaceholderText(/Name, area/i), "henderson");
    expect(screen.getByText("1 of 2 sites · Read only")).toBeInTheDocument();
    expect(screen.queryByText("Apex Landfill")).not.toBeInTheDocument();
  });
});
