import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectEnrichmentProvenanceErrors } from "./lib/healthcareEnrichmentProvenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const stagingPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "staging",
  "facilities.staged.json"
);
const facilitiesPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
const promotionReportPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "staging",
  "latest-promotion-report.json"
);
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
const demoPattern = /(^|[^a-z])(demo|sample|test|placeholder|fake)([^a-z]|$)/i;

function parseArgs(argv) {
  const args = {
    allowDemoOutput: false,
    productionFile: facilitiesPath,
    reportFile: promotionReportPath,
    stagingFile: stagingPath,
    write: false
  };

  for (const arg of argv) {
    if (arg === "--write") {
      args.write = true;
    } else if (arg === "--allow-demo-output") {
      args.allowDemoOutput = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--staging-file=")) {
      args.stagingFile = path.resolve(projectRoot, arg.slice("--staging-file=".length));
    } else if (arg.startsWith("--production-file=")) {
      args.productionFile = path.resolve(projectRoot, arg.slice("--production-file=".length));
    } else if (arg.startsWith("--output=")) {
      args.productionFile = path.resolve(projectRoot, arg.slice("--output=".length));
    } else if (arg.startsWith("--report-file=")) {
      args.reportFile = path.resolve(projectRoot, arg.slice("--report-file=".length));
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  return args;
}

function printHelp() {
  console.log("Promote approved staged healthcare facilities into production data.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run promote:healthcare:staging");
  console.log("  npm run promote:healthcare:staging -- --write");
  console.log("  node scripts/promoteStagedHealthcareFacilities.mjs --staging-file=tmp/staged.json --production-file=tmp/facilities.json --write");
  console.log("");
  console.log("Without --write this is a dry run and facilities.json is not changed.");
}

async function readJsonArray(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
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

function hasSourceInfo(facility) {
  return hasText(facility?.sourceInfo?.sourceName) || hasText(facility?.sourceInfo?.sourceUrl);
}

function isDemoRecord(record) {
  const facility = record?.facility;

  return (
    facility?.isDemoData === true ||
    facility?.verificationStatus === "demo" ||
    demoPattern.test(
      [
        record?.stagingId,
        record?.sourceFile,
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

function collectPromotionBlockers(record, args) {
  const reasons = [];
  const facility = record?.facility;

  if (!facility || typeof facility !== "object") {
    return ["Record is missing a facility object."];
  }

  if (!hasText(facility.id)) {
    reasons.push("Facility ID is missing.");
  }

  if (!hasText(facility.name)) {
    reasons.push("Facility name is missing.");
  }

  if (!hasText(facility.address)) {
    reasons.push("Facility street address is missing.");
  }

  if (!hasText(facility.state)) {
    reasons.push("Facility state is missing.");
  }

  if (!allowedFacilityTypes.has(facility.facilityType)) {
    reasons.push(`Facility type "${facility.facilityType}" is invalid.`);
  }

  if (!allowedVerificationStatuses.has(facility.verificationStatus)) {
    reasons.push(`Verification status "${facility.verificationStatus}" is invalid.`);
  }

  if (!hasValidCoordinates(facility)) {
    reasons.push("Valid map coordinates are missing.");
  }

  if (!hasSourceInfo(facility)) {
    reasons.push("Source information is missing. Add sourceInfo.sourceName or sourceInfo.sourceUrl before approving production promotion.");
  }

  const provenanceErrors = collectEnrichmentProvenanceErrors(facility, {
    label: "Facility",
    requireSourceBacked: true
  });
  if (provenanceErrors.length > 0) {
    reasons.push(`Field-level enrichment source metadata is incomplete or still needs review: ${provenanceErrors.join(" ")}`);
  }

  if (isDemoRecord(record) && !args.allowDemoOutput) {
    reasons.push("Record looks like demo/sample data.");
  }

  const blockerIssues = Array.isArray(record.stagingIssues)
    ? record.stagingIssues.filter((issue) => issue?.severity === "blocker")
    : [];

  for (const issue of blockerIssues) {
    reasons.push(`Blocker staging issue remains: ${issue.code}.`);
  }

  if (
    Array.isArray(record.stagingIssues) &&
    record.stagingIssues.some((issue) =>
      [
        "missing_coordinates",
        "invalid_coordinates",
        "coordinates_outside_pilot_geography",
        "coordinates_outside_state_bounds",
        "state_mismatch"
      ].includes(issue?.code)
    )
  ) {
    reasons.push("Coordinate staging issue remains.");
  }

  return reasons;
}

function buildPromotionPlan(stagedRecords, productionFacilities, args) {
  const productionById = new Map(
    productionFacilities.map((facility) => [facility.id, facility])
  );
  const approvedRecords = [];
  const promotedFacilities = [];
  const skipped = [];
  const duplicateWarnings = [];
  const seenStagedFacilityIds = new Set();

  for (const record of stagedRecords) {
    const stagingId = record?.stagingId ?? "(missing stagingId)";
    const facilityId = record?.facility?.id ?? "";

    if (record?.stagingStatus !== "approved") {
      skipped.push({
        stagingId,
        facilityId,
        reason: `Status is "${record?.stagingStatus ?? "missing"}", not "approved".`
      });
      continue;
    }

    approvedRecords.push(record);

    const blockerReasons = collectPromotionBlockers(record, args);

    if (blockerReasons.length > 0) {
      skipped.push({
        stagingId,
        facilityId,
        reason: blockerReasons.join(" ")
      });
      continue;
    }

    if (seenStagedFacilityIds.has(record.facility.id)) {
      const warning = `Skipped approved staged record ${stagingId}; another approved staged record already uses id "${record.facility.id}".`;
      duplicateWarnings.push(warning);
      skipped.push({
        stagingId,
        facilityId: record.facility.id,
        reason: warning
      });
      continue;
    }

    if (productionById.has(record.facility.id)) {
      const warning = `Skipped approved staged record ${stagingId}; production already has id "${record.facility.id}".`;
      duplicateWarnings.push(warning);
      skipped.push({
        stagingId,
        facilityId: record.facility.id,
        reason: warning
      });
      continue;
    }

    seenStagedFacilityIds.add(record.facility.id);
    productionById.set(record.facility.id, record.facility);
    promotedFacilities.push(record.facility);
  }

  return {
    approvedRecords,
    duplicateWarnings,
    nextProductionFacilities: [...productionById.values()],
    promotedFacilities,
    skipped
  };
}

function buildReport(args, stagedRecords, productionFacilities, plan) {
  const timestamp = new Date().toISOString();

  return {
    promotionDate: timestamp,
    timestamp,
    dryRun: !args.write,
    stagingPath: path.relative(projectRoot, args.stagingFile).replace(/\\/g, "/"),
    productionPath: path.relative(projectRoot, args.productionFile).replace(/\\/g, "/"),
    stagedRecords: stagedRecords.length,
    approvedRecords: plan.approvedRecords.length,
    productionRecordsBefore: productionFacilities.length,
    recordsPromoted: plan.promotedFacilities.length,
    recordsSkipped: plan.skipped.length,
    productionRecordsAfter: plan.nextProductionFacilities.length,
    promotedFacilityIds: plan.promotedFacilities.map((facility) => facility.id),
    promotedIds: plan.promotedFacilities.map((facility) => facility.id),
    skipped: plan.skipped,
    skippedIds: plan.skipped.map((record) => record.stagingId),
    skipReasons: Object.fromEntries(
      plan.skipped.map((record) => [record.stagingId, record.reason])
    ),
    duplicateWarnings: plan.duplicateWarnings
  };
}

function printSummary(report) {
  console.log("Healthcare staging promotion summary");
  console.log("Production promotion requires approved, real, source-backed records with valid map coordinates.");
  console.log(`Production records before: ${report.productionRecordsBefore}`);
  console.log(`Production records after promotion: ${report.productionRecordsAfter}`);
  console.log(`Approved staged records: ${report.approvedRecords}`);
  console.log(`Records that would be promoted: ${report.recordsPromoted}`);
  console.log(`Records skipped: ${report.recordsSkipped}`);
  console.log(`Duplicate warnings: ${report.duplicateWarnings.length}`);

  if (report.promotedIds.length > 0) {
    console.log("Approved records that would be promoted:");
    for (const promotedId of report.promotedIds.slice(0, 20)) {
      console.log(`- ${promotedId}`);
    }
  }

  if (report.duplicateWarnings.length > 0) {
    for (const warning of report.duplicateWarnings.slice(0, 20)) {
      console.log(`- ${warning}`);
    }
  }

  if (report.skipped.length > 0) {
    console.log("Skipped records:");
    for (const skipped of report.skipped.slice(0, 20)) {
      console.log(`- ${skipped.stagingId}: ${skipped.reason}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (args.allowDemoOutput && args.productionFile === facilitiesPath) {
    throw new Error("--allow-demo-output can only be used with --production-file or --output pointing away from production facilities.json.");
  }

  const stagedRecords = await readJsonArray(args.stagingFile);
  const productionFacilities = await readJsonArray(args.productionFile);
  const plan = buildPromotionPlan(stagedRecords, productionFacilities, args);
  const report = buildReport(args, stagedRecords, productionFacilities, plan);

  printSummary(report);

  if (!args.write) {
    console.log("");
    console.log("Dry run only. facilities.json was not changed.");
    console.log("Add --write to promote approved staged records, then run npm run validate:healthcare.");
    return;
  }

  await mkdir(path.dirname(args.productionFile), { recursive: true });
  await writeFile(args.productionFile, `${JSON.stringify(plan.nextProductionFacilities, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(args.reportFile), { recursive: true });
  await writeFile(args.reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("");
  console.log(`Promoted ${plan.promotedFacilities.length} records to ${path.relative(projectRoot, args.productionFile).replace(/\\/g, "/")}.`);
  console.log(`Wrote promotion report to ${path.relative(projectRoot, args.reportFile).replace(/\\/g, "/")}.`);
  console.log("Next: run npm run validate:healthcare, npm run check:healthcare-pipeline, npm run check, and npm run build.");
}

main().catch((error) => {
  console.error("Healthcare staging promotion failed.");
  console.error(error.message);
  process.exit(1);
});
