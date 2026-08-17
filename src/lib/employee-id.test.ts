import { describe, expect, it } from "vitest";
import { deriveEmployeeId, nextAvailableEmployeeId } from "./employee-id";

describe("derived employee IDs", () => {
  it("uses the first initial and surname", () => {
    expect(deriveEmployeeId("Norberto Angulo")).toBe("NANGULO");
    expect(deriveEmployeeId("Fred Dakake")).toBe("FDAKAKE");
  });

  it("reads the last word as the surname", () => {
    expect(deriveEmployeeId("Maria del Carmen Ruiz")).toBe("MRUIZ");
  });

  it("keeps a single-word name whole", () => {
    expect(deriveEmployeeId("Cher")).toBe("CHER");
  });

  it("drops punctuation and spacing an ID cannot carry", () => {
    expect(deriveEmployeeId("  Mary-Jane   O'Neill  ")).toBe("MONEILL");
  });

  it("falls back rather than producing an empty ID", () => {
    expect(deriveEmployeeId("!!! ???")).toBe("EMP");
    expect(deriveEmployeeId("")).toBe("EMP");
  });
});

describe("employee ID availability", () => {
  it("takes the base when nothing holds it", () => {
    expect(nextAvailableEmployeeId("NANGULO", ["FDAKAKE"])).toBe("NANGULO");
  });

  it("suffixes past the IDs already spoken for", () => {
    expect(
      nextAvailableEmployeeId("NANGULO", ["NANGULO", "NANGULO-2"]),
    ).toBe("NANGULO-3");
  });

  it("treats a differently-cased ID as taken", () => {
    // The unique index is case-sensitive, so "nangulo" would be accepted — two
    // employees separated only by capitalisation is a trap, not a distinction.
    expect(nextAvailableEmployeeId("NANGULO", ["nangulo"])).toBe("NANGULO-2");
  });
});
