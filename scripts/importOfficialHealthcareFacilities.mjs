import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectEnrichmentProvenanceErrors } from "./lib/healthcareEnrichmentProvenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultOutputPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
const productionFacilitiesPath = defaultOutputPath;
const importReportPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "imports",
  "latest-import-report.json"
);
const demoImportReportPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "imports",
  "latest-demo-import-report.json"
);
const demoFilePattern = /(^|[\\/._-])(demo|sample|test|placeholder)([\\/._-]|$)/i;

const sourceNormalizers = {
  hrsa: normalizeHrsaFacilityRow
};

const futureSources = ["cms_hospital", "nppes", "state_open_data"];

const hrsaFieldAliases = {
  sourceId: [
    "site id",
    "site_id",
    "bhcmis id",
    "bphc assigned number",
    "health center site id",
    "source id",
    "id"
  ],
  name: [
    "site name",
    "health center site name",
    "facility name",
    "name",
    "site_name",
    "health center name",
    "organization name"
  ],
  address: [
    "street address",
    "address",
    "address line 1",
    "site address",
    "physical address",
    "location address"
  ],
  city: ["city", "site city", "location city"],
  state: ["state", "state abbreviation", "site state", "st"],
  zip: ["zip", "zip code", "zipcode", "postal code", "site zip"],
  county: ["county", "county name", "site county"],
  latitude: ["latitude", "lat", "site latitude", "location latitude"],
  longitude: ["longitude", "lon", "lng", "site longitude", "location longitude"],
  phone: ["phone", "phone number", "telephone", "site phone"],
  website: ["website", "url", "site url", "web site"],
  sourceUrl: ["source url", "data source url", "record url", "profile url"],
  sourceDataset: ["program", "source dataset", "dataset", "grant program"],
  sourceLastUpdated: ["last updated", "source last updated", "date updated", "updated date"],
  services: ["services", "service", "service type", "service area"],
  hoursNotes: ["hours", "hours notes", "operating hours"],
  priceNotes: ["price notes", "cost notes", "fee notes"],
  insuranceNotes: ["insurance notes", "insurance", "payer notes"]
};

function parseArgs(argv) {
  const args = {
    allowDemoWrite: false,
    source: "",
    input: "",
    output: defaultOutputPath,
    write: false,
    merge: false
  };

  for (const arg of argv) {
    if (arg === "--write") {
      args.write = true;
    } else if (arg === "--allow-demo-write") {
      args.allowDemoWrite = true;
    } else if (arg === "--merge") {
      args.merge = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--source=")) {
      args.source = arg.slice("--source=".length).trim().toLowerCase();
    } else if (arg.startsWith("--input=")) {
      args.input = path.resolve(projectRoot, arg.slice("--input=".length));
    } else if (arg.startsWith("--output=")) {
      args.output = path.resolve(projectRoot, arg.slice("--output=".length));
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  return args;
}

function isProductionOutputPath(filePath) {
  return path.resolve(filePath) === productionFacilitiesPath;
}

function isDemoOutputPath(filePath) {
  return path.basename(filePath).toLowerCase().includes(".demo.");
}

function isDemoImportPath(filePath) {
  return demoFilePattern.test(path.relative(projectRoot, filePath));
}

function isDemoFacility(facility) {
  return facility.isDemoData === true || facility.verificationStatus === "demo";
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const nextChar = raw[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (inQuotes) {
    throw new Error("The CSV has an open quoted cell. Check for a missing closing quote.");
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((csvRow) =>
    csvRow.some((value) => value.trim().length > 0)
  );
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function normalizeHeader(header) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "");
}

function rowToObject(headers, row) {
  return Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ""])
  );
}

function getByAliases(row, aliases) {
  for (const alias of aliases) {
    const aliasKey = normalizeHeader(alias);

    if (Object.hasOwn(row, aliasKey)) {
      const value = cleanText(row[aliasKey]);

      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

function parseNumber(value) {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function createStableId(sourceId, state, name, zip) {
  if (sourceId) {
    return `hrsa-${slugify(sourceId)}`;
  }

  return `hrsa-${slugify(state || "unknown")}-${slugify(name || "unnamed")}-${slugify(zip || "nozip")}`;
}

function addText(target, key, value) {
  const text = cleanText(value);

  if (text) {
    target[key] = text;
  }
}

function normalizeHrsaFacilityRow(row, context = {}) {
  const warnings = [];
  const today = context.importDate ?? new Date().toISOString().slice(0, 10);
  const sourceId = getByAliases(row, hrsaFieldAliases.sourceId);
  const name = getByAliases(row, hrsaFieldAliases.name);
  const address = getByAliases(row, hrsaFieldAliases.address);
  const city = getByAliases(row, hrsaFieldAliases.city);
  const state = getByAliases(row, hrsaFieldAliases.state);
  const zip = getByAliases(row, hrsaFieldAliases.zip);
  const county = getByAliases(row, hrsaFieldAliases.county);
  const latitude = parseNumber(getByAliases(row, hrsaFieldAliases.latitude));
  const longitude = parseNumber(getByAliases(row, hrsaFieldAliases.longitude));
  const phone = getByAliases(row, hrsaFieldAliases.phone);
  const website = getByAliases(row, hrsaFieldAliases.website);
  const sourceUrl = getByAliases(row, hrsaFieldAliases.sourceUrl) ?? "https://data.hrsa.gov/";
  const sourceDataset =
    getByAliases(row, hrsaFieldAliases.sourceDataset) ?? "HRSA Health Center Program";
  const sourceLastUpdated = getByAliases(row, hrsaFieldAliases.sourceLastUpdated);
  const servicesText = getByAliases(row, hrsaFieldAliases.services);
  const hoursNotes = getByAliases(row, hrsaFieldAliases.hoursNotes);
  const priceNotes = getByAliases(row, hrsaFieldAliases.priceNotes);
  const insuranceNotes = getByAliases(row, hrsaFieldAliases.insuranceNotes);

  for (const [field, value] of [
    ["name", name],
    ["address", address],
    ["city", city],
    ["state", state]
  ]) {
    if (!value) {
      warnings.push(`Missing important HRSA field: ${field}.`);
    }
  }

  if (latitude === undefined || longitude === undefined) {
    warnings.push("Latitude or longitude is missing or invalid.");
  }

  if (!name || !city || !state) {
    return {
      facility: null,
      warnings,
      skippedReason: "Missing minimum identity fields: name, city or state."
    };
  }

  const facility = {
    id: createStableId(sourceId, state, name, zip),
    name,
    facilityType: "community_health_center",
    address: address ?? "",
    city,
    state,
    county,
    phone,
    website,
    services: servicesText
      ? servicesText.split(/[;|]/).map((service) => service.trim()).filter(Boolean)
      : [],
    hours: {},
    priceInfo: {
      priceLevel: "unknown"
    },
    insuranceInfo: {},
    sourceInfo: {
      sourceName: "HRSA",
      sourceUrl,
      lastChecked: sourceLastUpdated ?? today,
      notes:
        "Imported from an official HRSA/community health center source. Unknown hours, prices and insurance fields were not estimated."
    },
    sourceId,
    sourceDataset,
    sourceLastUpdated,
    importDate: today,
    isDemoData: /demo|sample|placeholder/i.test(
      `${name} ${sourceId ?? ""} ${context.inputPath ?? ""}`
    ),
    dataCompletenessNotes:
      "Official import preserved source-backed fields only. Missing hours, prices, insurance, services or coordinates remain unknown.",
    verificationStatus: "needs_review"
  };

  if (zip) {
    facility.postalCode = zip;
  }

  if (latitude !== undefined && longitude !== undefined) {
    facility.latitude = latitude;
    facility.longitude = longitude;
  }

  if (hoursNotes) {
    facility.hours.notes = hoursNotes;
  }

  if (priceNotes) {
    facility.priceInfo.priceNotes = priceNotes;
  }

  if (insuranceNotes) {
    facility.insuranceInfo.insuranceNotes = insuranceNotes;
  }

  if (facility.isDemoData) {
    facility.verificationStatus = "demo";
    facility.sourceInfo.notes =
      "Demo row for testing official-source import mapping. Not a real healthcare provider.";
  }

  warnings.push(
    ...collectEnrichmentProvenanceErrors(facility, {
      label: facility.id,
      requireSourceBacked: true
    })
  );

  return { facility, warnings, skippedReason: "" };
}

function countUnknownFields(facilities) {
  const counts = {
    coordinates: 0,
    phone: 0,
    website: 0,
    services: 0,
    hours: 0,
    priceInfo: 0,
    insuranceInfo: 0,
    county: 0
  };

  for (const facility of facilities) {
    if (facility.latitude === undefined || facility.longitude === undefined) {
      counts.coordinates += 1;
    }

    if (!cleanText(facility.phone)) {
      counts.phone += 1;
    }

    if (!cleanText(facility.website)) {
      counts.website += 1;
    }

    if (!Array.isArray(facility.services) || facility.services.length === 0) {
      counts.services += 1;
    }

    if (!facility.hours || Object.keys(facility.hours).length === 0) {
      counts.hours += 1;
    }

    if (!facility.priceInfo || facility.priceInfo.priceLevel === "unknown") {
      counts.priceInfo += 1;
    }

    if (
      !facility.insuranceInfo ||
      (facility.insuranceInfo.acceptsMedicaid === undefined &&
        facility.insuranceInfo.acceptsMedicare === undefined &&
        facility.insuranceInfo.acceptsUninsured === undefined &&
        !cleanText(facility.insuranceInfo.insuranceNotes))
    ) {
      counts.insuranceInfo += 1;
    }

    if (!cleanText(facility.county)) {
      counts.county += 1;
    }
  }

  return counts;
}

function findDuplicateWarnings(facilities, existingFacilities = []) {
  const warnings = [];
  const ids = new Map();
  const nameAddresses = new Map();

  for (const facility of [...existingFacilities, ...facilities]) {
    if (ids.has(facility.id)) {
      warnings.push(`Duplicate id "${facility.id}" found.`);
    } else {
      ids.set(facility.id, facility);
    }

    const key = [
      facility.name,
      facility.address,
      facility.city,
      facility.state
    ]
      .map((part) => slugify(part))
      .join("|");

    if (key.replace(/\|/g, "").length === 0) {
      continue;
    }

    if (nameAddresses.has(key)) {
      warnings.push(
        `Likely duplicate facility name/address: "${facility.name}" in ${facility.city}, ${facility.state}.`
      );
    } else {
      nameAddresses.set(key, facility);
    }
  }

  return warnings;
}

async function readExistingFacilities(outputPath) {
  try {
    const raw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function mergeFacilities(existingFacilities, importedFacilities) {
  const warnings = [];
  const mergedById = new Map(existingFacilities.map((facility) => [facility.id, facility]));

  for (const facility of importedFacilities) {
    if (mergedById.has(facility.id)) {
      warnings.push(`Merged imported record over existing duplicate id "${facility.id}".`);
    }

    mergedById.set(facility.id, {
      ...(mergedById.get(facility.id) ?? {}),
      ...facility
    });
  }

  return {
    facilities: [...mergedById.values()],
    warnings
  };
}

function printHelp() {
  console.log("Import official-source healthcare facility CSV data.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run import:official-healthcare -- --source=hrsa --input=public/data/healthcare/imports/hrsa-sample.csv");
  console.log("  npm run import:official-healthcare -- --source=hrsa --input=public/data/healthcare/imports/hrsa-sample.csv --write");
  console.log("  npm run import:official-healthcare -- --source=hrsa --input=public/data/healthcare/imports/hrsa-sample.csv --output=public/data/healthcare/facilities.demo.json --write");
  console.log("");
  console.log("Supported sources: hrsa");
  console.log(`Structured for future sources: ${futureSources.join(", ")}`);
  console.log("For production HRSA additions, use healthcare:hrsa:review-source and healthcare:hrsa:stage before promotion.");
  console.log("Use --allow-demo-write only when intentionally writing demo/sample rows to production facilities.json.");
}

function printSummary(report, facilities) {
  console.log("Official healthcare facility import summary");
  console.log(`Source: ${report.source}`);
  console.log(`Input: ${report.inputPath}`);
  console.log(`Rows read: ${report.rowsRead}`);
  console.log(`Records normalized: ${report.recordsNormalized}`);
  console.log(`Records skipped: ${report.skippedRows}`);
  console.log(`Missing coordinate count: ${report.unknownFieldCounts.coordinates}`);
  console.log(`Unknown price count: ${report.unknownFieldCounts.priceInfo}`);
  console.log(`Unknown insurance count: ${report.unknownFieldCounts.insuranceInfo}`);
  console.log(`Unknown hours count: ${report.unknownFieldCounts.hours}`);

  if (report.duplicateWarnings.length > 0) {
    console.log("Duplicate warnings:");
    for (const warning of report.duplicateWarnings.slice(0, 20)) {
      console.log(`- ${warning}`);
    }
  }

  const duplicateWarningSet = new Set(report.duplicateWarnings);
  const sourceWarnings = report.warnings.filter(
    (warning) => !duplicateWarningSet.has(warning)
  );

  if (sourceWarnings.length > 0) {
    console.log("Source warnings:");
    for (const warning of sourceWarnings.slice(0, 20)) {
      console.log(`- ${warning}`);
    }

    if (sourceWarnings.length > 20) {
      console.log(`- ${sourceWarnings.length - 20} additional warnings omitted from console.`);
    }
  }

  console.log("Preview of normalized facilities:");
  console.log(JSON.stringify(facilities.slice(0, 3), null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.source) {
    throw new Error("Missing --source. Start with --source=hrsa.");
  }

  if (!Object.hasOwn(sourceNormalizers, args.source)) {
    throw new Error(
      `Unsupported source "${args.source}". Supported now: hrsa. Future sources: ${futureSources.join(", ")}.`
    );
  }

  if (!args.input) {
    throw new Error("Missing --input=path/to/source.csv.");
  }

  const importDate = new Date().toISOString().slice(0, 10);
  const raw = await readFile(args.input, "utf8");
  const rows = parseCsv(raw);

  if (rows.length === 0) {
    throw new Error("The CSV must include a header row.");
  }

  const headers = rows[0].map(normalizeHeader);
  const dataRows = rows.slice(1).filter((row) => !row[0]?.trim().startsWith("#"));
  const warnings = [];
  const skipped = [];
  const normalizer = sourceNormalizers[args.source];
  const facilities = [];

  for (const [index, row] of dataRows.entries()) {
    const rowNumber = index + 2;
    const result = normalizer(rowToObject(headers, row), {
      importDate,
      inputPath: path.relative(projectRoot, args.input)
    });

    for (const warning of result.warnings) {
      warnings.push(`Row ${rowNumber}: ${warning}`);
    }

    if (result.facility) {
      facilities.push(result.facility);
    } else {
      skipped.push({
        rowNumber,
        reason: result.skippedReason || "Row could not be normalized."
      });
    }
  }

  const existingFacilities = args.merge ? await readExistingFacilities(args.output) : [];
  const duplicateWarnings = findDuplicateWarnings(facilities, existingFacilities);
  warnings.push(...duplicateWarnings);
  const unknownFieldCounts = countUnknownFields(facilities);
  const hasDemoInputPath = isDemoImportPath(args.input);
  const demoRecordCount = facilities.filter(isDemoFacility).length;
  const writesDemoOutput = isDemoOutputPath(args.output);
  const writesProductionOutput = isProductionOutputPath(args.output);
  const report = {
    source: args.source,
    inputPath: path.relative(projectRoot, args.input),
    outputPath: path.relative(projectRoot, args.output),
    importDate,
    dryRun: !args.write,
    demoImport: hasDemoInputPath || demoRecordCount > 0 || writesDemoOutput,
    demoRecordCount,
    merge: args.merge,
    rowsRead: dataRows.length,
    recordsNormalized: facilities.length,
    validRecords: facilities.length,
    recordsWritten: args.write ? (args.merge ? undefined : facilities.length) : 0,
    skippedRows: skipped.length,
    skipped,
    warnings,
    unknownFieldCounts,
    duplicateWarnings
  };

  let outputFacilities = facilities;

  if (args.merge) {
    const mergeResult = mergeFacilities(existingFacilities, facilities);
    outputFacilities = mergeResult.facilities;
    report.recordsWritten = args.write ? outputFacilities.length : 0;
    report.warnings.push(...mergeResult.warnings);
  } else if (args.write && duplicateWarnings.some((warning) => warning.includes("Duplicate id"))) {
    throw new Error("Duplicate IDs found. Use --merge to merge intentionally or fix the source CSV.");
  }

  if (!args.merge) {
    report.recordsWritten = args.write ? outputFacilities.length : 0;
  }

  printSummary(report, facilities);

  if (!args.write) {
    console.log("");
    console.log("Dry run only. facilities.json was not changed.");
    console.log("Add --write to save normalized official-source records.");
    return;
  }

  if (
    writesProductionOutput &&
    (hasDemoInputPath ||
      demoRecordCount > 0 ||
      outputFacilities.some(isDemoFacility)) &&
    !args.allowDemoWrite
  ) {
    throw new Error(
      "This official-source import looks like demo/sample healthcare data. Production facilities.json should not contain demo records. Write demo records to facilities.demo.json with --output=public/data/healthcare/facilities.demo.json, or rerun with --allow-demo-write only if this production write is intentional."
    );
  }

  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(outputFacilities, null, 2)}\n`, "utf8");
  const selectedImportReportPath = report.demoImport
    ? demoImportReportPath
    : importReportPath;
  await mkdir(path.dirname(selectedImportReportPath), { recursive: true });
  await writeFile(selectedImportReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("");
  console.log(`Wrote ${outputFacilities.length} records to ${path.relative(projectRoot, args.output)}.`);
  console.log(`Wrote import report to ${path.relative(projectRoot, selectedImportReportPath)}.`);
}

main().catch((error) => {
  console.error("Official healthcare facility import failed.");
  console.error(error.message);
  process.exit(1);
});
