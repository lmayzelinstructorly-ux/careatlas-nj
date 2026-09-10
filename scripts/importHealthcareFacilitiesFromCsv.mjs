import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectEnrichmentProvenanceErrors } from "./lib/healthcareEnrichmentProvenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultCsvPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.template.csv"
);
const defaultOutputPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
const productionFacilitiesPath = defaultOutputPath;
const pilotNjFolderPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "imports",
  "pilot-nj"
);
const pilotNjImportReportPath = path.join(
  pilotNjFolderPath,
  "latest-pilot-import-report.json"
);
const demoFilePattern = /(^|[\\/._-])(demo|sample|test|placeholder)([\\/._-]|$)/i;

const requiredHeaders = [
  "id",
  "name",
  "facilityType",
  "address",
  "city",
  "state",
  "stateFips",
  "county",
  "countyFips",
  "latitude",
  "longitude",
  "phone",
  "website",
  "services",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "hoursNotes",
  "priceLevel",
  "acceptsSlidingScale",
  "estimatedVisitCost",
  "priceNotes",
  "acceptsMedicaid",
  "acceptsMedicare",
  "acceptsUninsured",
  "insuranceNotes",
  "accessibilityInfo",
  "sourceName",
  "sourceUrl",
  "sourceLastChecked",
  "sourceNotes",
  "lastVerified",
  "verificationStatus"
];

const booleanFields = new Set([
  "acceptsSlidingScale",
  "acceptsMedicaid",
  "acceptsMedicare",
  "acceptsUninsured"
]);

function parseArgs(argv) {
  const args = {
    allowDemoWrite: false,
    csvPath: defaultCsvPath,
    merge: false,
    output: defaultOutputPath,
    write: false
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
    } else if (arg.startsWith("--output=")) {
      args.output = path.resolve(projectRoot, arg.slice("--output=".length));
    } else if (arg.startsWith("--")) {
      throw new Error(
        `Unknown option "${arg}". Use --write to save facilities.json.`
      );
    } else {
      args.csvPath = path.resolve(projectRoot, arg);
    }
  }

  return args;
}

function isDemoImportPath(filePath) {
  return demoFilePattern.test(path.relative(projectRoot, filePath));
}

function isProductionOutputPath(filePath) {
  return path.resolve(filePath) === productionFacilitiesPath;
}

function isDemoOutputPath(filePath) {
  return path.basename(filePath).toLowerCase().includes(".demo.");
}

function isPilotNjImportPath(filePath) {
  const relativePath = path.relative(pilotNjFolderPath, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function isDemoFacility(facility) {
  return (
    facility.isDemoData === true ||
    facility.verificationStatus === "demo" ||
    /(^|[^a-z])(demo|sample|test|placeholder|fake)([^a-z]|$)/i.test(
      `${facility.id} ${facility.name} ${facility.sourceInfo?.sourceName ?? ""} ${facility.sourceInfo?.notes ?? ""}`
    )
  );
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

function parseNumber(value, fieldName, rowNumber, errors) {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  const parsed = Number(text);

  if (!Number.isFinite(parsed)) {
    errors.push(`Row ${rowNumber}: ${fieldName} must be a number when provided.`);
    return undefined;
  }

  return parsed;
}

function parseBoolean(value, fieldName, rowNumber, errors) {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  const normalized = text.toLowerCase();

  if (normalized === "true" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "no") {
    return false;
  }

  errors.push(
    `Row ${rowNumber}: ${fieldName} must be true, false, yes, no, or blank.`
  );
  return undefined;
}

function assignText(target, key, value) {
  const text = cleanText(value);

  if (text) {
    target[key] = text;
  }
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function rowToObject(headers, row) {
  return Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ""])
  );
}

function convertRow(row, rowNumber, errors, context = {}) {
  const facility = {
    id: cleanText(row.id) ?? "",
    name: cleanText(row.name) ?? "",
    facilityType: cleanText(row.facilityType) ?? "",
    address: cleanText(row.address) ?? "",
    city: cleanText(row.city) ?? "",
    state: cleanText(row.state) ?? "",
    latitude: parseNumber(row.latitude, "latitude", rowNumber, errors),
    longitude: parseNumber(row.longitude, "longitude", rowNumber, errors),
    services: [],
    hours: {},
    priceInfo: {
      priceLevel: cleanText(row.priceLevel) ?? "unknown"
    },
    insuranceInfo: {},
    importDate: context.importDate,
    lastVerified: cleanText(row.lastVerified) ?? "",
    verificationStatus: cleanText(row.verificationStatus) ?? "needs_review"
  };

  assignText(facility, "stateFips", row.stateFips);
  assignText(facility, "county", row.county);
  assignText(facility, "countyFips", row.countyFips);
  assignText(facility, "phone", row.phone);
  assignText(facility, "website", row.website);
  assignText(facility, "accessibilityInfo", row.accessibilityInfo);

  facility.services = (cleanText(row.services) ?? "")
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean);

  for (const day of [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"
  ]) {
    assignText(facility.hours, day, row[day]);
  }

  assignText(facility.hours, "notes", row.hoursNotes);

  for (const field of booleanFields) {
    const parsed = parseBoolean(row[field], field, rowNumber, errors);

    if (parsed !== undefined) {
      if (field === "acceptsSlidingScale") {
        facility.priceInfo[field] = parsed;
      } else {
        facility.insuranceInfo[field] = parsed;
      }
    }
  }

  assignText(facility.priceInfo, "estimatedVisitCost", row.estimatedVisitCost);
  assignText(facility.priceInfo, "priceNotes", row.priceNotes);
  assignText(facility.insuranceInfo, "insuranceNotes", row.insuranceNotes);

  if (cleanText(row.fieldSources)) {
    try {
      facility.fieldSources = JSON.parse(row.fieldSources);
    } catch {
      facility.fieldSources = { invalid: { status: "needs_review" } };
    }
  }

  const sourceInfo = {};
  assignText(sourceInfo, "sourceName", row.sourceName);
  assignText(sourceInfo, "sourceUrl", row.sourceUrl);
  assignText(sourceInfo, "lastChecked", row.sourceLastChecked);
  assignText(sourceInfo, "notes", row.sourceNotes);

  if (Object.keys(sourceInfo).length > 0) {
    facility.sourceInfo = sourceInfo;
  }

  if (context.isPilotNjImport) {
    facility.sourceDataset = "NJ healthcare pilot";
    facility.dataCompletenessNotes =
      "New Jersey pilot import preserved source-backed fields only. Missing hours, prices, services, insurance or coordinates remain unknown.";
  }

  return facility;
}

function validateHeaders(headers) {
  const headerSet = new Set(headers);
  return requiredHeaders.filter((header) => !headerSet.has(header));
}

function printHelp() {
  console.log("Import healthcare facility CSV data.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run import:healthcare");
  console.log("  npm run import:healthcare -- path/to/facilities.csv --write");
  console.log("  npm run import:healthcare -- public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --merge --write");
  console.log("  npm run import:healthcare -- path/to/demo.csv --output=public/data/healthcare/facilities.demo.json --write");
  console.log("");
  console.log("Without --write, the script only prints a preview and does not change facilities.json.");
  console.log("Use --allow-demo-write only when intentionally writing demo/sample rows to production.");
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
  const mergedById = new Map(
    existingFacilities.map((facility) => [facility.id, facility])
  );

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

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUnknownHours(facility) {
  return (
    !facility.hours ||
    ![
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
      "notes"
    ].some((day) => hasText(facility.hours[day]))
  );
}

function hasUnknownInsurance(facility) {
  return (
    !facility.insuranceInfo ||
    (facility.insuranceInfo.acceptsMedicaid === undefined &&
      facility.insuranceInfo.acceptsMedicare === undefined &&
      facility.insuranceInfo.acceptsUninsured === undefined &&
      !hasText(facility.insuranceInfo.insuranceNotes))
  );
}

function collectValidationWarnings(facilities) {
  const warnings = [];

  for (const facility of facilities) {
    if (!facility.sourceInfo?.sourceName) {
      warnings.push(`${facility.id || "Unknown facility"} is missing sourceInfo.sourceName.`);
    }

    if (facility.verificationStatus === "verified") {
      if (!facility.sourceInfo?.sourceUrl) {
        warnings.push(`${facility.id} is verified but missing sourceInfo.sourceUrl.`);
      }

      if (!facility.sourceInfo?.lastChecked) {
        warnings.push(`${facility.id} is verified but missing sourceInfo.lastChecked.`);
      }
    }

    warnings.push(
      ...collectEnrichmentProvenanceErrors(facility, {
        label: facility.id || "Unknown facility",
        requireSourceBacked: true
      })
    );
  }

  return warnings;
}

function buildImportReport({
  args,
  commentRows,
  dataRows,
  duplicateWarnings,
  facilities,
  importDate,
  outputFacilities,
  validationWarnings
}) {
  return {
    sourceFile: path.relative(projectRoot, args.csvPath),
    outputPath: path.relative(projectRoot, args.output),
    importDate,
    dryRun: !args.write,
    merge: args.merge,
    rowsRead: dataRows.length,
    recordsNormalized: facilities.length,
    recordsWritten: args.write ? outputFacilities.length : 0,
    skippedRows: commentRows.length,
    skipped: commentRows.map((rowNumber) => ({
      rowNumber,
      reason: "Commented/template row was skipped."
    })),
    missingCoordinateCount: facilities.filter(
      (facility) => facility.latitude === undefined || facility.longitude === undefined
    ).length,
    unknownPriceCount: facilities.filter(
      (facility) =>
        !facility.priceInfo ||
        facility.priceInfo.priceLevel === "unknown" ||
        facility.priceInfo.priceLevel === undefined
    ).length,
    unknownInsuranceCount: facilities.filter(hasUnknownInsurance).length,
    unknownHoursCount: facilities.filter(hasUnknownHours).length,
    duplicateWarnings,
    validationWarnings
  };
}

function printSummary(report, facilities) {
  console.log("Healthcare facility CSV import summary");
  console.log(`Input: ${report.sourceFile}`);
  console.log(`Output: ${report.outputPath}`);
  console.log(`Rows read: ${report.rowsRead}`);
  console.log(`Records normalized: ${report.recordsNormalized}`);
  console.log(`Records skipped: ${report.skippedRows}`);
  console.log(`Missing coordinate count: ${report.missingCoordinateCount}`);
  console.log(`Unknown price count: ${report.unknownPriceCount}`);
  console.log(`Unknown insurance count: ${report.unknownInsuranceCount}`);
  console.log(`Unknown hours count: ${report.unknownHoursCount}`);

  if (report.duplicateWarnings.length > 0) {
    console.log("Duplicate warnings:");
    for (const warning of report.duplicateWarnings.slice(0, 20)) {
      console.log(`- ${warning}`);
    }
  }

  if (report.validationWarnings.length > 0) {
    console.log("Source warnings:");
    for (const warning of report.validationWarnings.slice(0, 20)) {
      console.log(`- ${warning}`);
    }
  }

  if (facilities.length > 0) {
    console.log("Preview of first converted facility:");
    console.log(JSON.stringify(facilities[0], null, 2));
  } else {
    console.log("No facility rows found. The template is ready for data entry.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const raw = await readFile(args.csvPath, "utf8");
  const rows = parseCsv(raw);
  const importDate = todayIsoDate();
  const isPilotNjImport = isPilotNjImportPath(args.csvPath);

  if (rows.length === 0) {
    throw new Error("The CSV must include a header row.");
  }

  const headers = rows[0].map((header) => header.trim());
  const missingHeaders = validateHeaders(headers);

  if (missingHeaders.length > 0) {
    throw new Error(
      `The CSV is missing required headers: ${missingHeaders.join(", ")}.`
    );
  }

  const errors = [];
  const bodyRows = rows.slice(1);
  const commentRows = bodyRows
    .map((row, index) => (row[0]?.trim().startsWith("#") ? index + 2 : null))
    .filter((rowNumber) => rowNumber !== null);
  const dataRowEntries = bodyRows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => !row[0]?.trim().startsWith("#"));
  const dataRows = dataRowEntries.map(({ row }) => row);
  const facilities = dataRowEntries.map(({ row, rowNumber }) =>
    convertRow(rowToObject(headers, row), rowNumber, errors, {
      importDate,
      isPilotNjImport
    })
  );

  if (errors.length > 0) {
    console.error("Healthcare facility CSV import failed.");
    console.error("Please fix these CSV issues:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const existingFacilities = args.merge ? await readExistingFacilities(args.output) : [];
  const duplicateWarnings = findDuplicateWarnings(facilities, existingFacilities);
  const validationWarnings = collectValidationWarnings(facilities);
  let outputFacilities = facilities;
  const writesProductionOutput = isProductionOutputPath(args.output);

  if (args.merge) {
    const mergeResult = mergeFacilities(existingFacilities, facilities);
    outputFacilities = mergeResult.facilities;
    duplicateWarnings.push(...mergeResult.warnings);
  } else if (args.write && duplicateWarnings.some((warning) => warning.includes("Duplicate id"))) {
    throw new Error("Duplicate IDs found. Use --merge to merge intentionally or fix the source CSV.");
  }

  const report = buildImportReport({
    args,
    commentRows,
    dataRows,
    duplicateWarnings,
    facilities,
    importDate,
    outputFacilities,
    validationWarnings
  });

  printSummary(report, facilities);

  if (!args.write) {
    console.log("");
    console.log("Dry run only. facilities.json was not changed.");
    console.log("Add --write to overwrite public/data/healthcare/facilities.json.");
    return;
  }

  const hasDemoRows = facilities.some(isDemoFacility);
  const hasDemoInputPath = isDemoImportPath(args.csvPath);
  const writesDemoOutput = isDemoOutputPath(args.output);

  if ((hasDemoRows || hasDemoInputPath) && writesProductionOutput && !writesDemoOutput && !args.allowDemoWrite) {
    throw new Error(
      "This import looks like demo/sample healthcare data. Production facilities.json should not contain demo records. Write demo records to facilities.demo.json with an explicit demo workflow, or rerun with --allow-demo-write only if this production write is intentional."
    );
  }

  console.log("");
  console.log(`Writing ${outputFacilities.length} facilities to ${args.output}.`);
  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(outputFacilities, null, 2)}\n`, "utf8");

  if (isPilotNjImport) {
    await mkdir(path.dirname(pilotNjImportReportPath), { recursive: true });
    await writeFile(pilotNjImportReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(
      `Wrote pilot import report to ${path.relative(projectRoot, pilotNjImportReportPath)}.`
    );
  }

  console.log("Healthcare facility import complete.");
}

main().catch((error) => {
  console.error("Healthcare facility CSV import failed.");
  console.error(error.message);
  process.exit(1);
});
