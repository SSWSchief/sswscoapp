import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const margin = 25;
const fontSize = 8;
const lineHeight = 10;
const padding = 5;

function wrap(value: unknown, font: PDFFont, width: number): string[] {
  const available = Math.max(8, width - padding * 2);
  const result: string[] = [];
  for (const paragraph of String(value ?? "").split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= available) {
        line = candidate;
        continue;
      }
      if (line) result.push(line);
      line = "";
      for (const character of word) {
        if (font.widthOfTextAtSize(line + character, fontSize) > available && line) {
          result.push(line);
          line = "";
        }
        line += character;
      }
    }
    result.push(line);
  }
  return result.length ? result : [""];
}

function weight(header: string): number {
  if (header === "Punches") return 3;
  if (["Notes", "Address", "Location", "Adjustment Reason"].includes(header)) return 2;
  if (["Clock In", "Clock Out", "Employee", "Job"].includes(header)) return 1.5;
  return 1;
}

/** Build the same rows as CSV into an actual, readable, multi-page PDF. */
export async function createReportPdf(
  type: string,
  from: string,
  to: string,
  headers: string[],
  rows: unknown[][],
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fontBytes = await readFile(path.join(process.cwd(), "public", "NotoSans-Regular.ttf"));
  // Never `subset: true`: @pdf-lib/fontkit's subsetter drops most glyph
  // outlines, so the text extracts fine but Preview, Safari and iOS draw only
  // a few letters per word. The font file is already a static Latin subset
  // (~24 KB, cut with fontTools), so embedding it whole stays small.
  const font = await document.embedFont(new Uint8Array(fontBytes), { subset: false });
  const pageWidth = headers.length > 8 ? 1224 : 792;
  const pageHeight = 792;
  const widthAvailable = pageWidth - margin * 2;
  const totalWeight = headers.reduce((sum, header) => sum + weight(header), 0);
  const widths = headers.map((header) => (widthAvailable * weight(header)) / totalWeight);
  const headerHeight = 26;
  let page!: PDFPage;
  let y!: number;

  const drawHeaders = () => {
    page = document.addPage([pageWidth, pageHeight]);
    page.drawText(`SSWSCO ${type} report`, { x: margin, y: pageHeight - 34, size: 16, font, color: rgb(0.04, 0.2, 0.39) });
    page.drawText(`${from} through ${to}`, { x: margin, y: pageHeight - 52, size: 9, font });
    y = pageHeight - 68;
    page.drawRectangle({ x: margin, y: y - headerHeight, width: widthAvailable, height: headerHeight, color: rgb(0.91, 0.95, 0.98) });
    let x = margin;
    headers.forEach((header, index) => {
      const lines = wrap(header, font, widths[index]);
      lines.slice(0, 2).forEach((line, lineIndex) => page.drawText(line, { x: x + padding, y: y - 10 - lineIndex * lineHeight, size: fontSize, font }));
      x += widths[index];
    });
    y -= headerHeight;
  };

  drawHeaders();
  for (const row of rows) {
    const cellLines = headers.map((_, index) => wrap(row[index], font, widths[index]));
    let offset = 0;
    const maxLines = Math.max(...cellLines.map((lines) => lines.length));
    while (offset < maxLines) {
      const linesThatFit = Math.floor((y - margin - padding * 2) / lineHeight);
      if (linesThatFit < 1) {
        drawHeaders();
        continue;
      }
      const count = Math.min(maxLines - offset, linesThatFit);
      const height = count * lineHeight + padding * 2;
      page.drawRectangle({ x: margin, y: y - height, width: widthAvailable, height, borderColor: rgb(0.79, 0.84, 0.89), borderWidth: 0.5 });
      let x = margin;
      cellLines.forEach((lines, index) => {
        lines.slice(offset, offset + count).forEach((line, lineIndex) => {
          page.drawText(line, { x: x + padding, y: y - padding - fontSize - lineIndex * lineHeight, size: fontSize, font });
        });
        x += widths[index];
      });
      y -= height;
      offset += count;
      if (offset < maxLines) drawHeaders();
    }
  }
  document.getPages().forEach((reportPage, index) => {
    reportPage.drawText(`Page ${index + 1} of ${document.getPageCount()}`, { x: pageWidth - 105, y: 10, size: 8, font });
  });
  return document.save();
}
