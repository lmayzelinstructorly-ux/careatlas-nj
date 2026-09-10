import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const defaultFile = path.join(
  root,
  "public/data/doctor-offices/staging/unmatched-geocodes.review.json"
);
const allowedStatuses = new Set([
  "pending",
  "source_address_confirmed",
  "source_correction_needed",
  "resolved_in_new_release",
  "unresolved"
]);

function parseArgs(argv) {
  const args = { file: defaultFile, limit: 20 };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--file=")) args.file = path.resolve(root, arg.slice(7));
    else if (arg.startsWith("--id=")) args.id = arg.slice(5);
    else if (arg.startsWith("--status=")) args.status = arg.slice(9);
    else if (arg.startsWith("--notes=")) args.notes = arg.slice(8);
    else if (arg.startsWith("--evidence-url=")) args.evidenceUrl = arg.slice(15);
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.slice(8));
    else throw new Error(`Unknown option ${arg}.`);
  }
  return args;
}

function printHelp() {
  console.log("List or annotate the ignored doctor-office geocode review queue.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run review:doctor-office-geocodes");
  console.log("  npm run review:doctor-office-geocodes -- --id=<id>");
  console.log("  npm run review:doctor-office-geocodes -- --id=<id> --status=source_address_confirmed --evidence-url=<official-url> --notes=<text>");
  console.log("");
  console.log(`Statuses: ${[...allowedStatuses].join(", ")}`);
  console.log("Review annotations never add coordinates or publish a record.");
}

function formatAddress(record) {
  const address = record.sourceAddress;
  return [
    address.addressLine1,
    address.addressLine2,
    `${address.city}, ${address.state} ${address.postalCode}`
  ].filter(Boolean).join(", ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!Number.isInteger(args.limit) || args.limit < 1) {
    throw new Error("--limit must be a positive integer.");
  }

  const packet = JSON.parse(await readFile(args.file, "utf8"));
  if (!Array.isArray(packet.records)) throw new Error("Review packet is invalid.");
  const counts = Object.fromEntries(
    [...allowedStatuses].map((status) => [
      status,
      packet.records.filter((record) => record.review?.status === status).length
    ])
  );

  if (!args.id) {
    console.log(`Doctor-office unmatched-geocode review: ${packet.records.length} records.`);
    console.log(`Status counts: ${JSON.stringify(counts)}.`);
    for (const record of packet.records.slice(0, args.limit)) {
      console.log(`${record.id} | ${record.review.status} | ${formatAddress(record)} | ${record.displayName}`);
    }
    return;
  }

  const record = packet.records.find(({ id }) => id === args.id);
  if (!record) throw new Error(`No review record found for ${args.id}.`);
  if (!args.status && args.notes === undefined && args.evidenceUrl === undefined) {
    console.log(JSON.stringify(record, null, 2));
    return;
  }
  if (!allowedStatuses.has(args.status)) {
    throw new Error(`--status must be one of ${[...allowedStatuses].join(", ")}.`);
  }
  if (
    !["pending", "unresolved"].includes(args.status) &&
    !args.evidenceUrl &&
    !record.review?.evidenceUrl
  ) {
    throw new Error("An official --evidence-url is required for this review status.");
  }

  record.review = {
    evidenceUrl: args.evidenceUrl ?? record.review?.evidenceUrl ?? null,
    notes: args.notes ?? record.review?.notes ?? null,
    reviewedAt: new Date().toISOString().slice(0, 10),
    status: args.status
  };
  await writeFile(args.file, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  console.log(`Updated ${record.id} to ${record.review.status}.`);
  console.log("This annotation does not publish coordinates; re-import from official sources to resolve the record.");
}

main().catch((error) => {
  console.error(`Doctor-office geocode review failed: ${error.message}`);
  process.exit(1);
});
