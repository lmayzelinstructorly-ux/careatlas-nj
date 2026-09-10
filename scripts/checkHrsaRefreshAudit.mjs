import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHrsaRefreshAudit } from "./auditHrsaRefresh.mjs";
import { getForbiddenProductionDistReason } from "./productionDataAllowlist.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const fixtureDir = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "test-fixtures",
  "hrsa-refresh-audit"
);
const inputPath = path.join(fixtureDir, "official-hrsa.fixture.csv");
const productionFixturePath = path.join(
  fixtureDir,
  "production-facilities.fixture.json"
);
const realProductionPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function ids(records) {
  return new Set(records.map((record) => record.normalizedSourceId));
}

const productionBefore = hash(await readFile(realProductionPath));
const audit = await runHrsaRefreshAudit({
  inputPath,
  productionPath: productionFixturePath,
  states: ["CT"],
  writeReport: false,
  date: new Date("2099-01-02T12:00:00Z")
});
const productionAfter = hash(await readFile(realProductionPath));

assert(productionBefore === productionAfter, "The real production facilities file changed.");
assert(audit.counts.upstreamRows === 7, "Expected seven upstream fixture rows.");
assert(audit.counts.productionRows === 5, "Expected five production fixture rows.");
assert(audit.counts.matched === 2, "Expected two matched stable source IDs.");
assert(audit.counts.comparableMatched === 2, "Expected two one-to-one matches.");
assert(audit.matched.length === 2, "Expected two matched production records in the report.");

const additionIds = ids(audit.additions);
assert(audit.additions.length === 4, "Expected four new upstream source IDs.");
for (const expected of ["NEW-001", "UP-DUP-001", "INVALID-001", "OUT-001"]) {
  assert(additionIds.has(expected), `Missing expected addition ${expected}.`);
}

const removalIds = ids(audit.removals);
assert(audit.removals.length === 2, "Expected two production IDs missing upstream.");
assert(removalIds.has("REMOVED-001"), "Removed production fixture was not reported.");
assert(removalIds.has("PROD-DUP-001"), "Production duplicate missing upstream was not reported.");
assert(
  audit.duplicateUpstream.length === 1 &&
    audit.duplicateUpstream[0].normalizedSourceId === "UP-DUP-001",
  "Upstream duplicate source ID was not reported."
);
assert(
  audit.duplicateProduction.length === 1 &&
    audit.duplicateProduction[0].normalizedSourceId === "PROD-DUP-001",
  "Production duplicate source ID was not reported."
);

for (const category of [
  "identity",
  "addressLocation",
  "contact",
  "coordinates",
  "statusType"
]) {
  assert(
    audit.changes[category].some(
      (change) => change.normalizedSourceId === "CHANGE-001"
    ),
    `Changed fixture was not reported in ${category}.`
  );
}

assert(
  audit.invalidCoordinates.length === 1 &&
    audit.invalidCoordinates[0].sourceId === "INVALID-001",
  "Invalid upstream coordinates were not reported."
);
assert(
  audit.outOfBounds.length === 1 && audit.outOfBounds[0].sourceId === "OUT-001",
  "Out-of-bounds upstream coordinates were not reported."
);
assert(audit.stateCounts.length === 1, "Expected one fixture state summary.");
assert(audit.stateCounts[0].state === "CT", "Expected a Connecticut state summary.");
assert(audit.stateCounts[0].additions === 4, "Connecticut additions count is wrong.");
assert(audit.stateCounts[0].removals === 2, "Connecticut removals count is wrong.");
assert(audit.stateCounts[0].changed === 1, "Connecticut changed-record count is wrong.");
assert(audit.stateCounts[0].invalidCoordinates === 1, "Coordinate issue count is wrong.");
assert(audit.stateCounts[0].outOfBounds === 1, "Out-of-bounds count is wrong.");
assert(
  audit.reportPath.endsWith(
    path.join("docs", "reports", "hrsa-refresh-audit-2099-01-02.md")
  ),
  "The report path is not under docs/reports with the expected date."
);
assert(
  getForbiddenProductionDistReason(
    "docs/reports/hrsa-refresh-audit-2099-01-02.md"
  ) === "HRSA refresh review artifacts",
  "The production dist guard does not reject HRSA refresh audit reports."
);
assert(
  getForbiddenProductionDistReason(
    "docs/reports/hrsa-refresh-review-packet-2099-01-02.md"
  ) === "HRSA refresh review artifacts",
  "The production dist guard does not reject HRSA refresh review packets."
);
for (const heading of [
  "Matched production records",
  "New upstream records not in production",
  "Production records missing upstream",
  "Duplicate upstream source IDs",
  "Changed address/location fields",
  "Missing or invalid coordinates",
  "Out-of-bounds coordinates",
  "State-by-state counts"
]) {
  assert(audit.markdown.includes(heading), `Audit report is missing ${heading}.`);
}

console.log("HRSA refresh audit fixture check passed.");
console.log("Covered matched, added, removed, duplicate, changed, invalid-coordinate, out-of-bounds, and state-count cases.");
console.log("The check ran read-only and did not change production facilities.json.");
