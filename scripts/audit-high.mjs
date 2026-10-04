/**
 * `npm audit --audit-level=high`, minus advisories this project has reviewed
 * and accepted in scripts/audit-allowlist.json.
 *
 * An advisory with no patched release fails every pull request no matter
 * what it changes, so it has to be accepted somewhere, and narrowly: by its
 * advisory id, with a reason and a date to look again. Anything else rated
 * high or critical still fails, and so does an accepted advisory once its
 * review date has passed. npm's own transport errors are printed unchanged so
 * CI can tell an unreachable registry from a real finding.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowlist = JSON.parse(readFileSync(new URL("./audit-allowlist.json", import.meta.url), "utf8"));
const today = new Date().toISOString().slice(0, 10);
const accepted = new Map(allowlist.filter((entry) => entry.review_by >= today).map((entry) => [entry.advisory, entry]));

const run = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  process.stdout.write(run.stdout ?? "");
  process.stderr.write(run.stderr ?? "");
  process.exit(2);
}
if (report.error) {
  console.error(`npm audit failed: ${report.error.summary ?? report.error.code} (audit endpoint returned an error)`);
  process.exit(2);
}

const findings = [];
for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via === "string") continue; // inherited; reported at its source
    if (via.severity !== "high" && via.severity !== "critical") continue;
    const id = String(via.url ?? "").split("/").pop();
    if (accepted.has(id)) continue;
    findings.push(`${via.severity}  ${name}  ${via.title}  ${via.url}`);
  }
}

for (const entry of allowlist)
  console.log(`${accepted.has(entry.advisory) ? "accepted" : "EXPIRED "}  ${entry.advisory} (${entry.package}) — review by ${entry.review_by}`);
if (findings.length) {
  console.error(`\n${findings.length} unaccepted high-severity advisor${findings.length === 1 ? "y" : "ies"}:`);
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log("No unaccepted high-severity advisories.");
