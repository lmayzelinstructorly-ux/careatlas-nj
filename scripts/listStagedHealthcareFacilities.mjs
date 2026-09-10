import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const allowedStatuses = new Set([
  "pending_review",
  "approved",
  "rejected",
  "needs_more_source_info"
]);

function parseArgs(argv) {
  const args = {
    duplicates: false,
    file: defaultStagingPath,
    missingCoordinates: false,
    state: "",
    status: ""
  };

  for (const arg of argv) {
    if (arg === "--duplicates") {
      args.duplicates = true;
    } else if (arg === "--missing-coordinates") {
      args.missingCoordinates = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--status=")) {
      args.status = arg.slice("--status=".length).trim();
    } else if (arg.startsWith("--state=")) {
      args.state = arg.slice("--state=".length).trim().toUpperCase();
    } else if (arg.startsWith("--file=")) {
      args.file = path.resolve(projectRoot, arg.slice("--file=".length));
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  return args;
}

function printHelp() {
  console.log("List staged healthcare facility records.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run list:healthcare:staging");
  console.log("  npm run list:healthcare:staging -- --status=pending_review");
  console.log("  npm run list:healthcare:staging -- --state=PA");
  console.log("  npm run list:healthcare:staging -- --missing-coordinates");
  console.log("  npm run list:healthcare:staging -- --duplicates");
}

async function readJsonArray(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${path.relative(projectRoot, filePath)} must contain a JSON array.`);
  }

  return parsed;
}

function hasIssue(record, code) {
  return Array.isArray(record?.stagingIssues)
    ? record.stagingIssues.some((issue) => issue?.code === code)
    : false;
}

function hasValidCoordinates(record) {
  const facility = record?.facility;

  return (
    typeof facility?.latitude === "number" &&
    Number.isFinite(facility.latitude) &&
    facility.latitude >= -90 &&
    facility.latitude <= 90 &&
    typeof facility?.longitude === "number" &&
    Number.isFinite(facility.longitude) &&
    facility.longitude >= -180 &&
    facility.longitude <= 180
  );
}

function hasDuplicateWarning(record) {
  return Boolean(record?.duplicateWarning) || hasIssue(record, "possible_duplicate");
}

function issueCount(record) {
  return Array.isArray(record?.stagingIssues) ? record.stagingIssues.length : 0;
}

function matchesFilters(record, args) {
  if (args.state && String(record?.state ?? record?.facility?.state ?? "").toUpperCase() !== args.state) {
    return false;
  }

  if (args.status && record?.stagingStatus !== args.status) {
    return false;
  }

  if (args.missingCoordinates && hasValidCoordinates(record)) {
    return false;
  }

  if (args.duplicates && !hasDuplicateWarning(record)) {
    return false;
  }

  return true;
}

function formatLocation(facility) {
  return [facility?.city, facility?.state].filter(Boolean).join(", ") || "-";
}

function truncate(value, maxLength) {
  const text = String(value ?? "-");

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function printTable(records) {
  const rows = records.map((record) => ({
    id: record?.stagingId ?? "-",
    name: record?.facility?.name ?? "-",
    location: formatLocation(record?.facility),
    status: record?.stagingStatus ?? "-",
    issues: String(issueCount(record)),
    missingCoordinates: hasValidCoordinates(record) ? "no" : "yes",
    duplicate: hasDuplicateWarning(record) ? "yes" : "no",
    sourceFile: record?.sourceFile ?? "-"
  }));
  const columns = [
    ["id", "Staged ID", 34],
    ["name", "Facility", 30],
    ["location", "City/State", 18],
    ["status", "Status", 23],
    ["issues", "Issues", 6],
    ["missingCoordinates", "Missing coords", 14],
    ["duplicate", "Duplicate", 9],
    ["sourceFile", "Source file", 38]
  ];
  const header = columns
    .map(([, label, width]) => label.padEnd(width))
    .join("  ");

  console.log(header);
  console.log(columns.map(([, , width]) => "-".repeat(width)).join("  "));

  for (const row of rows) {
    console.log(
      columns
        .map(([key, , width]) => truncate(row[key], width).padEnd(width))
        .join("  ")
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (args.status && !allowedStatuses.has(args.status)) {
    console.error(`Invalid --status "${args.status}".`);
    console.error(`Allowed statuses: ${[...allowedStatuses].join(", ")}`);
    process.exit(1);
  }

  const records = await readJsonArray(args.file);
  const filtered = records.filter((record) => matchesFilters(record, args));

  console.log("Healthcare staged records");
  console.log(`File: ${path.relative(projectRoot, args.file).replace(/\\/g, "/")}`);
  console.log(`Records shown: ${filtered.length} of ${records.length}`);

  if (filtered.length === 0) {
    console.log("No staged healthcare records match the current filters.");
    return;
  }

  console.log("");
  printTable(filtered);
}

main().catch((error) => {
  console.error("Healthcare staging list failed.");
  console.error(error.message);
  process.exit(1);
});
