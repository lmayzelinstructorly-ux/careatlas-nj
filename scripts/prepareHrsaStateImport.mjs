import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeStateCode } from "./lib/stateBounds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const officialSourceUrl =
  "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv";
const outputHeaders = [
  "id", "name", "facilityType", "address", "city", "state", "stateFips",
  "county", "countyFips", "postalCode", "latitude", "longitude", "phone",
  "website", "services", "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday", "hoursNotes", "priceLevel",
  "acceptsSlidingScale", "estimatedVisitCost", "priceNotes", "acceptsMedicaid",
  "acceptsMedicare", "acceptsUninsured", "insuranceNotes", "accessibilityInfo",
  "sourceName", "sourceUrl", "sourceLastChecked", "sourceNotes", "sourceId",
  "sourceDataset", "sourceLastUpdated", "lastVerified", "verificationStatus",
  "isDemoData"
];

function parseArgs(argv) {
  const args = { input: "", output: "", state: "", write: false };
  for (const arg of argv) {
    if (arg === "--write") args.write = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--input=")) args.input = path.resolve(projectRoot, arg.slice(8));
    else if (arg.startsWith("--output=")) args.output = path.resolve(projectRoot, arg.slice(9));
    else if (arg.startsWith("--state=")) args.state = normalizeStateCode(arg.slice(8));
    else throw new Error(`Unknown option "${arg}".`);
  }
  return args;
}

function printHelp() {
  console.log("Prepare one state from the official HRSA service-delivery-site CSV.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run prepare:hrsa-state -- --input=path/to/official.csv --state=PA --output=public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv");
  console.log("  Add --write only after reviewing the dry-run summary.");
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

function rowObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}

function isoDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : "";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function mapRow(row) {
  const sourceId = row["BPHC Assigned Number"].trim();
  const sourceDate = isoDate(row["Data Warehouse Record Create Date"]);
  const hours = row["Operating Hours per Week"].trim();
  const notes = [
    "Fields copied from the official HRSA CSV: site name, address, city, state, postal code, phone, website, HRSA geocoding coordinates, county/FIPS, operating hours per week, site status, and location setting.",
    `Site status: ${row["Site Status Description"].trim() || "Unknown"}.`,
    `Location setting: ${row["Health Center Service Delivery Site Location Setting Description"].trim() || "Unknown"}.`,
    `Operational schedule: ${row["Health Center Operational Schedule Description"].trim() || "Unknown"}.`,
    "Daily hours, services, price, insurance, and accessibility fields were not supplied by this intake."
  ].join(" ");

  return {
    id: `hrsa-${sourceId.toLowerCase()}`,
    name: row["Site Name"].trim(),
    facilityType: "community_health_center",
    address: row["Site Address"].trim(),
    city: row["Site City"].trim(),
    state: row["Site State Abbreviation"].trim(),
    stateFips: row["State FIPS Code"].trim(),
    county: row["Complete County Name"].trim(),
    countyFips: row["State and County Federal Information Processing Standard Code"].trim(),
    postalCode: row["Site Postal Code"].trim(),
    latitude: row["Geocoding Artifact Address Primary Y Coordinate"].trim(),
    longitude: row["Geocoding Artifact Address Primary X Coordinate"].trim(),
    phone: row["Site Telephone Number"].trim(),
    website: row["Site Web Address"].trim(),
    hoursNotes: hours ? `HRSA operating hours per week: ${hours}` : "",
    priceLevel: "unknown",
    sourceName: "HRSA Health Center Service Delivery and Look-Alike Sites",
    sourceUrl: officialSourceUrl,
    sourceLastChecked: sourceDate,
    sourceNotes: notes,
    sourceId,
    sourceDataset: "Health Center Service Delivery and Look-Alike Sites",
    sourceLastUpdated: sourceDate,
    lastVerified: sourceDate,
    verificationStatus: "needs_review"
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.input) throw new Error("Missing --input=path/to/official.csv.");
  if (!args.state) throw new Error("Missing --state=XX.");
  if (!args.output) throw new Error("Missing --output=path/to/state.csv.");

  const parsed = parseCsv(await readFile(args.input, "utf8"));
  if (parsed.length < 2) throw new Error("The official source CSV has no data rows.");
  const headers = parsed[0].map((header) => header.trim());
  const required = [
    "BPHC Assigned Number", "Site Name", "Site Address", "Site City",
    "Site State Abbreviation", "Geocoding Artifact Address Primary X Coordinate",
    "Geocoding Artifact Address Primary Y Coordinate", "Data Warehouse Record Create Date"
  ];
  const missingHeaders = required.filter((header) => !headers.includes(header));
  if (missingHeaders.length) throw new Error(`Official HRSA columns are missing: ${missingHeaders.join(", ")}.`);

  const sourceRows = parsed.slice(1).map((row) => rowObject(headers, row));
  const stateRows = sourceRows.filter(
    (row) => normalizeStateCode(row["Site State Abbreviation"]) === args.state
  );
  const mapped = stateRows.map(mapRow);
  const missingCoordinates = mapped.filter((row) => !row.latitude || !row.longitude).length;
  const missingIdentity = mapped.filter((row) => !row.sourceId || !row.name || !row.city).length;
  const missingAddresses = mapped.filter((row) => !row.address).length;
  const duplicateSourceIds = mapped.length - new Set(mapped.map((row) => row.sourceId)).size;

  console.log("HRSA state import preparation summary");
  console.log(`State: ${args.state}`);
  console.log(`Official source rows read: ${sourceRows.length}`);
  console.log(`State rows selected: ${mapped.length}`);
  console.log(`Rows missing coordinates: ${missingCoordinates}`);
  console.log(`Rows missing identity fields: ${missingIdentity}`);
  console.log(`Rows missing street address (kept unknown for staging review): ${missingAddresses}`);
  console.log(`Duplicate source IDs: ${duplicateSourceIds}`);
  console.log(`Output: ${path.relative(projectRoot, args.output).replace(/\\/g, "/")}`);

  if (!mapped.length) throw new Error(`No official rows found for ${args.state}.`);
  if (missingIdentity || duplicateSourceIds) {
    throw new Error("The state subset has missing identity fields or duplicate HRSA source IDs.");
  }
  if (!args.write) return console.log("Dry run only. No state CSV was written.");

  const lines = [
    outputHeaders.join(","),
    ...mapped.map((row) => outputHeaders.map((header) => csvCell(row[header])).join(","))
  ];
  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${mapped.length} official HRSA rows.`);
}

main().catch((error) => {
  console.error("HRSA state import preparation failed.");
  console.error(error.message);
  process.exit(1);
});
