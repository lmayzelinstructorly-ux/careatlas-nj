import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const datasetPageUrl = "https://data.cms.gov/provider-data/dataset/xubh-q36u";
const sourceName = "CMS Hospital General Information";
const geocoderUrl =
  "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";
const geocoderBatchSize = 5000;

// Only identity, contact, type and emergency-service fields are copied.
// CMS quality ratings and measure columns are intentionally ignored:
// CareAtlas does not present medical quality claims.
const copiedColumns = [
  "Facility ID",
  "Facility Name",
  "Address",
  "City/Town",
  "State",
  "ZIP Code",
  "County/Parish",
  "Telephone Number",
  "Hospital Type",
  "Hospital Ownership",
  "Emergency Services"
];

function parseArgs(argv) {
  const args = { input: "", output: "", states: [], checkedDate: "" };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--input=")) args.input = path.resolve(projectRoot, arg.slice(8));
    else if (arg.startsWith("--output=")) args.output = path.resolve(projectRoot, arg.slice(9));
    else if (arg.startsWith("--states=")) {
      args.states = arg
        .slice(9)
        .split(",")
        .map((state) => state.trim().toUpperCase())
        .filter(Boolean);
    } else if (arg.startsWith("--checked-date=")) {
      args.checkedDate = arg.slice(15);
    } else throw new Error(`Unknown option "${arg}".`);
  }
  return args;
}

function printHelp() {
  console.log("Prepare a CareAtlas import CSV from the official CMS Hospital General Information download.");
  console.log("");
  console.log("Addresses are geocoded with the official U.S. Census Bureau batch");
  console.log("geocoder; only rows with a Census address match are emitted, and the");
  console.log("match quality is recorded in the source notes. CMS quality ratings");
  console.log("are never copied.");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/prepareCmsHospitalImport.mjs \\");
  console.log("    --input=public/data/healthcare/imports/cms/hospital-general-information-YYYY-MM-DD.csv \\");
  console.log("    --states=NJ,NY,PA --output=public/data/healthcare/imports/cms/cms-hospitals.csv \\");
  console.log("    --checked-date=YYYY-MM-DD");
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

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cellText(value) {
  const text = String(value ?? "").trim();
  return text.toLowerCase() === "not available" ? "" : text;
}

async function geocodeBatch(rows) {
  const lines = ["id,street,city,state,zip"];
  for (const row of rows) {
    lines.push(
      [row.sourceId, row.address, row.city, row.state, row.postalCode]
        .map(csvCell)
        .join(",")
    );
  }
  const form = new FormData();
  form.append("benchmark", "Public_AR_Current");
  form.append(
    "addressFile",
    new Blob([lines.join("\n")], { type: "text/csv" }),
    "addresses.csv"
  );
  const response = await fetch(geocoderUrl, { body: form, method: "POST" });
  if (!response.ok) {
    throw new Error(`Census geocoder request failed with status ${response.status}.`);
  }
  const matches = new Map();
  for (const line of parseCsv(await response.text())) {
    // Batch geocoder columns: id, input address, match flag, match type,
    // matched address, "longitude,latitude", tiger line id, side.
    const [id, , matchFlag, matchType, matchedAddress, coordinates] = line;
    if (String(matchFlag).trim() !== "Match") continue;
    const [longitude, latitude] = String(coordinates ?? "").split(",").map(Number);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    matches.set(String(id).trim(), {
      latitude,
      longitude,
      matchType: String(matchType ?? "").trim() || "Unknown",
      matchedAddress: String(matchedAddress ?? "").trim()
    });
  }
  return matches;
}

function buildSourceNotes(row, geocode) {
  return [
    "Fields copied from the official CMS Hospital General Information CSV: facility name, address, city, state, ZIP code, county, phone, hospital type, ownership and emergency services flag.",
    `Hospital type: ${row.hospitalType || "Unknown"}.`,
    `Ownership: ${row.ownership || "Unknown"}.`,
    `Emergency services listed by CMS: ${row.emergencyServices || "Unknown"}.`,
    `Coordinates from the U.S. Census Bureau batch geocoder (${geocode.matchType} address match).`,
    "CMS quality ratings and measures were intentionally not copied. Daily hours, prices and insurance details were not supplied by this intake."
  ].join(" ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.input) throw new Error("Missing --input=path/to/cms.csv.");
  if (!args.output) throw new Error("Missing --output=path/to/import.csv.");
  if (args.states.length === 0) throw new Error("Missing --states=XX,YY.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.checkedDate)) {
    throw new Error("Missing or invalid --checked-date=YYYY-MM-DD.");
  }

  const parsed = parseCsv(await readFile(args.input, "utf8"));
  const headers = parsed[0].map((header) => header.trim());
  const columnIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  for (const required of copiedColumns) {
    if (columnIndex[required] === undefined) {
      throw new Error(`The source CSV is missing the "${required}" column.`);
    }
  }

  const wantedStates = new Set(args.states);
  const rows = [];
  const seenIds = new Set();
  for (const raw of parsed.slice(1)) {
    const state = cellText(raw[columnIndex["State"]]).toUpperCase();
    if (!wantedStates.has(state)) continue;
    const sourceId = cellText(raw[columnIndex["Facility ID"]]);
    if (!sourceId || seenIds.has(sourceId)) continue;
    seenIds.add(sourceId);
    rows.push({
      sourceId,
      name: cellText(raw[columnIndex["Facility Name"]]),
      address: cellText(raw[columnIndex["Address"]]),
      city: cellText(raw[columnIndex["City/Town"]]),
      state,
      postalCode: cellText(raw[columnIndex["ZIP Code"]]),
      county: cellText(raw[columnIndex["County/Parish"]]),
      phone: cellText(raw[columnIndex["Telephone Number"]]),
      hospitalType: cellText(raw[columnIndex["Hospital Type"]]),
      ownership: cellText(raw[columnIndex["Hospital Ownership"]]),
      emergencyServices: cellText(raw[columnIndex["Emergency Services"]])
    });
  }
  console.log(`CMS hospitals in requested states: ${rows.length}.`);

  const geocoded = new Map();
  for (let start = 0; start < rows.length; start += geocoderBatchSize) {
    const batch = rows.slice(start, start + geocoderBatchSize);
    const matches = await geocodeBatch(batch);
    for (const [id, match] of matches) geocoded.set(id, match);
    console.log(
      `Geocoded batch ${Math.floor(start / geocoderBatchSize) + 1}: ${matches.size} of ${batch.length} matched.`
    );
  }

  const header = [
    "id", "name", "facility type", "address", "city", "state", "county",
    "zip code", "latitude", "longitude", "phone", "services",
    "source name", "source url", "source last checked", "source notes",
    "source id", "source dataset", "source last updated", "last verified",
    "verification status", "fieldsources"
  ];
  const outputLines = [header.join(",")];
  let skippedNoGeocode = 0;
  let skippedIncomplete = 0;

  for (const row of rows) {
    if (!row.name || !row.address || !row.city || !row.postalCode) {
      skippedIncomplete += 1;
      continue;
    }
    const geocode = geocoded.get(row.sourceId);
    if (!geocode) {
      skippedNoGeocode += 1;
      continue;
    }
    const hasEmergencyServices = /^yes$/i.test(row.emergencyServices);
    const fieldSources = hasEmergencyServices
      ? JSON.stringify({
          services: {
            field: "services",
            status: "source_backed",
            sourceUrl: datasetPageUrl,
            sourceTitle: sourceName,
            checkedDate: args.checkedDate,
            sourceType: "federal_open_data",
            locationSpecific: true,
            reviewerNote:
              "Emergency services flag copied from the official CMS Hospital General Information row for this facility."
          }
        })
      : "";
    outputLines.push([
      `cms-${row.sourceId.toLowerCase()}`,
      row.name,
      "hospital",
      row.address,
      row.city,
      row.state,
      row.county,
      row.postalCode,
      geocode.latitude,
      geocode.longitude,
      row.phone,
      hasEmergencyServices ? "Emergency services" : "",
      sourceName,
      datasetPageUrl,
      args.checkedDate,
      buildSourceNotes(row, geocode),
      row.sourceId,
      "Hospital General Information",
      args.checkedDate,
      args.checkedDate,
      "needs_review",
      fieldSources
    ].map(csvCell).join(","));
  }

  await writeFile(args.output, `${outputLines.join("\n")}\n`);
  console.log(`Rows written: ${outputLines.length - 1}.`);
  console.log(`Skipped without a Census address match: ${skippedNoGeocode}.`);
  console.log(`Skipped with incomplete identity fields: ${skippedIncomplete}.`);
  console.log(`Wrote ${path.relative(projectRoot, args.output)}.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
