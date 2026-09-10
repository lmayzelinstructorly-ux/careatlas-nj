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

const officialSourceUrl = "https://data.cms.gov/provider-data/dataset/xubh-q36u";
const sourceTitle = "CMS Hospital General Information (official CSV)";
const excludedOwnerships = new Set([
  "Veterans Health Administration",
  "Department of Defense"
]);

function parseArgs(argv) {
  const args = { input: "", output: "", facilities: defaultFacilitiesPath, checkedDate: "" };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--input=")) args.input = path.resolve(projectRoot, arg.slice(8));
    else if (arg.startsWith("--output=")) args.output = path.resolve(projectRoot, arg.slice(9));
    else if (arg.startsWith("--facilities=")) {
      args.facilities = path.resolve(projectRoot, arg.slice(13));
    } else if (arg.startsWith("--checked-date=")) {
      args.checkedDate = arg.slice(15);
    } else throw new Error(`Unknown option "${arg}".`);
  }
  return args;
}

function printHelp() {
  console.log(
    "Generate a healthcare enrichment input file from the official CMS Hospital General Information CSV."
  );
  console.log("");
  console.log("Derives only the row-level fact the CMS dataset itself supports:");
  console.log(
    "- insurance: Medicare registration. Every row in this dataset is a hospital"
  );
  console.log(
    "  registered with Medicare, so acceptsMedicare is set from dataset membership."
  );
  console.log(
    "- Veterans Health Administration and Department of Defense hospitals are"
  );
  console.log(
    "  skipped: their listing does not mean they bill Medicare or serve the"
  );
  console.log("  general public, so their insurance stays unknown.");
  console.log("");
  console.log("Usage:");
  console.log(
    "  node scripts/generateCmsMedicareEnrichmentInput.mjs --input=path/to/official.csv \\"
  );
  console.log("    --output=path/to/enrichment.json --checked-date=YYYY-MM-DD");
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
  return text.toLowerCase() === "null" ? "" : text;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.input) throw new Error("Missing --input=path/to/official.csv.");
  if (!args.output) throw new Error("Missing --output=path/to/enrichment.json.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.checkedDate)) {
    throw new Error("Missing or invalid --checked-date=YYYY-MM-DD.");
  }

  const facilities = JSON.parse(await readFile(args.facilities, "utf8"));
  if (!Array.isArray(facilities)) {
    throw new Error("The facilities file must contain an array.");
  }

  const parsed = parseCsv(await readFile(args.input, "utf8"));
  if (parsed.length < 2) throw new Error("The official source CSV has no data rows.");
  const headers = parsed[0].map((header) => header.trim());
  const columnIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  for (const required of ["Facility ID", "Hospital Type", "Hospital Ownership"]) {
    if (columnIndex[required] === undefined) {
      throw new Error(`The source CSV is missing the "${required}" column.`);
    }
  }

  const rowsBySourceId = new Map();
  for (const row of parsed.slice(1)) {
    const sourceId = cellText(row[columnIndex["Facility ID"]]);
    if (sourceId) rowsBySourceId.set(sourceId, row);
  }

  const enrichmentInputs = [];
  let unmatchedFacilities = 0;
  let excludedFederalHealthSystemRows = 0;

  for (const facility of facilities) {
    if (facility.sourceDataset !== "Hospital General Information") continue;

    const row = facility.sourceId ? rowsBySourceId.get(facility.sourceId) : undefined;
    if (!row) {
      unmatchedFacilities += 1;
      continue;
    }

    const hospitalOwnership = cellText(row[columnIndex["Hospital Ownership"]]);
    if (excludedOwnerships.has(hospitalOwnership)) {
      excludedFederalHealthSystemRows += 1;
      continue;
    }

    const hospitalType = cellText(row[columnIndex["Hospital Type"]]);

    const insuranceInfo = {
      acceptsMedicare: true,
      insuranceNotes:
        `CMS lists this hospital in the official Hospital General Information dataset as a Medicare-registered hospital (CMS certification number ${facility.sourceId}). Hospital type: ${hospitalType}. Accepted plans, networks, Medicaid and self-pay policies are not listed in the CMS record; confirm coverage details with the hospital.`
    };

    const reviewerNote =
      `Derived from the official CMS Hospital General Information row for this facility (Facility ID ${facility.sourceId}, Hospital Type "${hospitalType}", Ownership "${hospitalOwnership}"). Every row in this dataset is a hospital registered with Medicare; only that Medicare-registration fact is asserted. Veterans Health Administration and Department of Defense hospitals were excluded from this enrichment.`;

    enrichmentInputs.push({
      id: facility.id,
      enrichment: { insuranceInfo },
      fieldSources: {
        insurance: {
          field: "insurance",
          status: "source_backed",
          sourceUrl: officialSourceUrl,
          sourceTitle,
          checkedDate: args.checkedDate,
          sourceType: "federal_open_data",
          locationSpecific: true,
          sourceLocationScope: "facility_location",
          reviewerNote
        }
      }
    });
  }

  await writeFile(args.output, `${JSON.stringify(enrichmentInputs, null, 2)}\n`);

  console.log(`Matched CMS rows for ${enrichmentInputs.length} production facilities.`);
  console.log(`Facilities without a matching CSV row: ${unmatchedFacilities}.`);
  console.log(
    `Skipped VA/DoD hospitals (insurance stays unknown): ${excludedFederalHealthSystemRows}.`
  );
  console.log(`Wrote ${path.relative(projectRoot, args.output)}.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
