import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FindMyLink } from "./FindMyLink";

function withUserAgent(value: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(value);
}

// Vitest runs without `globals`, so Testing Library never registers its own
// automatic cleanup and rendered trees would otherwise leak between tests.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FindMyLink", () => {
  it("opens the Find My Items tab on Apple platforms", () => {
    withUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X)");
    render(<FindMyLink />);
    expect(screen.getByRole("link", { name: "Open Find My" })).toHaveAttribute(
      "href",
      "findmy://items",
    );
  });

  it("renders nothing where the Find My app cannot exist", () => {
    // AirTags are invisible on iCloud.com, so a Windows or Android user has no
    // fallback to send them to — offering the button would only mislead.
    withUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    render(<FindMyLink />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
