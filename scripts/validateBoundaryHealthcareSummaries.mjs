import path from "node:path";
import {
  assignmentsPath,
  collectSupportedBoundaries,
  facilitiesPath,
  readChecksum,
  readJson,
  relativePath,
  summariesPath
} from "./boundaryHealthcareSummaries.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const allowedLevels = new Set(["state", "county", "local_jurisdiction"]);
const allowedStatuses = new Set([
  "has_facilities",
  "no_assigned_facilities",
  "limited_data"
]);
const bannedMedicalQualityPhrases = [
  "better healthcare quality",
  "best healthcare",
  "medical quality",
  "quality of care"
];

function parseArgs(argv) {
  const args = {
    inputPath: summariesPath
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--file=")) {
      args.inputPath = path.resolve(projectRoot, arg.slice("--file=".length));
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option "${arg}".`);
    } else {
      args.inputPath = path.resolve(projectRoot, arg);
    }
  }

  return args;
}

function printHelp() {
  console.log("Validate generated boundary healthcare summaries.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run validate:boundary-healthcare-summaries");
  console.log("  node scripts/validateBoundaryHealthcareSummaries.mjs --file=public/data/healthcare/boundary-healthcare-summaries.json");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateSummaryShape(errors, summary, level, boundaryId) {
  const label = `${level}:${boundaryId}`;

  if (!isObject(summary)) {
    errors.push(`${label} summary must be an object.`);
    return;
  }

  if (summary.boundaryId !== boundaryId) {
    errors.push(`${label} boundaryId does not match its key.`);
  }

  if (summary.boundaryLevel !== level) {
    errors.push(`${label} boundaryLevel does not match its level bucket.`);
  }

  if (!allowedLevels.has(summary.boundaryLevel)) {
    errors.push(`${label} has unsupported boundaryLevel "${summary.boundaryLevel}".`);
  }

  if (!allowedStatuses.has(summary.summaryStatus)) {
    errors.push(`${label} has unsupported summaryStatus "${summary.summaryStatus}".`);
  }

  if (!Array.isArray(summary.statuses) || summary.statuses.length === 0) {
    errors.push(`${label} needs at least one status.`);
  } else {
    for (const status of summary.statuses) {
      if (!allowedStatuses.has(status)) {
        errors.push(`${label} has unsupported status "${status}".`);
      }
    }
  }

  for (const numericField of [
    "totalAssignedFacilities",
    "facilitiesWithValidCoordinates",
    "facilitiesMissingCoordinates"
  ]) {
    if (
      !Number.isInteger(summary[numericField]) ||
      summary[numericField] < 0
    ) {
      errors.push(`${label} ${numericField} must be a non-negative integer.`);
    }
  }

  if (!isObject(summary.facilityTypeCounts)) {
    errors.push(`${label} facilityTypeCounts must be an object.`);
  }

  for (const fieldName of [
    "dataCompletenessNotes",
    "missingDataWarnings",
    "sourceCoverageNotes",
    "sourceFacilityIds"
  ]) {
    if (!Array.isArray(summary[fieldName])) {
      errors.push(`${label} ${fieldName} must be an array.`);
    }
  }

  if (summary.totalAssignedFacilities === 0) {
    if (summary.summaryStatus !== "no_assigned_facilities") {
      errors.push(`${label} with no facilities must use no_assigned_facilities.`);
    }

    if (
      !summary.missingDataWarnings?.some((note) =>
        note.includes("does not mean no healthcare exists")
      )
    ) {
      errors.push(`${label} no-facility summary needs the no-healthcare-exists warning.`);
    }
  }

  if (summary.totalAssignedFacilities > 0 && summary.summaryStatus !== "has_facilities") {
    errors.push(`${label} with assigned facilities must use has_facilities.`);
  }

  const serialized = JSON.stringify(summary).toLowerCase();

  for (const phrase of bannedMedicalQualityPhrases) {
    if (serialized.includes(phrase)) {
      errors.push(`${label} includes banned medical quality phrase "${phrase}".`);
    }
  }
}

function collectAssignedBoundaryKeys(assignmentsArtifact) {
  const keys = new Set();

  for (const assignment of assignmentsArtifact.assignments ?? []) {
    for (const [level, boundary] of [
      ["state", assignment.state],
      ["county", assignment.county],
      ["local_jurisdiction", assignment.localJurisdiction]
    ]) {
      if (boundary?.status === "assigned" && hasText(boundary.geoid)) {
        keys.add(`${level}:${boundary.geoid}`);
      }
    }
  }

  return keys;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const errors = [];
  const [facilities, assignmentsArtifact, summariesArtifact, supportedBoundaries] =
    await Promise.all([
      readJson(facilitiesPath),
      readJson(assignmentsPath),
      readJson(args.inputPath),
      collectSupportedBoundaries()
    ]);

  if (!Array.isArray(facilities)) {
    errors.push(`${relativePath(facilitiesPath)} must contain a JSON array.`);
  }

  if (!isObject(assignmentsArtifact) || !Array.isArray(assignmentsArtifact.assignments)) {
    errors.push(`${relativePath(assignmentsPath)} must contain an assignments array.`);
  }

  if (!isObject(summariesArtifact) || !isObject(summariesArtifact.summaries)) {
    errors.push(`${relativePath(args.inputPath)} must contain a summaries object.`);
  }

  if (!isObject(summariesArtifact.noAssignedFacilityPolicy)) {
    errors.push(`${relativePath(args.inputPath)} must contain a noAssignedFacilityPolicy object.`);
  } else {
    const policy = summariesArtifact.noAssignedFacilityPolicy;

    if (policy.summaryStatus !== "no_assigned_facilities") {
      errors.push("noAssignedFacilityPolicy must use no_assigned_facilities.");
    }

    if (
      !Array.isArray(policy.statuses) ||
      !policy.statuses.includes("limited_data")
    ) {
      errors.push("noAssignedFacilityPolicy must mark limited_data.");
    }

    if (
      !Array.isArray(policy.missingDataWarnings) ||
      !policy.missingDataWarnings.some((note) =>
        note.includes("does not mean no healthcare exists")
      )
    ) {
      errors.push("noAssignedFacilityPolicy needs the no-healthcare-exists warning.");
    }
  }

  if (errors.length === 0) {
    const [facilitiesChecksum, assignmentsChecksum] = await Promise.all([
      readChecksum(facilitiesPath),
      readChecksum(assignmentsPath)
    ]);

    if (summariesArtifact.metadata?.inputChecksums?.facilities !== facilitiesChecksum) {
      errors.push("Boundary summary facilities checksum does not match current facilities.json. Regenerate it with npm run generate:boundary-healthcare-summaries -- --write.");
    }

    if (summariesArtifact.metadata?.inputChecksums?.assignments !== assignmentsChecksum) {
      errors.push("Boundary summary assignment checksum does not match current facility-boundary-assignments.json. Regenerate it with npm run generate:boundary-healthcare-summaries -- --write.");
    }
  }

  const summaries = summariesArtifact.summaries ?? {};
  const supportedBoundaryKeys = new Set(
    supportedBoundaries.map((boundary) => `${boundary.boundaryLevel}:${boundary.boundaryId}`)
  );
  const summaryKeys = new Set();

  for (const level of allowedLevels) {
    const levelSummaries = summaries[level];

    if (!isObject(levelSummaries)) {
      errors.push(`summaries.${level} must be an object.`);
      continue;
    }

    for (const [boundaryId, summary] of Object.entries(levelSummaries)) {
      const key = `${level}:${boundaryId}`;
      summaryKeys.add(key);
      validateSummaryShape(errors, summary, level, boundaryId);

      if (!supportedBoundaryKeys.has(key)) {
        errors.push(`${key} does not match a supported official boundary ID.`);
      }
    }
  }

  for (const key of collectAssignedBoundaryKeys(assignmentsArtifact)) {
    if (!summaryKeys.has(key)) {
      errors.push(`${key} has assigned facilities but no generated summary.`);
    }
  }

  if (errors.length > 0) {
    console.error("Boundary healthcare summary validation failed.");
    console.error("Please fix the following issues:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Boundary healthcare summary validation passed for ${summaryKeys.size} materialized summaries.`
  );
}

main().catch((error) => {
  console.error("Boundary healthcare summary validation failed.");
  console.error(error.message);
  process.exit(1);
});
