import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  coreDomainsForPath,
  expandedDomainsForPath,
  type CoreDomain,
  type ExpandedDomain,
} from "./route-domains";

/**
 * A page only receives the data domains its route asks for. Three pages
 * (Pricing & Terms, the office pre-trip review and the driver post-trip form)
 * read data their route never loaded, so they worked when reached from a page
 * that had loaded it and sat empty or "Loading…" after a refresh. This test
 * reads every portal page, and the components it imports, and fails when one
 * reads a field whose domain its route does not load.
 */

const coreFieldDomain: Record<string, CoreDomain> = {
  jobs: "jobs",
  activities: "jobs",
  jobNotes: "jobs",
  disposalTickets: "jobs",
  notifications: "notifications",
  users: "people",
  customers: "customers",
  vendors: "vendors",
  trucks: "fleet",
  dumpsters: "fleet",
  openPlacements: "fleet",
  myRecentTimeEntries: "time",
  timeEntries: "time",
  timeEntryCorrections: "time",
  timeRequests: "time",
  absenceEvents: "time",
};

const expandedFieldDomain: Record<string, ExpandedDomain> = {
  invoices: "finance",
  priceList: "finance",
  priceListReady: "finance",
  settings: "settings",
  pretripTemplates: "compliance",
  pretripSubmissions: "compliance",
  sops: "compliance",
};

/**
 * Reads that are safe without their domain, each for a stated reason. Keep
 * this short: anything added here is a page that will look empty sometimes.
 */
const knownSafe = new Set([
  // Falls back to messageRecipients, which the messaging domain always loads;
  // drivers cannot read the staff directory at all.
  "components/system/TeamMessages.tsx reads users (people)",
  // One file holds both modals. The dumpsters page renders only the dumpster
  // modal (customers) and the truck pages only the truck modal (users).
  "components/dispatcher/AssetModals.tsx reads users (people)",
  "components/dispatcher/AssetModals.tsx reads customers (customers)",
]);

const appRoot = join(process.cwd(), "src", "app");
const srcRoot = join(process.cwd(), "src");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name === "page.tsx" ? [path] : [];
  });
}

/** Fields destructured from `useOperations()` / `useExpandedOperations()`. */
function fieldsRead(source: string) {
  const core = new Set<string>();
  const expanded = new Set<string>();
  const pattern = /const\s*\{([^}]*)\}\s*=\s*use(Operations|ExpandedOperations)\(\)/g;
  for (const match of source.matchAll(pattern)) {
    const names = match[1]
      .split(",")
      .map((part) => part.trim().split(/[:=\s]/)[0])
      .filter(Boolean);
    for (const name of names) (match[2] === "Operations" ? core : expanded).add(name);
  }
  return { core, expanded };
}

function importedComponents(source: string): string[] {
  return [...source.matchAll(/from\s+"@\/components\/([^"]+)"/g)]
    .map((match) => join(srcRoot, "components", `${match[1]}.tsx`))
    .filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    });
}

function routeFor(page: string) {
  const parts = relative(appRoot, page).split(sep).slice(0, -1);
  return `/${parts.map((part) => (part.startsWith("[") ? "sample-id" : part)).join("/")}`;
}

const portalPages = ["dispatcher", "driver", "management"].flatMap((portal) =>
  pages(join(appRoot, portal)),
);

describe("every portal page loads the data it reads", () => {
  it("finds the portal pages", () => {
    expect(portalPages.length).toBeGreaterThan(20);
  });

  it.each(portalPages.map((page) => [routeFor(page), page]))("%s", (route, page) => {
    const sources = [page, ...importedComponents(readFileSync(page, "utf8"))];
    const core = coreDomainsForPath(route);
    const expanded = expandedDomainsForPath(route);
    const missing: string[] = [];
    for (const file of sources) {
      const read = fieldsRead(readFileSync(file, "utf8"));
      for (const field of read.core) {
        const domain = coreFieldDomain[field];
        if (domain && !core.has(domain))
          missing.push(`${relative(srcRoot, file)} reads ${field} (${domain})`);
      }
      for (const field of read.expanded) {
        const domain = expandedFieldDomain[field];
        if (domain && !expanded.has(domain))
          missing.push(`${relative(srcRoot, file)} reads ${field} (${domain})`);
      }
    }
    expect(missing.filter((entry) => !knownSafe.has(entry))).toEqual([]);
  });
});
