import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DriverDumpstersPage from "./page";

const rows = Array.from({ length: 201 }, (_, index) => ({
  id: `dumpster-${index + 1}`,
  code: `D-${String(index + 1).padStart(4, "0")}`,
  size: "20 Yard",
  status: "out",
  type: "Roll-off",
  current_customer_id: null,
  current_location: index === 200 ? "Final Job Site" : "Yard",
  current_job_id: null,
  air_tag_id: index === 200 ? "AT-201" : null,
  notes: "",
}));
const range = vi.fn(async (start: number, end: number) => ({ data: rows.slice(start, end + 1), error: null }));

vi.mock("@/components/driver/MobileHeader", () => ({ MobileHeader: () => <div>Driver header</div> }));
vi.mock("@/components/ui/StatusBadge", () => ({ DumpsterStatusBadge: ({ status }: { status: string }) => <span>{status}</span> }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      const chain = { select: () => chain, is: () => chain, order: () => chain, range };
      return chain;
    },
  }),
}));

afterEach(() => { cleanup(); range.mockClear(); });

describe("driver dumpster directory", () => {
  it("loads beyond the shared 50-item fleet cache and stays read only", async () => {
    render(<DriverDumpstersPage />);
    expect(await screen.findByText("D-0201")).toBeInTheDocument();
    expect(screen.getByText("201 of 201 dumpsters · Read only")).toBeInTheDocument();
    expect(screen.getByText("Final Job Site")).toBeInTheDocument();
    expect(screen.getByText("AT-201")).toBeInTheDocument();
    expect(range).toHaveBeenCalledWith(0, 199);
    expect(range).toHaveBeenCalledWith(200, 399);
    expect(screen.queryByRole("button", { name: /edit|delete|add dumpster/i })).not.toBeInTheDocument();
    await userEvent.setup().type(screen.getByPlaceholderText(/Code, size/i), "D-0201");
    expect(screen.getByText("1 of 201 dumpsters · Read only")).toBeInTheDocument();
  });
});
