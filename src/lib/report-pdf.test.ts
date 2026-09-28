import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { decodePDFRawStream, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
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

  it("embeds the whole font, not a pdf-lib subset", async () => {
    // A pdf-lib subset renders as scattered letters in Preview and on iOS
    // while text extraction still passes, so check the embedding directly.
    const bytes = await createReportPdf("time", "2026-09-01", "2026-09-30", ["Employee"], [["Matthew Hicks"]]);
    const document = await PDFDocument.load(bytes);
    const source = await readFile(path.join(process.cwd(), "public", "NotoSans-Regular.ttf"));
    const embedded = document.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object): object is PDFDict => object instanceof PDFDict)
      .filter((dict) => dict.get(PDFName.of("Type")) === PDFName.of("FontDescriptor"))
      .map((dict) => document.context.lookup(dict.get(PDFName.of("FontFile2"))))
      .map((stream) => (stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode().length : 0));
    expect(embedded).toEqual([source.length]);
  });
});
