import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectEnrichmentProvenanceErrors
} from "./lib/healthcareEnrichmentProvenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const facilitiesPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
function parseArgs(argv) {
  const args = {
    allowDemo: false,
    inputPath: facilitiesPath
  };

  for (const arg of argv) {
    if (arg === "--allow-demo") {
      args.allowDemo = true;
    } else if (arg === "--help" || arg === "-h") {
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
  console.log("Validate healthcare facility JSON data.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run validate:healthcare");
  console.log("  node scripts/validateHealthcareFacilities.mjs public/data/healthcare/facilities.demo.json --allow-demo");
  console.log("  node scripts/validateHealthcareFacilities.mjs --file=public/data/healthcare/facilities.demo.json --allow-demo");
  console.log("");
  console.log("The default production facilities.json file cannot contain demo records.");
}

const allowedFacilityTypes = new Set([
  "hospital",
  "clinic",
  "urgent_care",
  "community_health_center",
  "pharmacy",
  "mental_health",
  "dental",
  "other"
]);

const allowedPriceLevels = new Set([
  "free",
  "low_cost",
  "standard",
  "unknown"
]);

const allowedVerificationStatuses = new Set([
  "verified",
  "needs_review",
  "unverified",
  "demo"
]);
const mainlandUsBounds = {
  minLatitude: 24,
  maxLatitude: 50,
  minLongitude: -125,
  maxLongitude: -66
};

function facilityLabel(facility, index) {
  if (facility && typeof facility === "object" && "id" in facility) {
    return `facility ${index + 1} (${facility.id || "blank id"})`;
  }

  return `facility ${index + 1}`;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireText(errors, label, facility, fieldName) {
  if (!hasText(facility[fieldName])) {
    errors.push(`${label} needs a ${fieldName} value.`);
  }
}

function validateCoordinates(errors, label, facility) {
  const hasLatitude = facility.latitude !== undefined && facility.latitude !== null;
  const hasLongitude =
    facility.longitude !== undefined && facility.longitude !== null;

  if (hasLatitude !== hasLongitude) {
    errors.push(
      `${label} should include both latitude and longitude, or leave both blank until the location is ready.`
    );
    return;
  }

  if (!hasLatitude && !hasLongitude) {
    return;
  }

  if (typeof facility.latitude !== "number" || Number.isNaN(facility.latitude)) {
    errors.push(`${label} latitude must be a number.`);
  } else if (
    facility.latitude < mainlandUsBounds.minLatitude ||
    facility.latitude > mainlandUsBounds.maxLatitude
  ) {
    errors.push(
      `${label} latitude should be within the mainland U.S. range, roughly ${mainlandUsBounds.minLatitude} to ${mainlandUsBounds.maxLatitude}.`
    );
  }

  if (
    typeof facility.longitude !== "number" ||
    Number.isNaN(facility.longitude)
  ) {
    errors.push(`${label} longitude must be a number.`);
  } else if (
    facility.longitude < mainlandUsBounds.minLongitude ||
    facility.longitude > mainlandUsBounds.maxLongitude
  ) {
    errors.push(
      `${label} longitude should be within the mainland U.S. range, roughly ${mainlandUsBounds.minLongitude} to ${mainlandUsBounds.maxLongitude}.`
    );
  }
}

function validateSourceInfo(errors, label, facility) {
  if (facility.sourceInfo !== undefined && !isObject(facility.sourceInfo)) {
    errors.push(`${label} sourceInfo must be an object when provided.`);
    return;
  }

  if (facility.verificationStatus !== "verified") {
    return;
  }

  if (!isObject(facility.sourceInfo)) {
    errors.push(
      `${label} is marked verified, so it needs sourceInfo with sourceName, sourceUrl and lastChecked.`
    );
    return;
  }

  if (!hasText(facility.sourceInfo.sourceName)) {
    errors.push(`${label} is marked verified, so sourceInfo.sourceName is required.`);
  }

  if (!hasText(facility.sourceInfo.sourceUrl)) {
    errors.push(`${label} is marked verified, so sourceInfo.sourceUrl is required when available.`);
  }

  if (!hasText(facility.sourceInfo.lastChecked)) {
    errors.push(`${label} is marked verified, so sourceInfo.lastChecked is required.`);
  }
}

function validateFieldSources(errors, label, facility) {
  errors.push(
    ...collectEnrichmentProvenanceErrors(facility, {
      label,
      requireSourceBacked: true
    })
  );
}

function validateOptionalText(errors, label, facility, fieldName) {
  if (
    facility[fieldName] !== undefined &&
    facility[fieldName] !== null &&
    typeof facility[fieldName] !== "string"
  ) {
    errors.push(`${label} ${fieldName} must be text when provided.`);
  }
}

function validateOptionalBoolean(errors, label, facility, fieldName) {
  if (
    facility[fieldName] !== undefined &&
    facility[fieldName] !== null &&
    typeof facility[fieldName] !== "boolean"
  ) {
    errors.push(`${label} ${fieldName} must be true or false when provided.`);
  }
}

function validateFacility(facility, index, seenIds) {
  const errors = [];
  const label = facilityLabel(facility, index);

  if (!isObject(facility)) {
    return [`${label} must be an object.`];
  }

  requireText(errors, label, facility, "id");
  requireText(errors, label, facility, "name");
  requireText(errors, label, facility, "city");
  requireText(errors, label, facility, "state");

  if (hasText(facility.id)) {
    if (seenIds.has(facility.id)) {
      errors.push(`${label} uses duplicate id "${facility.id}". Each id must be unique.`);
    }

    seenIds.add(facility.id);
  }

  if (!hasText(facility.facilityType)) {
    errors.push(
      `${label} needs a facilityType value. Use one of: ${[
        ...allowedFacilityTypes
      ].join(", ")}.`
    );
  } else if (!allowedFacilityTypes.has(facility.facilityType)) {
    errors.push(
      `${label} has unknown facilityType "${facility.facilityType}". Use one of: ${[
        ...allowedFacilityTypes
      ].join(", ")}.`
    );
  }

  validateCoordinates(errors, label, facility);
  validateOptionalText(errors, label, facility, "sourceId");
  validateOptionalText(errors, label, facility, "sourceDataset");
  validateOptionalText(errors, label, facility, "sourceLastUpdated");
  validateOptionalText(errors, label, facility, "importDate");
  validateOptionalText(errors, label, facility, "dataCompletenessNotes");
  validateOptionalBoolean(errors, label, facility, "isDemoData");

  const priceLevel = facility.priceInfo?.priceLevel;
  if (priceLevel !== undefined && !allowedPriceLevels.has(priceLevel)) {
    errors.push(
      `${label} has unknown priceInfo.priceLevel "${priceLevel}". Use one of: ${[
        ...allowedPriceLevels
      ].join(", ")}.`
    );
  }

  const verificationStatus = facility.verificationStatus;
  if (!hasText(verificationStatus)) {
    errors.push(
      `${label} needs a verificationStatus value. Use one of: ${[
        ...allowedVerificationStatuses
      ].join(", ")}.`
    );
  } else if (!allowedVerificationStatuses.has(verificationStatus)) {
    errors.push(
      `${label} has unknown verificationStatus "${verificationStatus}". Use one of: ${[
        ...allowedVerificationStatuses
      ].join(", ")}.`
    );
  }

  validateSourceInfo(errors, label, facility);
  validateFieldSources(errors, label, facility);

  return errors;
}

function isDemoRecord(facility) {
  return (
    isObject(facility) &&
    (facility.isDemoData === true || facility.verificationStatus === "demo")
  );
}

function isDemoLookingProductionRecord(facility) {
  if (!isObject(facility)) {
    return false;
  }

  return /(^|[^a-z])(demo|sample|test|placeholder|fake)([^a-z]|$)/i.test(
    [
      facility.id,
      facility.name,
      facility.sourceDataset,
      facility.sourceInfo?.sourceName,
      facility.sourceInfo?.notes,
      facility.dataCompletenessNotes
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function isSourceBackedFacility(facility) {
  return (
    isObject(facility) &&
    isObject(facility.sourceInfo) &&
    (hasText(facility.sourceInfo.sourceName) || hasText(facility.sourceInfo.sourceUrl))
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.inputPath;
  const isProductionFacilitiesFile = inputPath === facilitiesPath;
  let parsed;

  if (args.help) {
    printHelp();
    return;
  }

  try {
    const raw = await readFile(inputPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("Healthcare facility validation failed.");
    console.error(
      `Could not read valid JSON from ${path.relative(projectRoot, inputPath)}.`
    );
    console.error(`Details: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(parsed)) {
    console.error("Healthcare facility validation failed.");
    console.error(
      `${path.relative(projectRoot, inputPath)} must contain a JSON array.`
    );
    process.exit(1);
  }

  const seenIds = new Set();
  const errors = parsed.flatMap((facility, index) =>
    validateFacility(facility, index, seenIds)
  );
  const demoRecordCount = parsed.filter(isDemoRecord).length;
  const demoLookingRecordCount = parsed.filter(isDemoLookingProductionRecord).length;

  if (isProductionFacilitiesFile) {
    parsed.forEach((facility, index) => {
      if (!isSourceBackedFacility(facility)) {
        errors.push(
          `${facilityLabel(facility, index)} is in production facilities.json, so it needs sourceInfo.sourceName or sourceInfo.sourceUrl. Keep records in staging until a source backs them.`
        );
      }
    });
  }

  if (isProductionFacilitiesFile && demoRecordCount > 0) {
    errors.push(
      "Production facilities.json should not contain demo healthcare records. Move demo records to facilities.demo.json or facilities.sample.json."
    );
  } else if (isProductionFacilitiesFile && demoLookingRecordCount > 0) {
    errors.push(
      "Production facilities.json appears to contain demo/sample-looking healthcare records. Move demo records to facilities.demo.json or facilities.sample.json."
    );
  } else if (demoRecordCount > 0 && !args.allowDemo) {
    console.warn(
      `Warning: ${path.relative(projectRoot, inputPath)} contains ${demoRecordCount} demo healthcare record${demoRecordCount === 1 ? "" : "s"}.`
    );
  }

  if (errors.length > 0) {
    console.error("Healthcare facility validation failed.");
    console.error("Please fix the following issues:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Healthcare facility validation passed for ${parsed.length} facilities.`
  );
}

main();
