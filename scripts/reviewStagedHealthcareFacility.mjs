import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectEnrichmentProvenanceErrors } from "./lib/healthcareEnrichmentProvenance.mjs";

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
    clearIssues: false,
    file: defaultStagingPath,
    id: "",
    issue: "",
    notes: undefined,
    status: "",
    write: false
  };

  for (const arg of argv) {
    if (arg === "--write") {
      args.write = true;
    } else if (arg === "--clear-issues") {
      args.clearIssues = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--id=")) {
      args.id = arg.slice("--id=".length).trim();
    } else if (arg.startsWith("--status=")) {
      args.status = arg.slice("--status=".length).trim();
    } else if (arg.startsWith("--notes=")) {
      args.notes = arg.slice("--notes=".length).trim();
    } else if (arg.startsWith("--issue=")) {
      args.issue = arg.slice("--issue=".length).trim();
    } else if (arg.startsWith("--file=")) {
      args.file = path.resolve(projectRoot, arg.slice("--file=".length));
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  return args;
}

function printUsage() {
  console.log("Review one staged healthcare facility record.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run review:healthcare:staged -- --id=staged-123 --status=approved --notes=\"Source checked\"");
  console.log("  npm run review:healthcare:staged -- --id=staged-123 --status=approved --notes=\"Source checked\" --write");
  console.log("");
  console.log("Options:");
  console.log("  --id=<stagedRecordId>                 Required staged record ID.");
  console.log("  --status=approved|rejected|needs_more_source_info|pending_review");
  console.log("  --notes=\"review notes\"               Optional reviewer notes.");
  console.log("  --issue=\"optional issue text\"        Appends a manual review issue.");
  console.log("  --clear-issues                        Clears existing staging issues.");
  console.log("  --file=public/data/healthcare/staging/facilities.staged.json");
  console.log("  --write                               Save changes. Omit for dry run.");
}

async function readJsonArray(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${path.relative(projectRoot, filePath)} must contain a JSON array.`);
  }

  return parsed;
}

function getRecordName(record) {
  return record?.facility?.name || "(unnamed facility)";
}

function printAvailableRecords(records) {
  if (records.length === 0) {
    console.log("No staged records are currently available.");
    return;
  }

  console.log("Available staged record IDs:");
  for (const record of records.slice(0, 50)) {
    console.log(`- ${record.stagingId}: ${getRecordName(record)}`);
  }

  if (records.length > 50) {
    console.log(`...and ${records.length - 50} more records.`);
  }
}

function createManualIssue(message) {
  return {
    code: "manual_review_issue",
    field: "review",
    message,
    severity: "warning"
  };
}

function applyReview(record, args) {
  const nextRecord = structuredClone(record);
  const reviewedAt = new Date().toISOString();

  nextRecord.stagingStatus = args.status;

  if (args.notes !== undefined) {
    nextRecord.reviewerNotes = args.notes;
  }

  if (args.clearIssues) {
    nextRecord.stagingIssues = [];
  } else if (!Array.isArray(nextRecord.stagingIssues)) {
    nextRecord.stagingIssues = [];
  }

  if (args.issue) {
    nextRecord.stagingIssues.push(createManualIssue(args.issue));
  }

  nextRecord.reviewedAt = reviewedAt;
  nextRecord.review = {
    ...(nextRecord.review ?? {}),
    ...(args.notes !== undefined ? { reviewerNotes: args.notes } : {}),
    reviewedDate: reviewedAt
  };

  return nextRecord;
}

function buildChangeSummary(beforeRecord, afterRecord) {
  const changes = [];

  if (beforeRecord.stagingStatus !== afterRecord.stagingStatus) {
    changes.push(`stagingStatus: ${beforeRecord.stagingStatus} -> ${afterRecord.stagingStatus}`);
  }

  if (beforeRecord.reviewerNotes !== afterRecord.reviewerNotes) {
    changes.push("reviewerNotes would be updated.");
  }

  if ((beforeRecord.stagingIssues?.length ?? 0) !== afterRecord.stagingIssues.length) {
    changes.push(
      `stagingIssues count: ${beforeRecord.stagingIssues?.length ?? 0} -> ${afterRecord.stagingIssues.length}`
    );
  }

  if (beforeRecord.reviewedAt !== afterRecord.reviewedAt) {
    changes.push("reviewedAt would be updated.");
  }

  return changes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.id) {
    printUsage();
    process.exit(1);
  }

  if (!args.status) {
    console.error("Missing --status.");
    console.error(`Allowed statuses: ${[...allowedStatuses].join(", ")}`);
    process.exit(1);
  }

  if (!allowedStatuses.has(args.status)) {
    console.error(`Invalid --status "${args.status}".`);
    console.error(`Allowed statuses: ${[...allowedStatuses].join(", ")}`);
    process.exit(1);
  }

  const records = await readJsonArray(args.file);
  const recordIndex = records.findIndex((record) => record?.stagingId === args.id);

  if (recordIndex === -1) {
    console.error(`Staged record ID "${args.id}" was not found.`);
    printAvailableRecords(records);
    process.exit(1);
  }

  const currentRecord = records[recordIndex];
  const nextRecord = applyReview(currentRecord, args);
  const approvalProvenanceErrors =
    nextRecord.stagingStatus === "approved"
      ? collectEnrichmentProvenanceErrors(nextRecord.facility, {
          label: `staged record ${args.id}`,
          requireSourceBacked: true
        })
      : [];
  const changes = buildChangeSummary(currentRecord, nextRecord);

  console.log("Current staged record:");
  console.log(JSON.stringify(currentRecord, null, 2));
  console.log("");
  console.log("Proposed reviewed record:");
  console.log(JSON.stringify(nextRecord, null, 2));
  console.log("");
  console.log("Changes:");
  for (const change of changes) {
    console.log(`- ${change}`);
  }

  if (approvalProvenanceErrors.length > 0) {
    console.error("");
    console.error("Cannot approve this staged record yet.");
    console.error("Field-level enrichment provenance is incomplete:");
    for (const error of approvalProvenanceErrors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  if (!args.write) {
    console.log("");
    console.log("Dry run only. facilities.staged.json was not changed.");
    console.log("Add --write to save this review update.");
    return;
  }

  records[recordIndex] = nextRecord;
  await writeFile(args.file, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  console.log("");
  console.log(`Updated staged record ${args.id}.`);
}

main().catch((error) => {
  console.error("Healthcare staging review failed.");
  console.error(error.message);
  process.exit(1);
});
