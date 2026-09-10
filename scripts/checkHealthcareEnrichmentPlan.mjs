import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnrichmentPlan } from "./lib/healthcareEnrichmentPlan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const fixtureDirectory = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "test-fixtures"
);
const productionFixturePath = path.join(
  fixtureDirectory,
  "enrichment-plan.production.fixture.json"
);
const inputFixturePath = path.join(
  fixtureDirectory,
  "enrichment-plan.input.fixture.json"
);

function toProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

async function readJsonArray(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  assert(Array.isArray(parsed), `${toProjectPath(filePath)} must contain an array.`);
  return parsed;
}

function findRecord(plan, id) {
  const record = plan.records.find((candidate) => candidate.id === id);
  assert(record, `Expected plan record for ${id}.`);
  return record;
}

function summarizeClassifications(records) {
  return records.reduce(
    (summary, record) => ({
      ...summary,
      [record.classification]: (summary[record.classification] ?? 0) + 1
    }),
    {}
  );
}

async function main() {
  const productionFacilities = await readJsonArray(productionFixturePath);
  const enrichmentInputs = await readJsonArray(inputFixturePath);
  const originalProductionRaw = await readFile(productionFixturePath, "utf8");
  const plan = buildEnrichmentPlan(productionFacilities, enrichmentInputs);

  assert.equal(plan.records.length, enrichmentInputs.length);

  const applicable = findRecord(plan, "fixture-clinic-needs-enrichment");
  assert.equal(applicable.classification, "applicable");
  assert.deepEqual(applicable.appliedFields, ["services", "hours", "insurance", "cost", "accessibility"]);
  assert.deepEqual(applicable.scoreCategoriesNewlyCovered, [
    "accessibility",
    "cost",
    "hours",
    "insurance",
    "services"
  ]);

  const blocked = findRecord(plan, "fixture-clinic-bad-provenance");
  assert.equal(blocked.classification, "blocked");
  assert(
    blocked.reasons.some((reason) => reason.includes("checkedDate is required")),
    "Expected missing checkedDate provenance blocker."
  );
  assert(
    blocked.reasons.some((reason) => reason.includes("uses a banned review, rating, Google, Yelp or patient-comment source")),
    "Expected banned Google/Yelp/review source blocker."
  );
  assert(
    blocked.reasons.some((reason) => reason.includes("must point to a location-specific source")),
    "Expected non-location-specific source blocker."
  );
  assert(
    blocked.reasons.some((reason) => reason.includes("status must be source_backed before production promotion")),
    "Expected needs_review status blocker when requireSourceBacked is true."
  );

  const skippedExisting = findRecord(plan, "fixture-clinic-existing-services");
  assert.equal(skippedExisting.classification, "no_change");
  assert.deepEqual(skippedExisting.appliedFields, []);
  assert.deepEqual(skippedExisting.skippedExistingFields, ["services"]);

  const missingProduction = findRecord(plan, "fixture-clinic-missing-production");
  assert.equal(missingProduction.classification, "blocked");
  assert.deepEqual(missingProduction.reasons, ["no_matching_production_facility"]);

  assert.equal(plan.summary.applicable, 1);
  assert.equal(plan.summary.blocked, 2);
  assert.equal(plan.summary.no_change, 1);
  assert.equal(plan.summary.totalProposedFieldChanges, 5);
  assert.deepEqual(plan.summary.recordsGainingEachScoreCategory, {
    accessibility: 1,
    cost: 1,
    hours: 1,
    insurance: 1,
    services: 1
  });
  assert.equal(
    plan.summary.note,
    "No production data written. verificationStatus unchanged."
  );

  const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "careatlas-enrichment-plan-"));

  try {
    const reportPath = path.join(tmpDirectory, "enrichment-plan-report.json");
    await writeFile(reportPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    JSON.parse(await readFile(reportPath, "utf8"));
  } finally {
    await rm(tmpDirectory, { force: true, recursive: true });
  }

  assert.equal(
    await readFile(productionFixturePath, "utf8"),
    originalProductionRaw,
    "The enrichment plan check must not modify the production fixture."
  );

  const classificationSummary = summarizeClassifications(plan.records);
  console.log("Healthcare enrichment plan fixture check passed.");
  console.log(`Classification summary: ${JSON.stringify(classificationSummary)}`);
}

main().catch((error) => {
  console.error("Healthcare enrichment plan fixture check failed.");
  console.error(error.message);
  process.exit(1);
});
