/**
 * Builds docs/client-user-guide.html and docs/client-user-guide.pdf from
 * docs/client-user-guide.md.
 *
 * The Markdown is the single source of truth; both outputs are generated, so
 * the repository copy, the shareable page, and the printable copy cannot drift
 * apart. Screenshots are inlined as data URIs, which makes the HTML a single
 * file the client can save or mail without losing its images.
 *
 * The renderer below covers only the Markdown the guide actually uses:
 * headings, paragraphs, ordered and unordered lists, images, tables, block
 * quotes, horizontal rules, and inline emphasis, code, and links. That is a
 * deliberate trade — a documentation build should not pull a parser and its
 * dependency tree into a project that audits its own supply chain.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const SOURCE = "docs/client-user-guide.md";
const HTML_OUT = "docs/client-user-guide.html";
const PDF_OUT = "docs/client-user-guide.pdf";

/* ---------------------------------------------------------------- inlining */

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * Screenshots are captured at devicePixelRatio 2 so they stay sharp on a retina
 * display, which makes the raw set ~7 MB. Inlining that verbatim produced a
 * 9.6 MB page that is slow to open and close to the artifact size ceiling, so
 * each image is re-encoded to a sensible display width before embedding. The
 * full-resolution originals stay in docs/images/guide.
 */
const MAX_WIDTH = { phone: 780, desktop: 1600 };

async function inlineImage(relativePath) {
  const file = resolve(dirname(SOURCE), relativePath);
  const mime = MIME[extname(file).toLowerCase()];
  if (!mime) throw new Error(`Unsupported image type: ${relativePath}`);
  const original = await readFile(file);
  const size = pngSize(original);
  const phone = size.width && size.width <= PHONE_MAX_WIDTH;
  const cap = phone ? MAX_WIDTH.phone : MAX_WIDTH.desktop;

  let bytes = original;
  let { width, height } = size;
  if (width && width > cap) {
    bytes = await sharp(original)
      .resize({ width: cap })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    const resized = pngSize(bytes);
    ({ width, height } = resized);
  }
  return { uri: `data:${mime};base64,${bytes.toString("base64")}`, width, height };
}

/** Phone captures are 390 CSS px wide at dpr 3; office captures are 1280 at 2. */
const PHONE_MAX_WIDTH = 1400;

/**
 * Width and height from a PNG's IHDR chunk, which always comes first. Used to
 * hold layout space and to tell a phone capture from an office one, so the
 * narrow phone column is never applied to a merely tall desktop screen.
 */
function pngSize(bytes) {
  const isPng = bytes.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  if (!isPng || bytes.subarray(12, 16).toString("ascii") !== "IHDR")
    return { width: null, height: null };
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/* ---------------------------------------------------------------- renderer */

const escape = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Inline emphasis, code, and links. Code spans are lifted out first and put
 * back last, so their contents are never treated as emphasis or a link. The
 * sentinel is a control character that cannot appear in the source Markdown.
 */
const SENTINEL = "\u0000";

function inline(text) {
  const codes = [];
  const withPlaceholders = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `${SENTINEL}${codes.length - 1}${SENTINEL}`;
  });
  const rendered = escape(withPlaceholders)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, label, href) => `<a href="${href}">${label}</a>`,
    );
  return rendered.replace(
    new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, "g"),
    (_, index) => `<code>${escape(codes[Number(index)])}</code>`,
  );
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function render(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  const contents = [];
  let index = 0;

  const table = () => {
    const rows = [];
    while (index < lines.length && lines[index].trim().startsWith("|")) {
      rows.push(
        lines[index]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim()),
      );
      index += 1;
    }
    const [header, , ...body] = rows;
    const head = header.map((cell) => `<th>${inline(cell)}</th>`).join("");
    const rendered = body
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`,
      )
      .join("");
    html.push(
      `<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${rendered}</tbody></table></div>`,
    );
  };

  const list = (ordered) => {
    const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
    const items = [];
    while (index < lines.length && pattern.test(lines[index])) {
      let item = lines[index].replace(pattern, "");
      index += 1;
      // Continuation lines are indented under their item. Markdown convention
      // is two spaces, and requiring three dropped every wrapped bullet out of
      // its own list item and into a stray paragraph below it.
      while (
        index < lines.length &&
        /^\s{2,}\S/.test(lines[index]) &&
        !/^\s*([-*]|\d+\.)\s/.test(lines[index])
      ) {
        item += ` ${lines[index].trim()}`;
        index += 1;
      }
      items.push(`<li>${inline(item)}</li>`);
    }
    const tag = ordered ? "ol" : "ul";
    html.push(`<${tag}>${items.join("")}</${tag}>`);
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const id = slugify(text);
      if (level === 2) contents.push({ id, text });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      index += 1;
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
    if (image) {
      const [, alt, src] = image;
      const { uri, width, height } = await inlineImage(src);
      const phone = width && width <= MAX_WIDTH.phone;
      const size = width ? ` width="${width}" height="${height}"` : "";
      // The caption is the alt text; a screenshot with no caption is a
      // screenshot the reader has to interpret unaided.
      html.push(
        `<figure${phone ? ' class="phone"' : ""}>` +
          `<img src="${uri}" alt="${escape(alt)}"${size} loading="lazy">` +
          `<figcaption>${inline(alt)}</figcaption></figure>`,
      );
      index += 1;
      continue;
    }

    if (trimmed === "---") {
      html.push("<hr>");
      index += 1;
      continue;
    }

    if (trimmed.startsWith("|")) {
      table();
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      list(true);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      list(false);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      const quote = [];
      while (index < lines.length && lines[index].trim().startsWith("> ")) {
        quote.push(lines[index].trim().slice(2));
        index += 1;
      }
      html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith("#") &&
      !lines[index].trim().startsWith("|") &&
      !lines[index].trim().startsWith("> ") &&
      !/^!\[/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return { body: html.join("\n"), contents };
}

/* ------------------------------------------------------------------- fonts */

/**
 * Embeds the application's own typefaces so the guide reads as part of the
 * product rather than as a generic document — Oswald sets every heading in
 * Overwatch, Inter sets every paragraph.
 *
 * `next/font` already downloaded and subset both at build time, so the files
 * are taken from `.next/static/media` rather than fetched: the artifact CSP
 * blocks font CDNs, and a linked webfont would silently fall back to Arial.
 * Only the Latin subset is embedded (the one whose unicode-range covers
 * `u+00??`), which keeps the pair around 75 KB. If `.next` is missing — a fresh
 * clone with no build — the page degrades to the system stack instead of
 * failing.
 */
async function brandFonts() {
  const cssDir = ".next/static/css";
  let sheets = [];
  try {
    sheets = (await readdir(cssDir)).filter((name) => name.endsWith(".css"));
  } catch {
    console.warn("! no .next build found — falling back to system fonts");
    return "";
  }

  const css = (
    await Promise.all(sheets.map((name) => readFile(join(cssDir, name), "utf8")))
  ).join("");

  const faces = [];
  for (const family of ["Inter", "Oswald"]) {
    const pattern = new RegExp(
      `@font-face\\{font-family:${family};[^}]*?src:url\\(/_next/(static/media/[^)]+)\\)[^}]*?unicode-range:u\\+00\\?\\?`,
      "g",
    );
    const match = pattern.exec(css);
    if (!match) {
      console.warn(`! could not locate the ${family} latin subset`);
      continue;
    }
    const weights = family === "Oswald" ? "200 700" : "100 900";
    const bytes = await readFile(join(".next", match[1]));
    faces.push(
      `@font-face{font-family:"${family}";font-style:normal;font-weight:${weights};` +
        `font-display:swap;src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2")}`,
    );
  }
  return faces.join("\n");
}

/* ------------------------------------------------------------------- shell */

const STYLES = `
/* Palette and type are the application's own, so the guide reads as part of
   Overwatch rather than as a document about it: brand navy and blue from
   tailwind.config.ts, Oswald for headings and Inter for text as in layout.tsx.
   The neutrals (mist, ice, steel) already carry a blue bias — they are the
   product's greys, not defaults. */
:root {
  color-scheme: light dark;
  --navy: #052F66;
  --blue: #105499;
  --skyline: #619BD0;
  --ice: #B1C7DA;
  --mist: #F4F7FA;
  --charcoal: #1E2328;
  --steel: #626367;

  --page: #ffffff;
  --ink: var(--charcoal);
  --muted: var(--steel);
  --accent: var(--blue);
  --display: var(--navy);
  --rule: #DCE6EF;
  --rule-strong: var(--navy);
  --panel: var(--mist);
  --panel-edge: var(--ice);
}
@media (prefers-color-scheme: dark) {
  :root {
    --page: #0C1520;
    --ink: #E4ECF3;
    --muted: #93A6B8;
    --accent: var(--skyline);
    --display: #CFE0F0;
    --rule: #21324a;
    --rule-strong: #1B3E68;
    --panel: #121E2C;
    --panel-edge: #223650;
  }
}
:root[data-theme="dark"] {
  --page: #0C1520;
  --ink: #E4ECF3;
  --muted: #93A6B8;
  --accent: var(--skyline);
  --display: #CFE0F0;
  --rule: #21324a;
  --rule-strong: #1B3E68;
  --panel: #121E2C;
  --panel-edge: #223650;
}
:root[data-theme="light"] {
  --page: #ffffff;
  --ink: var(--charcoal);
  --muted: var(--steel);
  --accent: var(--blue);
  --display: var(--navy);
  --rule: #DCE6EF;
  --rule-strong: var(--navy);
  --panel: var(--mist);
  --panel-edge: var(--ice);
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  padding: clamp(2rem, 6vw, 4.5rem) 1.25rem 6rem;
  background: var(--page);
  color: var(--ink);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 19px;
  line-height: 1.68;
  -webkit-font-smoothing: antialiased;
}
/* Text sits at a comfortable reading measure; figures break out wider so a
   dense dispatch screen is still legible on paper. */
main { max-width: 52rem; margin: 0 auto; }

h1, h2, h3 {
  font-family: "Oswald", "Haettenschweiler", Impact, sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--display);
  text-wrap: balance;
}
h1 {
  font-size: clamp(2.3rem, 6vw, 3.1rem);
  line-height: 1.08;
  letter-spacing: 0.012em;
  margin: 0 0 .75rem;
}
h2 {
  font-size: clamp(1.65rem, 3.6vw, 2rem);
  line-height: 1.15;
  letter-spacing: 0.028em;
  margin: 4rem 0 1.25rem;
  padding-top: 1.5rem;
  border-top: 2px solid var(--rule-strong);
}
h3 {
  font-size: 1.22rem;
  letter-spacing: 0.05em;
  margin: 2.5rem 0 .6rem;
}
h4 { font-size: 1rem; margin: 1.75rem 0 .25rem; color: var(--muted); }

p, li { max-width: 40rem; }
p { margin: 0 0 1.1rem; }
li { margin: .3rem 0; }
ul, ol { padding-left: 1.35rem; margin: 0 0 1.1rem; }
strong { font-weight: 600; color: var(--display); }

a { color: var(--accent); text-underline-offset: 2px; }
a:focus-visible, button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 2px;
}

code {
  background: var(--panel);
  border: 1px solid var(--panel-edge);
  border-radius: 3px;
  padding: .08em .38em;
  font-size: .88em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--display);
}

blockquote {
  margin: 1.75rem 0;
  padding: 1rem 1.35rem;
  border-left: 3px solid var(--accent);
  background: var(--panel);
  border-radius: 0 4px 4px 0;
}
blockquote p { margin: 0; }

hr { border: 0; border-top: 1px solid var(--rule); margin: 3rem 0; }

/* Screenshots sit on the product's own surface colour with a hairline edge, so
   a white app screen still reads as a distinct object on a white page. */
figure { margin: 1.75rem 0 2.25rem; }
figure img {
  display: block;
  width: 100%;
  height: auto;
  background: var(--panel);
  border: 1px solid var(--panel-edge);
  border-radius: 5px;
}
/* Phone captures are held near their real width; blown up to the full text
   column they read as a tablet. */
figure.phone { max-width: 25rem; }
figcaption {
  margin-top: .6rem;
  font-size: .88rem;
  line-height: 1.5;
  color: var(--muted);
  border-left: 2px solid var(--panel-edge);
  padding-left: .7rem;
}

.scroll { overflow-x: auto; margin: 1.5rem 0; }
table { border-collapse: collapse; width: 100%; font-size: .94rem; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: .6rem .8rem; border-bottom: 1px solid var(--rule); }
th {
  font-family: "Oswald", Impact, sans-serif;
  font-size: .78rem;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--display);
}

nav.toc {
  background: var(--panel);
  border: 1px solid var(--panel-edge);
  border-radius: 6px;
  padding: 1.4rem 1.6rem;
  margin: 2.25rem 0 3.5rem;
}
nav.toc h2 {
  font-size: .76rem;
  letter-spacing: .16em;
  margin: 0 0 .7rem;
  padding: 0;
  border: 0;
  color: var(--muted);
}
nav.toc ol {
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: toc;
  display: grid;
  gap: .1rem;
}
nav.toc li { margin: 0; max-width: none; }
nav.toc a {
  display: flex;
  align-items: baseline;
  gap: .75rem;
  padding: .45rem 0;
  font-family: "Oswald", Impact, sans-serif;
  font-size: 1.06rem;
  text-transform: uppercase;
  letter-spacing: .035em;
  text-decoration: none;
  color: var(--display);
  border-bottom: 1px solid transparent;
}
/* The folio is a printing concept — on screen the anchor already jumps. */
.toc-page { display: none; }
nav.toc li + li a { border-top: 1px solid var(--panel-edge); }
nav.toc a:hover { color: var(--accent); }

@media print {
  body { padding: 0; font-size: 12pt; background: #fff; color: #000; }
  /* Keep at least two lines of a paragraph together across a page turn. */
  p, li { orphans: 2; widows: 2; }
  main { max-width: none; }
  h1, h2, h3 { color: #052F66; }
  h2 { border-top-color: #052F66; }
  section.chapter { break-before: page; }
  /* Contents: leader dots to the folio, so a reader can find a part by page. */
  nav.toc a {
    display: flex;
    align-items: baseline;
    gap: .5rem;
    color: #052F66;
  }
  nav.toc a::after {
    content: "";
    flex: 1 1 auto;
    order: 1;
    height: .55em;
    border-bottom: 1px dotted #9BB0C4;
  }
  .toc-page {
    display: inline;
    order: 2;
    font-variant-numeric: tabular-nums;
    color: #052F66;
  }
  figure, table, blockquote, li { break-inside: avoid; }
  figure img { max-height: 20cm; object-fit: contain; object-position: left; }
  figure.phone { max-width: 10cm; }
  nav.toc { break-after: page; background: none; border: 0; padding: 0; }
  a { color: #000; text-decoration: none; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`;

/**
 * Wraps each `<h2>` and everything under it in a `<section class="chapter">`.
 *
 * Two jobs: it lets the print stylesheet start each part on a fresh sheet by
 * breaking before the section rather than the heading, and it gives the
 * page-number measurement pass something to hide one part at a time.
 */
function wrapSections(body) {
  const parts = body.split(/(?=<h2 )/);
  // `split` on a zero-width lookahead does not emit a leading empty string when
  // the subject already starts with the pattern, so a body beginning at its
  // first <h2> must not have its opening chunk mistaken for front matter —
  // that left section one unwrapped and invisible to the folio measurement.
  const front = body.trimStart().startsWith("<h2 ") ? "" : (parts.shift() ?? "");
  if (!parts.length) return body;
  return [
    front,
    ...parts.map((section) => `<section class="chapter">\n${section}\n</section>`),
  ]
    .filter(Boolean)
    .join("\n");
}

function page(title, contents, body, fonts, pageNumbers = null) {
  const toc = contents
    .map((entry, index) => {
      const number = pageNumbers?.[index];
      const folio = number
        ? `<span class="toc-page">${number}</span>`
        : "";
      return `<li><a href="#${entry.id}"><span>${escape(entry.text)}</span>${folio}</a></li>`;
    })
    .join("");
  // The contents belong after the title and its opening paragraphs, not above
  // them — a reader needs to know what the document is before being offered a
  // list of its parts. The first <h2> marks where the body proper begins.
  const nav = `<nav class="toc"><h2>Contents</h2><ol>${toc}</ol></nav>`;
  const split = body.indexOf("<h2 ");
  const withNav =
    split === -1
      ? `${wrapSections(body)}\n${nav}`
      : `${body.slice(0, split)}${nav}\n${wrapSections(body.slice(split))}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${fonts}
${STYLES}</style>
</head>
<body>
<main>
${withNav}
</main>
</body>
</html>
`;
}

/* --------------------------------------------------------------- printing */

const PDF_OPTIONS = (title) => ({
  format: "Letter",
  printBackground: true,
  margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate:
    '<div style="width:100%;font-size:8pt;color:#666;padding:0 16mm;display:flex;justify-content:space-between;">' +
    `<span>${escape(title)}</span><span class="pageNumber"></span></div>`,
});

/**
 * Loads the built page and gets every image off `loading="lazy"`.
 *
 * Chrome's PDF renderer never scrolls, so a lazy image below the first viewport
 * stays unloaded and prints as an empty box — which is exactly how an earlier
 * build shipped a guide of blank rectangles. Nothing is printed until every
 * image has decoded.
 */
async function openForPrint(browser, title) {
  const sheet = await browser.newPage();
  await sheet.goto(`file://${resolve(HTML_OUT)}`, { waitUntil: "networkidle" });
  await sheet.evaluate(async () => {
    const images = [...document.querySelectorAll("img")];
    images.forEach((image) => image.setAttribute("loading", "eager"));
    await Promise.all(
      images.map((image) =>
        image.complete && image.naturalWidth
          ? Promise.resolve()
          : image.decode().catch(() => {}),
      ),
    );
  });
  const unloaded = await sheet.evaluate(
    () =>
      [...document.querySelectorAll("img")].filter(
        (image) => !image.complete || image.naturalWidth === 0,
      ).length,
  );
  if (unloaded)
    throw new Error(`${unloaded} image(s) failed to load; PDF not written`);
  await sheet.emulateMedia({ media: "print", colorScheme: "light" });
  void title;
  return sheet;
}

/**
 * Page count of a PDF Chrome just produced.
 *
 * Counting `/Type /Page` objects and cross-checking against the page tree's
 * `/Count` avoids adding a PDF parser to a project that audits its own
 * dependencies. The two must agree, or the number is not trustworthy enough to
 * print in a table of contents.
 */
function pdfPageCount(buffer) {
  const raw = buffer.toString("latin1");
  const objects = [...raw.matchAll(/\/Type\s*\/Page[^s]/g)].length;
  const counts = [...raw.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  const tree = counts.length ? Math.max(...counts) : 0;
  if (!objects || objects !== tree)
    throw new Error(
      `Could not read the page count reliably (objects=${objects}, tree=${tree})`,
    );
  return objects;
}

/**
 * The printed page each section starts on.
 *
 * Every section begins on a fresh sheet, so hiding everything after section *k*
 * and printing gives the pages consumed up to and including it. The next
 * section therefore starts on the following page. This measures the real
 * document — same fonts, same column, same images — rather than predicting
 * pagination, which is the only way the folios can be trusted.
 */
async function measureSectionPages(sheet, sectionCount, title) {
  const show = async (limit) => {
    await sheet.evaluate((visible) => {
      const id = "guide-measure-style";
      document.getElementById(id)?.remove();
      const style = document.createElement("style");
      style.id = id;
      // nth-of-type is 1-based, so n+1 hides everything and n+(k+1) leaves k.
      style.textContent = `section.chapter:nth-of-type(n+${visible + 1}) { display: none !important; }`;
      document.head.append(style);
    }, limit);
    return pdfPageCount(await sheet.pdf(PDF_OPTIONS(title)));
  };

  // The title and the contents block come before section one, so the baseline
  // is the document with every section hidden.
  let consumed = await show(0);
  const starts = [];
  for (let k = 1; k <= sectionCount; k += 1) {
    starts.push(consumed + 1);
    consumed = await show(k);
  }
  await sheet.evaluate(() =>
    document.getElementById("guide-measure-style")?.remove(),
  );
  return starts;
}

/* -------------------------------------------------------------------- main */

async function main() {
  const markdown = await readFile(SOURCE, "utf8");
  const title =
    /^#\s+(.*)$/m.exec(markdown)?.[1] ?? "Overwatch — How to use the app";
  const { body, contents } = await render(markdown);
  const fonts = await brandFonts();

  // Pass one has no folios: the numbers do not exist until the document has
  // been laid out, and the contents block is what shifts them.
  await writeFile(HTML_OUT, page(title, contents, body, fonts));

  const browser = await chromium.launch();
  try {
    let sheet = await openForPrint(browser, title);
    const starts = await measureSectionPages(sheet, contents.length, title);
    console.log(
      `· contents: ${contents.map((c, i) => `${c.text} p${starts[i]}`).join(", ")}`,
    );
    await sheet.close();

    // Pass two carries the measured folios. Adding them cannot repaginate the
    // document — they sit inside the existing contents rows — but the result is
    // verified below regardless.
    const html = page(title, contents, body, fonts, starts);
    await writeFile(HTML_OUT, html);
    console.log(
      `· ${HTML_OUT} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB)`,
    );

    sheet = await openForPrint(browser, title);
    const buffer = await sheet.pdf({ ...PDF_OPTIONS(title), path: PDF_OUT });
    const pages = pdfPageCount(buffer);
    await sheet.close();

    const recheck = await openForPrint(browser, title);
    const confirmed = await measureSectionPages(recheck, contents.length, title);
    await recheck.close();
    const drifted = starts.some((value, i) => value !== confirmed[i]);
    if (drifted)
      throw new Error(
        `Adding the folios moved the sections (${starts} → ${confirmed}); contents would be wrong`,
      );

    console.log(`· ${PDF_OUT} — ${pages} pages`);
    if (pages > 50)
      console.warn(`! ${pages} pages exceeds the 50-page budget`);
  } finally {
    await browser.close();
  }
  console.log(`· ${basename(SOURCE)} → ${contents.length} sections`);
}

await main();
