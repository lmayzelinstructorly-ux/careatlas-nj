import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { discoverOfficialSourcePages } from "./lib/healthcareOfficialSourceDiscovery.mjs";
import path from "node:path";
import {
  collectEnrichmentProvenanceErrors,
  hasEnrichmentValue
} from "./lib/healthcareEnrichmentProvenance.mjs";
import {
  accessCategoryFields,
  facilitiesPath,
  projectRoot,
  readJson,
  sha256File,
  tmpDirectory,
  toProjectPath
} from "./lib/healthcareAccessReporting.mjs";

const npmCliPath =
  process.env.npm_execpath ??
  path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js"
  );

const inputPath = path.join(tmpDirectory, "healthcare-official-enrichment-input.json");
const reviewReportPath = path.join(
  tmpDirectory,
  "healthcare-official-enrichment-review-report.json"
);
const discoveryReportPath = path.join(
  tmpDirectory,
  "healthcare-official-source-discovery-report.json"
);
const summaryPath = path.join(
  tmpDirectory,
  "healthcare-official-enrichment-summary.json"
);
const planPath = path.join(tmpDirectory, "healthcare-official-enrichment-plan.json");

const bannedSourcePattern =
  /\b(google\s*(maps|places|reviews?)|maps\.google|google\.com\/maps|yelp|ratings?|patient\s+comments?|review\s+summar(y|ies)|copied\s+directory\s+reviews?|healthgrades|vitals|zocdoc|webmd|sharecare)\b/i;

const fieldValueKeys = {
  accessibility: ["accessibilityInfo"],
  cost: ["priceInfo"],
  hours: ["hours"],
  insurance: ["insuranceInfo"],
  services: ["services"]
};

function runNpm(args) {
  const result = spawnSync(process.execPath, [npmCliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`npm ${args.join(" ")} failed.`);
  }

  return result;
}

async function assertNonEmpty(filePath) {
  const info = await stat(filePath);
  assert(info.size > 0, `${toProjectPath(filePath)} should not be empty.`);
}

function facilityLikeFromInput(input) {
  return {
    ...(input.enrichment ?? {}),
    fieldSources: input.fieldSources ?? {}
  };
}

function inputHasFieldValue(input, field) {
  const facilityLike = {};

  for (const key of fieldValueKeys[field] ?? []) {
    if (Object.prototype.hasOwnProperty.call(input.enrichment ?? {}, key)) {
      facilityLike[key] = input.enrichment[key];
    }
  }

  return hasEnrichmentValue(facilityLike, field);
}

function assertNoBannedSources(input) {
  for (const [field, source] of Object.entries(input.fieldSources ?? {})) {
    const sourceText = [
      source.sourceType,
      source.sourceUrl,
      source.sourceTitle,
      source.sourceLabel,
      source.reviewerNote
    ]
      .filter(Boolean)
      .join(" ");

    assert(
      !bannedSourcePattern.test(sourceText),
      `${input.id} fieldSources.${field} includes a banned source signal.`
    );
  }
}

async function main() {
  const fixture = { name: "Fixture Health Center", address: "100 Main Street", city: "Newark", state: "NJ", phone: "973-555-0100", website: "https://clinic.example.invalid/locations/newark" };
  const options = { cacheDirectory: path.join(tmpDirectory, "discovery-fixture-cache") };
  const matched = await discoverOfficialSourcePages(fixture, { refreshCache: true }, options);
  assert.equal(matched.hasLocationSpecificPage, true, "A matching fixture location must be recognized.");
  const unrelated = await discoverOfficialSourcePages({ ...fixture, website: "https://clinic.example.invalid/organization" }, { refreshCache: true }, options);
  assert.equal(unrelated.hasLocationSpecificPage, false, "An organization page must not become location evidence.");
  const beforeHash = await sha256File(facilitiesPath);

  runNpm(["run", "generate:healthcare-enrichment-worklist"]);

  runNpm([
    "run",
    "collect:healthcare-official-enrichment",
    "--",
    "--limit=5",
    "--tier=1"
  ]);

  await assertNonEmpty(inputPath);
  await assertNonEmpty(discoveryReportPath);
  await assertNonEmpty(reviewReportPath);
  await assertNonEmpty(summaryPath);
  await assertNonEmpty(planPath);

  const inputs = await readJson(inputPath);
  const discoveryReport = await readJson(discoveryReportPath);
  const reviewReport = await readJson(reviewReportPath);
  const summary = await readJson(summaryPath);
  const plan = await readJson(planPath);

  assert.equal(inputs.length, 0, "Unavailable fixture sources must not invent enrichment records.");
  assert(reviewReport.items.length > 0, "Unavailable sources must produce review items.");
  assert(Array.isArray(inputs), `${toProjectPath(inputPath)} must contain an array.`);
  assert(
    Array.isArray(discoveryReport.items),
    "Discovery report must include items array."
  );
  assert.equal(
    discoveryReport.items.length,
    5,
    "Tier 1 limit 5 collector check must inspect five facilities."
  );
  assert(
    discoveryReport.summary,
    "Discovery report must include summary counts."
  );
  assert(Array.isArray(reviewReport.items), "Review report must include items array.");
  assert(plan.summary, "Plan report must include summary.");
  assert(summary.recordsGainingFields, "Summary must include recordsGainingFields.");
  assert(summary.sourceAvailability, "Summary must include sourceAvailability.");

  for (const field of accessCategoryFields) {
    assert(
      Number.isInteger(summary.recordsGainingFields[field]),
      `Summary must count records gaining ${field}.`
    );
  }

  for (const key of [
    "processedTier",
    "countWithFacilityWebsite",
    "countWithUsableOfficialWebsite",
    "countWithOnlyCmsHrsaDatasetSource",
    "countWithNoUsableFacilityPage",
    "countWithLocationSpecificPageFound",
    "countWithLocationSpecificPageNotFound"
  ]) {
    assert(
      Object.prototype.hasOwnProperty.call(summary.sourceAvailability, key),
      `Summary sourceAvailability must include ${key}.`
    );
  }

  for (const input of inputs) {
    const errors = collectEnrichmentProvenanceErrors(facilityLikeFromInput(input), {
      label: input.id,
      requireSourceBacked: true
    });

    assert.equal(errors.length, 0, errors.join(" "));
    assertNoBannedSources(input);

    for (const field of accessCategoryFields) {
      if (inputHasFieldValue(input, field)) {
        assert(
          input.fieldSources?.[field],
          `${input.id} enriches ${field} but lacks fieldSources.${field}.`
        );
      }
    }
  }

  if (summary.blockedReviewItemCount > 0 || reviewReport.blockedItemCount > 0) {
    assert(
      reviewReport.items.length > 0,
      "Review report must be non-empty when records are blocked."
    );
  }

  runNpm([
    "run",
    "plan:healthcare-enrichment",
    "--",
    `--input=${toProjectPath(inputPath)}`,
    `--output=${toProjectPath(planPath)}`
  ]);
  const afterHash = await sha256File(facilitiesPath);
  assert.equal(
    afterHash,
    beforeHash,
    "Official-source enrichment check must not mutate public/data/healthcare/facilities.json."
  );

  console.log("Healthcare official-source enrichment check passed.");
  console.log(`Validated ${inputs.length} proposed enrichment records.`);
  console.log(`Review report items: ${reviewReport.items.length}.`);
}

if (process.argv.includes("--isolated-fixture")) {
  await main();
} else {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "careatlas-enrichment-check-"));
  try {
    const fixtureModule = pathToFileURL(path.join(projectRoot, "scripts/test-support/officialSourceFetch.mjs")).href;
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--isolated-fixture"], {
      cwd: projectRoot,
      env: { ...process.env, CAREATLAS_TMP_DIR: temporaryRoot, NODE_OPTIONS: "--import=" + fixtureModule },
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    assert.equal(result.status, 0, result.error?.message ?? "Isolated collector check failed.");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
