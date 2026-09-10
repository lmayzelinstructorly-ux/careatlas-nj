import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectEnrichmentProvenanceErrors
} from "./lib/healthcareEnrichmentProvenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultStagingPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "staging",
  "facilities.staged.json"
);

const allowedStagingStatuses = new Set([
  "pending_review",
  "approved",
  "rejected",
  "needs_more_source_info"
]);
const allowedIssueCodes = new Set([
  "missing_name",
  "missing_address",
  "missing_coordinates",
  "invalid_coordinates",
  "coordinates_outside_pilot_geography",
  "coordinates_outside_state_bounds",
  "state_mismatch",
  "missing_source_information",
  "unknown_price_info",
  "unknown_insurance_info",
  "unknown_hours",
  "possible_duplicate",
  "manual_review_issue",
  "demo_looking_record",
  "invalid_facility_type",
  "invalid_verification_status",
  "unmapped_source_fields",
  "invalid_field_sources",
  "enrichment_needs_review"
]);
const allowedIssueSeverities = new Set(["info", "warning", "blocker"]);
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
const allowedVerificationStatuses = new Set([
  "verified",
  "needs_review",
  "unverified",
  "demo"
]);
const allowedSourceTypes = new Set([
  "official",
  "hospital_system",
  "state_open_data",
  "federal_open_data",
  "manually_collected",
  "unknown"
]);
const blockerIssueCodes = new Set([
  "missing_name",
  "missing_address",
  "invalid_coordinates",
  "coordinates_outside_pilot_geography",
  "coordinates_outside_state_bounds",
  "state_mismatch",
  "demo_looking_record",
  "invalid_facility_type",
  "invalid_verification_status",
  "invalid_field_sources",
  "enrichment_needs_review"
]);
const demoPattern = /(^|[^a-z])(demo|sample|test|placeholder|fake)([^a-z]|$)/i;

function parseArgs(argv) {
  const args = {
    allowApprovedDemo: false,
    inputPath: defaultStagingPath
  };

  for (const arg of argv) {
    if (arg === "--allow-approved-demo") {
      args.allowApprovedDemo = true;
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
  console.log("Validate staged healthcare facility records.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run validate:healthcare:staging");
  console.log("  node scripts/validateHealthcareStaging.mjs public/data/healthcare/staging/facilities.staged.json");
  console.log("  node scripts/validateHealthcareStaging.mjs --file=public/data/healthcare/staging/facilities.staged.json");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidCoordinates(facility) {
  return (
    typeof facility.latitude === "number" &&
    Number.isFinite(facility.latitude) &&
    facility.latitude >= -90 &&
    facility.latitude <= 90 &&
    typeof facility.longitude === "number" &&
    Number.isFinite(facility.longitude) &&
    facility.longitude >= -180 &&
    facility.longitude <= 180
  );
}

function isDemoRecord(record) {
  const facility = record.facility;

  return (
    facility?.isDemoData === true ||
    facility?.verificationStatus === "demo" ||
    demoPattern.test(
      [
        record.stagingId,
        record.sourceFile,
        facility?.id,
        facility?.name,
        facility?.sourceDataset,
        facility?.sourceInfo?.sourceName,
        facility?.sourceInfo?.notes
      ]
        .filter(Boolean)
        .join(" ")
    )
  );
}

function validateIssue(errors, issue, label, issueIndex) {
  if (!isObject(issue)) {
    errors.push(`${label} issue ${issueIndex + 1} must be an object.`);
    return;
  }

  if (!allowedIssueCodes.has(issue.code)) {
    errors.push(`${label} issue ${issueIndex + 1} has invalid code "${issue.code}".`);
  }

  if (!hasText(issue.field)) {
    errors.push(`${label} issue ${issueIndex + 1} needs a field value.`);
  }

  if (!hasText(issue.message)) {
    errors.push(`${label} issue ${issueIndex + 1} needs a message.`);
  }

  if (!allowedIssueSeverities.has(issue.severity)) {
    errors.push(`${label} issue ${issueIndex + 1} has invalid severity "${issue.severity}".`);
  }
}

function validateFacility(errors, facility, label) {
  if (!isObject(facility)) {
    errors.push(`${label} facility must be an object.`);
    return;
  }

  for (const field of ["id", "state"]) {
    if (!hasText(facility[field])) {
      errors.push(`${label} facility needs a ${field} value.`);
    }
  }

  if (!allowedFacilityTypes.has(facility.facilityType)) {
    errors.push(`${label} facility has invalid facilityType "${facility.facilityType}".`);
  }

  if (!allowedVerificationStatuses.has(facility.verificationStatus)) {
    errors.push(`${label} facility has invalid verificationStatus "${facility.verificationStatus}".`);
  }

  if (!Array.isArray(facility.services)) {
    errors.push(`${label} facility services must be an array.`);
  }

  if (!isObject(facility.hours)) {
    errors.push(`${label} facility hours must be an object.`);
  }

  if (!isObject(facility.priceInfo)) {
    errors.push(`${label} facility priceInfo must be an object.`);
  }

  if (!isObject(facility.insuranceInfo)) {
    errors.push(`${label} facility insuranceInfo must be an object.`);
  }

  errors.push(
    ...collectEnrichmentProvenanceErrors(facility, {
      label: `${label} facility`,
      requireSourceBacked: false
    })
  );

  const hasLatitude = facility.latitude !== undefined && facility.latitude !== null;
  const hasLongitude = facility.longitude !== undefined && facility.longitude !== null;

  if (hasLatitude !== hasLongitude) {
    errors.push(`${label} facility should include both latitude and longitude, or leave both blank.`);
  }

  if ((hasLatitude || hasLongitude) && !hasValidCoordinates(facility)) {
    errors.push(`${label} facility coordinates are invalid.`);
  }
}

function validateRecord(record, index, seenStagingIds, args) {
  const errors = [];
  const label = `staged record ${index + 1}`;

  if (!isObject(record)) {
    return [`${label} must be an object.`];
  }

  if (!hasText(record.stagingId)) {
    errors.push(`${label} needs a stagingId.`);
  } else if (seenStagingIds.has(record.stagingId)) {
    errors.push(`${label} uses duplicate stagingId "${record.stagingId}".`);
  } else {
    seenStagingIds.add(record.stagingId);
  }

  if (!allowedStagingStatuses.has(record.stagingStatus)) {
    errors.push(`${label} has invalid stagingStatus "${record.stagingStatus}".`);
  }

  if (!Array.isArray(record.stagingIssues)) {
    errors.push(`${label} stagingIssues must be an array.`);
  } else {
    record.stagingIssues.forEach((issue, issueIndex) =>
      validateIssue(errors, issue, label, issueIndex)
    );
  }

  for (const field of ["sourceFile", "sourceName", "state", "importDate"]) {
    if (!hasText(record[field])) {
      errors.push(`${label} needs ${field}.`);
    }
  }

  if (!allowedSourceTypes.has(record.sourceType)) {
    errors.push(`${label} has invalid sourceType "${record.sourceType}".`);
  }

  validateFacility(errors, record.facility, label);

  const issueCodes = new Set(
    Array.isArray(record.stagingIssues)
      ? record.stagingIssues.map((issue) => issue.code)
      : []
  );

  if (
    record.stagingStatus === "approved" &&
    [...blockerIssueCodes].some((code) => issueCodes.has(code))
  ) {
    errors.push(`${label} is approved but still has blocker staging issues.`);
  }

  if (record.stagingStatus === "approved" && !hasText(record.facility?.name)) {
    errors.push(`${label} is approved but is missing a facility name.`);
  }

  if (record.stagingStatus === "approved" && !hasValidCoordinates(record.facility)) {
    errors.push(`${label} is approved for map display but has missing or invalid coordinates.`);
  }

  if (
    record.stagingStatus === "approved" &&
    isObject(record.facility?.fieldSources) &&
    Object.values(record.facility.fieldSources).some(
      (source) => !isObject(source) || source.status !== "source_backed"
    )
  ) {
    errors.push(`${label} is approved but field-level enrichment source metadata is incomplete or needs review.`);
  }

  if (record.stagingStatus === "approved") {
    errors.push(
      ...collectEnrichmentProvenanceErrors(record.facility, {
        label: `${label} approved facility`,
        requireSourceBacked: true
      })
    );
  }

  if (record.stagingStatus === "approved" && isDemoRecord(record) && !args.allowApprovedDemo) {
    errors.push(`${label} looks like demo/sample data and cannot be approved for production.`);
  }

  return errors;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  let parsed;

  try {
    const raw = await readFile(args.inputPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("Healthcare staging validation failed.");
    console.error(`Could not read valid JSON from ${path.relative(projectRoot, args.inputPath)}.`);
    console.error(`Details: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(parsed)) {
    console.error("Healthcare staging validation failed.");
    console.error(`${path.relative(projectRoot, args.inputPath)} must contain a JSON array.`);
    process.exit(1);
  }

  const seenStagingIds = new Set();
  const errors = parsed.flatMap((record, index) =>
    validateRecord(record, index, seenStagingIds, args)
  );

  if (errors.length > 0) {
    console.error("Healthcare staging validation failed.");
    console.error("Please fix the following issues:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Healthcare staging validation passed for ${parsed.length} staged records.`);
}

main().catch((error) => {
  console.error("Healthcare staging validation failed.");
  console.error(error.message);
  process.exit(1);
});
