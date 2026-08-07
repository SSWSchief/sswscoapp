import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const script = new URL("./import-operations.mjs", import.meta.url).pathname;

async function withManifest(payload, run) {
  const directory = await mkdtemp(join(tmpdir(), "sswsco-import-test-"));
  const path = join(directory, "manifest.json");
  await writeFile(path, JSON.stringify(payload));
  try {
    return await run(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const valid = {
  users: [
    {
      id: "driver-1",
      employeeId: "D-1",
      fullName: "Sample Driver",
      email: "driver@example.invalid",
      role: "driver",
      accessRole: "driver",
    },
  ],
  customers: [
    { id: "customer-1", name: "Customer", address: "1 Main Street" },
  ],
  trucks: [{ id: "truck-1", number: "T-1", assignedDriverId: "driver-1" }],
  dumpsters: [{ id: "dumpster-1", code: "D-1", size: "20 Yard" }],
  jobs: [
    {
      id: "job-1",
      reference: "#1",
      customerId: "customer-1",
      address: "1 Main Street",
      serviceType: "Delivery",
      dumpsterSize: "20 Yard",
      assignedDriverId: "driver-1",
      assignedTruckId: "truck-1",
      assignedDumpsterId: "dumpster-1",
      scheduledFor: "2026-08-07T12:00:00.000Z",
    },
  ],
};

test("validates and hashes a complete dry-run manifest", async () => {
  await withManifest(valid, async (path) => {
    const result = await execFileAsync(process.execPath, [script, path]);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, "valid");
    assert.equal(output.dryRun, true);
    assert.match(output.sourceHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(output.counts, {
      users: 1,
      customers: 1,
      trucks: 1,
      dumpsters: 1,
      jobs: 1,
    });
  });
});

test("rejects unknown fields and incompatible role contracts", async () => {
  await withManifest(
    {
      users: [
        {
          ...valid.users[0],
          role: "management",
          unknownSecret: "must-not-pass",
        },
      ],
    },
    async (path) => {
      await assert.rejects(
        execFileAsync(process.execPath, [script, path]),
        (error) =>
          error.code === 1 &&
          error.stderr.includes('"status": "invalid"') &&
          !error.stderr.includes("must-not-pass"),
      );
    },
  );
});

test("rejects duplicate natural identifiers", async () => {
  await withManifest(
    { trucks: [valid.trucks[0], { ...valid.trucks[0], id: "truck-2" }] },
    async (path) => {
      await assert.rejects(
        execFileAsync(process.execPath, [script, path]),
        (error) =>
          error.code === 1 && error.stderr.includes("number is duplicated"),
      );
    },
  );
});

test("refuses apply before target and approved hash are supplied", async () => {
  await withManifest(valid, async (path) => {
    await assert.rejects(
      execFileAsync(process.execPath, [script, path, "--apply"]),
      (error) =>
        error.code === 1 && error.stderr.includes("--environment=value is required"),
    );
  });
});
