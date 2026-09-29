import { describe, expect, it } from "vitest";
import { parseUsAddress } from "./address";

describe("parseUsAddress", () => {
  it("splits a one-line job address into billing fields", () => {
    expect(parseUsAddress("123 Main St, Las Vegas, NV 89101")).toEqual({
      addressLine1: "123 Main St", city: "Las Vegas", state: "NV", postalCode: "89101",
    });
  });

  it("keeps a unit in the street line and accepts ZIP+4 and a country suffix", () => {
    expect(parseUsAddress("42 Desert Rd, Unit 5, Henderson, nv 89002-1234")).toEqual({
      addressLine1: "42 Desert Rd, Unit 5", city: "Henderson", state: "NV", postalCode: "89002-1234",
    });
    expect(parseUsAddress("1 Strip Blvd, Las Vegas, NV 89109, USA")).toMatchObject({ postalCode: "89109" });
  });

  it("refuses to guess when the address has no city, state and ZIP", () => {
    expect(parseUsAddress("Behind the Walmart on Rainbow")).toBeNull();
    expect(parseUsAddress("123 Main St, Las Vegas")).toBeNull();
    expect(parseUsAddress("123 Main St, Las Vegas, Nevada")).toBeNull();
  });
});
