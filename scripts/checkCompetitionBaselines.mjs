import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = path.join(root, "docs", "competition-baselines.md");
const workflowPath = path.join(
  root,
  ".github",
  "workflows",
  "competition-baselines.yml"
);
const scriptPath = path.join(root, "scripts", "createCompetitionBaselines.mjs");

function runBaselineScript(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    shell: false
  });
}

const ledger = await readFile(ledgerPath, "utf8");
const dryRun = runBaselineScript([]);
assert.equal(
  dryRun.status,
  0,
  `Competition baseline dry run failed.\n${dryRun.stdout}\n${dryRun.stderr}`
);
assert.match(dryRun.stdout, /VERIFIED competition\/gibc-v2-2026-baseline/u);
assert.match(
  dryRun.stdout,
  /(?:PENDING|VERIFIED|WOULD_CREATE) competition\/gatewayhacks-2026-baseline/u
);
assert.doesNotMatch(
  dryRun.stdout,
  /WOULD_UPDATE/u,
  "The checked-in competition ledger should already match every due tag."
);

const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), "careatlas-baseline-ledger-")
);
try {
  const temporaryLedger = path.join(temporaryDirectory, "competition-baselines.md");
  const deliberatelyStale = ledger.replace(
    /\| Global Innovation Build Challenge V2 \|([^\n]+)\| Reconstructed: `e0b4f96de5cb` \|/u,
    "| Global Innovation Build Challenge V2 |$1| Scheduled; fill from the tag after creation |"
  );
  assert.notEqual(deliberatelyStale, ledger, "The ledger fixture replacement should be exercised.");
  await writeFile(temporaryLedger, deliberatelyStale, "utf8");

  const updateRun = runBaselineScript([
    "--apply",
    "--now=2026-08-31T23:00:00Z",
    `--ledger=${temporaryLedger}`
  ]);
  assert.equal(
    updateRun.status,
    0,
    `Competition baseline ledger update failed.\n${updateRun.stdout}\n${updateRun.stderr}`
  );
  const updatedLedger = await readFile(temporaryLedger, "utf8");
  assert.match(
    updatedLedger,
    /\| Global Innovation Build Challenge V2 \|[^\n]+\| Reconstructed: `e0b4f96de5cb` \|/u
  );
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}

const workflow = await readFile(workflowPath, "utf8");
assert.match(workflow, /cron: "17 4,7,8,16 \* \* \*"/u);
assert.match(workflow, /git push origin --tags/u);
assert.match(workflow, /git add docs\/competition-baselines\.md/u);
assert.match(workflow, /git push origin HEAD:main/u);

console.log(
  "Competition baseline check passed: existing tags verify, future events remain pending, stale ledger rows self-correct, and the workflow publishes tags plus ledger updates."
);
