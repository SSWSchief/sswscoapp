import { describe, expect, it } from "vitest";
import { parsePriceToCents } from "@/components/dispatcher/PriceListPanel";
import { formatCurrency } from "./utils";

describe("price entry", () => {
  it("accepts the shapes a dispatcher actually types", () => {
    expect(parsePriceToCents("450")).toBe(45000);
    expect(parsePriceToCents("450.00")).toBe(45000);
    expect(parsePriceToCents("$450.50")).toBe(45050);
    expect(parsePriceToCents("1,250.75")).toBe(125075);
    expect(parsePriceToCents(" 99.9 ")).toBe(9990);
  });

  it("rejects anything that would silently round money", () => {
    expect(parsePriceToCents("450.005")).toBeNull();
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("free")).toBeNull();
    expect(parsePriceToCents("-50")).toBeNull();
    expect(parsePriceToCents("4.5.6")).toBeNull();
  });

  it("round-trips through the shared currency formatter", () => {
    const cents = parsePriceToCents("450.25");
    expect(cents).toBe(45025);
    expect(formatCurrency(cents!)).toBe("$450.25");
  });
});
