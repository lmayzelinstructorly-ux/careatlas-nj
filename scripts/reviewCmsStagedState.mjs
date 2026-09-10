import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isWithinStateBounds,
  loadStateBounds,
  normalizeStateCode
} from "./lib/stateBounds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultStagingPath = path.join(
  projectRoot, "public", "data", "healthcare", "staging", "facilities.staged.json"
);
const officialSourceName = "CMS Hospital General Information";
const officialSourceHost = "data.cms.gov";
const demoPattern = /(^|[^a-z])(demo|sample|test|placeholder|fake)([^a-z]|$)/i;

function parseArgs(argv) {
  const args = { file: defaultStagingPath, state: "", write: false };
  for (const arg of argv) {
    if (arg === "--write") args.write = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--state=")) args.state = normalizeStateCode(arg.slice(8));
    else if (arg.startsWith("--file=")) args.file = path.resolve(projectRoot, arg.slice(7));
    else throw new Error(`Unknown option "${arg}".`);
  }
  return args;
}

function printHelp() {
  console.log("Apply conservative, state-scoped review rules to staged official CMS hospital rows.");
  console.log("Usage: npm run review:cms-state -- --state=NJ [--write]");
  console.log("Rows with duplicates, blockers, missing identity/source data, or invalid coordinates are not approved.");
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function duplicateKey(facility) {
  return [facility?.name, facility?.address, facility?.city, facility?.state]
    .map((value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .join("|");
}

function sourceIsOfficial(record) {
  if (record?.sourceType !== "federal_open_data" || record?.sourceName !== officialSourceName) return false;
  if (!hasText(record?.facility?.sourceId)) return false;
  try {
    return new URL(record.facility.sourceInfo?.sourceUrl).hostname === officialSourceHost;
  } catch {
    return false;
  }
}

function reviewReasons(record, state, stateBounds, duplicateCounts) {
  const reasons = [];
  const facility = record?.facility;
  if (!facility || normalizeStateCode(record.state) !== state || normalizeStateCode(facility.state) !== state) {
    reasons.push("state mismatch");
  }
  if (!sourceIsOfficial(record)) reasons.push("official CMS source metadata is incomplete");
  if (facility?.facilityType !== "hospital") reasons.push("unexpected facility type for a CMS hospital row");
  for (const field of ["id", "name", "address", "city"]) {
    if (!hasText(facility?.[field])) reasons.push(`missing ${field}`);
  }
  if (
    !Number.isFinite(facility?.latitude) || !Number.isFinite(facility?.longitude) ||
    !isWithinStateBounds(facility?.latitude, facility?.longitude, stateBounds)
  ) reasons.push("coordinates are missing, invalid, or outside state bounds");
  if (
    hasText(facility?.sourceInfo?.notes) &&
    !/Census Bureau batch geocoder \((Exact|Non_Exact) address match\)/.test(facility.sourceInfo.notes)
  ) reasons.push("geocoding provenance note is missing");
  if (/rating|stars?\b/i.test(String(facility?.sourceInfo?.notes ?? "")) && !/ratings and measures were intentionally not copied/i.test(String(facility?.sourceInfo?.notes ?? ""))) {
    reasons.push("quality-rating content must not be imported");
  }
  if (facility?.isDemoData === true || facility?.verificationStatus === "demo" || demoPattern.test([
    facility?.id, facility?.name, record?.sourceFile
  ].filter(Boolean).join(" "))) reasons.push("record looks like demo/sample data");
  if ((duplicateCounts.get(duplicateKey(facility)) ?? 0) > 1) reasons.push("duplicate name/address group needs individual review");
  if (record?.stagingIssues?.some((issue) => issue?.severity === "blocker")) reasons.push("blocker staging issue remains");
  return [...new Set(reasons)];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.state) throw new Error("Missing --state=XX.");
  const records = JSON.parse(await readFile(args.file, "utf8"));
  if (!Array.isArray(records)) throw new Error("The staging file must contain a JSON array.");
  const stateRecords = records.filter(
    (record) =>
      normalizeStateCode(record?.state) === args.state &&
      record?.sourceName === officialSourceName
  );
  const duplicateCounts = new Map();
  for (const record of stateRecords) {
    const key = duplicateKey(record?.facility);
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }
  const stateBounds = await loadStateBounds(projectRoot, args.state);
  const reviewedAt = new Date().toISOString();
  const summary = { approved: 0, needsMoreSourceInfo: 0, reasons: {} };

  const nextRecords = records.map((record) => {
    if (
      normalizeStateCode(record?.state) !== args.state ||
      record?.sourceName !== officialSourceName
    ) return record;
    const reasons = reviewReasons(record, args.state, stateBounds, duplicateCounts);
    if (!reasons.length) {
      summary.approved += 1;
      return {
        ...record,
        stagingStatus: "approved",
        reviewNotes: "Official CMS source metadata, identity fields, state, Census-geocoded coordinates, and duplicate checks passed the conservative hospital import review.",
        reviewedAt
      };
    }
    summary.needsMoreSourceInfo += 1;
    for (const reason of reasons) summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1;
    return {
      ...record,
      stagingStatus: "needs_more_source_info",
      reviewNotes: `Not promoted automatically: ${reasons.join("; ")}.`,
      reviewedAt
    };
  });

  console.log(`Official CMS staged hospital review for ${args.state}`);
  console.log(`Rows reviewed: ${stateRecords.length}`);
  console.log(`Eligible for approval: ${summary.approved}`);
  console.log(`Held for more source information: ${summary.needsMoreSourceInfo}`);
  for (const [reason, count] of Object.entries(summary.reasons)) console.log(`- ${count}: ${reason}`);
  if (!args.write) return console.log("Dry run only. Staging was not changed.");
  await writeFile(args.file, `${JSON.stringify(nextRecords, null, 2)}\n`, "utf8");
  console.log("Wrote state-scoped review decisions to staging.");
}

main().catch((error) => {
  console.error("Official CMS staged hospital review failed.");
  console.error(error.message);
  process.exit(1);
});
