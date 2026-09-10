import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const defaultFacilitiesPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);

function parseArgs(argv) {
  const args = { input: "", facilities: defaultFacilitiesPath, write: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--write") args.write = true;
    else if (arg.startsWith("--input=")) args.input = path.resolve(projectRoot, arg.slice(8));
    else if (arg.startsWith("--facilities=")) {
      args.facilities = path.resolve(projectRoot, arg.slice(13));
    } else throw new Error(`Unknown option "${arg}".`);
  }
  return args;
}

function printHelp() {
  console.log(
    "Refresh production hours notes from official HRSA schedule columns."
  );
  console.log("");
  console.log(
    "Copies only fields the HRSA CSV supplies for each site: operating hours"
  );
  console.log(
    "per week, operational schedule (full/part-time), operating calendar"
  );
  console.log(
    "(year-round/seasonal) and site location setting. Structured daily hours"
  );
  console.log("stay unknown because HRSA does not publish them.");
  console.log("");
  console.log("Usage:");
  console.log(
    "  node scripts/refreshHrsaHoursNotes.mjs --input=path/to/official.csv [--write]"
  );
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { cell += '"'; index += 1; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (inQuotes) throw new Error("The source CSV has an open quoted cell.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function cellText(value) {
  const text = String(value ?? "").trim();
  return text.toLowerCase() === "null" || text.toLowerCase() === "unknown"
    ? ""
    : text;
}

function buildHoursNotes(row, columnIndex) {
  const parts = [];
  const weeklyHours = cellText(row[columnIndex["Operating Hours per Week"]]);
  const schedule = cellText(
    row[columnIndex["Health Center Operational Schedule Description"]]
  );
  const calendar = cellText(row[columnIndex["Health Center Operating Calendar"]]);
  const setting = cellText(
    row[columnIndex["Health Center Service Delivery Site Location Setting Description"]]
  );

  if (weeklyHours) parts.push(`HRSA operating hours per week: ${weeklyHours}.`);
  if (schedule) parts.push(`Operational schedule: ${schedule}.`);
  if (calendar) parts.push(`Operating calendar: ${calendar}.`);
  if (setting) parts.push(`Site setting: ${setting}.`);
  if (parts.length === 0) return "";

  parts.push(
    "Daily opening hours are not published in the HRSA record; confirm with the site."
  );
  return parts.join(" ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.input) throw new Error("Missing --input=path/to/official.csv.");

  const facilities = JSON.parse(await readFile(args.facilities, "utf8"));
  if (!Array.isArray(facilities)) {
    throw new Error("The facilities file must contain an array.");
  }

  const parsed = parseCsv(await readFile(args.input, "utf8"));
  const headers = parsed[0].map((header) => header.trim());
  const columnIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  for (const required of [
    "BPHC Assigned Number",
    "Operating Hours per Week",
    "Health Center Operational Schedule Description",
    "Health Center Operating Calendar",
    "Health Center Service Delivery Site Location Setting Description"
  ]) {
    if (columnIndex[required] === undefined) {
      throw new Error(`The source CSV is missing the "${required}" column.`);
    }
  }

  const rowsBySourceId = new Map();
  for (const row of parsed.slice(1)) {
    const sourceId = cellText(row[columnIndex["BPHC Assigned Number"]]);
    if (sourceId) rowsBySourceId.set(sourceId, row);
  }

  let updated = 0;
  let unchanged = 0;
  let unmatched = 0;

  for (const facility of facilities) {
    const row = facility.sourceId ? rowsBySourceId.get(facility.sourceId) : undefined;
    if (!row) {
      unmatched += 1;
      continue;
    }

    const nextNotes = buildHoursNotes(row, columnIndex);
    if (!nextNotes || facility.hours?.notes === nextNotes) {
      unchanged += 1;
      continue;
    }

    facility.hours = { ...facility.hours, notes: nextNotes };
    updated += 1;
  }

  console.log(`Facilities with refreshed hours notes: ${updated}.`);
  console.log(`Facilities already up to date or without CSV schedule data: ${unchanged}.`);
  console.log(`Facilities without a matching CSV row: ${unmatched}.`);

  if (!args.write) {
    console.log("Dry run only. Re-run with --write to update the production file.");
    return;
  }

  await writeFile(args.facilities, `${JSON.stringify(facilities, null, 2)}\n`);
  console.log(`Wrote ${path.relative(projectRoot, args.facilities)}.`);
  console.log(
    "Re-run assign:facility-boundaries and generate:boundary-healthcare-summaries to refresh checksums."
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
