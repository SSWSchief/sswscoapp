import { readFile } from "node:fs/promises";

const generatedPath = process.argv[2];
if (!generatedPath) throw new Error("Pass the generated database type file path.");
const [generated, committed] = await Promise.all([
  readFile(generatedPath, "utf8"),
  readFile(new URL("../src/lib/supabase/database.types.ts", import.meta.url), "utf8"),
]);

const sectionKeys = (source, section, nextSection) => {
  const start = source.indexOf(`${section}:`);
  const end = source.indexOf(`${nextSection}:`, start + section.length);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${section} in generated types.`);
  return [...source.slice(start, end).matchAll(/^\s{6}([a-z][a-z0-9_]*):\s*\{/gm)].map((match) => match[1]);
};

const generatedTables = sectionKeys(generated, "Tables", "Views");
const generatedFunctions = sectionKeys(generated, "Functions", "Enums");
const missing = [...generatedTables, ...generatedFunctions].filter(
  (name) => !new RegExp(`\\b${name}:\\s*(?:Table<|\\{)`).test(committed),
);
if (missing.length) {
  throw new Error(`Committed database types are missing generated contracts: ${missing.join(", ")}`);
}
console.log(`Verified ${generatedTables.length} tables and ${generatedFunctions.length} functions in the committed database contract.`);
