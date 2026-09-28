import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createReportPdf } from "./report-pdf";

describe("report PDF", () => {
  it("creates a readable file and repeats the table across pages", async () => {
    const rows = Array.from({ length: 110 }, (_, index) => [
      `#${index + 1}`,
      "2026-09-24",
      "Complete",
      `123 Example Street, Las Vegas — route ${index + 1}`,
      "Delivery",
      "006",
    ]);
    const bytes = await createReportPdf(
      "jobs", "2026-09-01", "2026-09-30",
      ["Job", "Date", "Status", "Address", "Service", "Driver ID"], rows,
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(1);
  });
});
