import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isWithinStateBounds,
  loadStateBounds,
  normalizeStateCode
} from "./lib/stateBounds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourceReviewsPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "imports",
  "source-reviews.json"
);
const productionFacilitiesPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);

const allowedSourceTypes = new Set([
  "official",
  "hospital_system",
  "state_open_data",
  "federal_open_data",
  "manually_collected",
  "unknown"
]);

const aliases = {
  name: ["name", "facility name", "site name", "health center site name", "organization name"],
  address: ["address", "street address", "site address", "physical address", "location address"],
  latitude: ["latitude", "lat", "site latitude", "location latitude"],
  longitude: ["longitude", "lon", "lng", "site longitude", "location longitude"],
  phone: ["phone", "phone number", "telephone", "site phone"],
  website: ["website", "url", "site url", "web site"],
  sourceUrl: ["sourceurl", "source url", "data source url", "record url", "profile url"],
  sourceName: ["sourcename", "source name", "source", "dataset", "source dataset"],
  state: ["state", "state abbreviation", "site state", "st"],
  id: ["id", "facility id", "site id", "source id"],
  price: ["pricelevel", "price level", "price", "cost", "cost notes", "fee notes", "price notes"],
  insurance: ["insurance", "insurance notes", "payer", "payer notes", "accepts medicaid", "accepts medicare", "accepts uninsured"],
  hours: ["hours", "hours notes", "operating hours", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
};
const mappedHeaders = new Set(
  [
    ...Object.values(aliases).flat(),
    "id",
    "facility type",
    "facilityType",
    "city",
    "state",
    "state fips",
    "stateFips",
    "county",
    "county fips",
    "countyFips",
    "postal code",
    "postalCode",
    "services",
    "hoursNotes",
    "priceNotes",
    "accepts sliding scale",
    "acceptsSlidingScale",
    "estimated visit cost",
    "estimatedVisitCost",
    "acceptsMedicaid",
    "acceptsMedicare",
    "acceptsUninsured",
    "insuranceNotes",
    "accessibility info",
    "accessibilityInfo",
    "source last checked",
    "sourceLastChecked",
    "source notes",
    "sourceNotes",
    "source id",
    "sourceId",
    "source dataset",
    "sourceDataset",
    "source last updated",
    "sourceLastUpdated",
    "last verified",
    "lastVerified",
    "verification status",
    "verificationStatus",
    "is demo data",
    "isDemoData",
    "field sources",
    "fieldSources",
    "enrichment sources"
  ].map(normalizeHeader)
);
function parseArgs(argv) {
  const args = {
    county: "",
    input: "",
    sourceName: "",
    sourceType: "unknown",
    state: "",
    writeReview: false
  };

  for (const arg of argv) {
    if (arg === "--write-review") {
      args.writeReview = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--input=")) {
      args.input = path.resolve(projectRoot, arg.slice("--input=".length));
    } else if (arg.startsWith("--source-name=")) {
      args.sourceName = arg.slice("--source-name=".length).trim();
    } else if (arg.startsWith("--source-type=")) {
      args.sourceType = arg.slice("--source-type=".length).trim();
    } else if (arg.startsWith("--state=")) {
      args.state = arg.slice("--state=".length).trim();
    } else if (arg.startsWith("--county=")) {
      args.county = arg.slice("--county=".length).trim();
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  return args;
}

function printHelp() {
  console.log("Review a healthcare facility source CSV before import.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run healthcare:hrsa:review-source -- --input=public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv --state=PA");
  console.log("  npm run healthcare:hrsa:review-source -- --input=public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv --state=PA --write-review");
  console.log("");
  console.log("This script never writes to facilities.json.");
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const nextChar = raw[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        cell += "\"";
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
    csvRow.some((value) => String(value ?? "").trim().length > 0)
  );
}

function normalizeHeader(header) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[()_]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : "";
}

function rowToObject(headers, row) {
  return Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ""])
  );
}

function getByAliases(row, fieldAliases) {
  for (const alias of fieldAliases) {
    const normalizedAlias = normalizeHeader(alias);

    if (Object.hasOwn(row, normalizedAlias)) {
      const value = cleanText(row[normalizedAlias]);

      if (value) {
        return value;
      }
    }
  }

  return "";
}

function hasAnyByAliases(row, fieldAliases) {
  return Boolean(getByAliases(row, fieldAliases));
}

function parseCoordinate(value) {
  const parsed = Number(cleanText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasCoordinates(row) {
  const latitude = parseCoordinate(getByAliases(row, aliases.latitude));
  const longitude = parseCoordinate(getByAliases(row, aliases.longitude));
  return (
    latitude !== undefined &&
    longitude !== undefined &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function hasPlausibleCoordinatesForState(row, bounds) {
  const latitude = parseCoordinate(getByAliases(row, aliases.latitude));
  const longitude = parseCoordinate(getByAliases(row, aliases.longitude));

  if (
    latitude === undefined ||
    longitude === undefined ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return true;
  }

  return isWithinStateBounds(latitude, longitude, bounds);
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function findDuplicateWarnings(rows, productionFacilities = []) {
  const warnings = [];
  const nameAddresses = new Map();
  const ids = new Map();

  for (const facility of productionFacilities) {
    const key = [facility.name, facility.address].map(normalizeKey).join("|");
    if (key.replace(/\|/g, "").length > 0) {
      nameAddresses.set(key, "production facilities.json");
    }
    if (facility.id) {
      ids.set(normalizeKey(facility.id), "production facilities.json");
    }
  }

  for (const row of rows) {
    const name = getByAliases(row, aliases.name);
    const address = getByAliases(row, aliases.address);
    const id = getByAliases(row, aliases.id);
    const key = [name, address].map(normalizeKey).join("|");

    if (id && ids.has(normalizeKey(id))) {
      warnings.push(`Likely duplicate id "${id}" already appears in ${ids.get(normalizeKey(id))}.`);
    } else if (id) {
      ids.set(normalizeKey(id), "this source CSV");
    }

    if (key.replace(/\|/g, "").length === 0) {
      continue;
    }

    if (nameAddresses.has(key)) {
      warnings.push(
        `Likely duplicate name/address: "${name || "Unknown name"}" at "${address || "unknown address"}" already appears in ${nameAddresses.get(key)}.`
      );
    } else {
      nameAddresses.set(key, "this source CSV");
    }
  }

  return warnings;
}

function countRows(rows, predicate) {
  return rows.filter(predicate).length;
}

function getReadinessStatus(summary, duplicateWarnings) {
  if (summary.rowsRead === 0 || summary.rowsWithNames === 0) {
    return "not_ready";
  }

  if (summary.recordsImportReady === 0) {
    return "not_ready";
  }

  if (
    summary.rowsWithNames < summary.rowsRead ||
    summary.rowsWithCoordinates < summary.rowsRead ||
    summary.rowsWithinStateBounds < summary.rowsWithCoordinates ||
    summary.rowsMatchingRequestedState < summary.rowsRead ||
    summary.rowsWithSourceInfo < summary.rowsRead ||
    duplicateWarnings.length > 0 ||
    summary.unmappedHeaders.length > 0
  ) {
    return "needs_review";
  }

  return "ready_to_import";
}

function buildIssues(summary, duplicateWarnings) {
  const issues = [];

  if (summary.rowsRead === 0) {
    issues.push({
      field: "rows",
      message: "No data rows were found in the source CSV.",
      severity: "critical"
    });
  }

  if (summary.rowsWithNames < summary.rowsRead) {
    issues.push({
      field: "name",
      message: `${summary.rowsRead - summary.rowsWithNames} row${summary.rowsRead - summary.rowsWithNames === 1 ? "" : "s"} missing facility names.`,
      severity: "critical"
    });
  }

  if (summary.rowsWithCoordinates < summary.rowsRead) {
    issues.push({
      field: "coordinates",
      message: `${summary.rowsRead - summary.rowsWithCoordinates} row${summary.rowsRead - summary.rowsWithCoordinates === 1 ? "" : "s"} missing valid coordinates.`,
      severity: "warning"
    });
  }

  if (summary.rowsWithinStateBounds < summary.rowsWithCoordinates) {
    issues.push({
      field: "coordinates",
      message: `${summary.rowsWithCoordinates - summary.rowsWithinStateBounds} row${summary.rowsWithCoordinates - summary.rowsWithinStateBounds === 1 ? "" : "s"} have coordinates outside the official ${summary.state} state boundary extent.`,
      severity: "critical"
    });
  }

  if (summary.rowsMatchingRequestedState < summary.rowsRead) {
    issues.push({
      field: "state",
      message: `${summary.rowsRead - summary.rowsMatchingRequestedState} row${summary.rowsRead - summary.rowsMatchingRequestedState === 1 ? "" : "s"} identify a state other than ${summary.state}.`,
      severity: "critical"
    });
  }

  if (summary.rowsWithSourceInfo < summary.rowsRead) {
    issues.push({
      field: "source",
      message: `${summary.rowsRead - summary.rowsWithSourceInfo} row${summary.rowsRead - summary.rowsWithSourceInfo === 1 ? "" : "s"} missing source URL or source information.`,
      severity: "warning"
    });
  }

  if (duplicateWarnings.length > 0) {
    issues.push({
      field: "duplicates",
      message: `${duplicateWarnings.length} likely duplicate name/address warning${duplicateWarnings.length === 1 ? "" : "s"} found.`,
      severity: "warning"
    });
  }

  if (summary.unmappedHeaders.length > 0) {
    issues.push({
      field: "source fields",
      message: `Unsupported CSV fields were found and will not be mapped into staged records: ${summary.unmappedHeaders.join(", ")}.`,
      severity: "warning"
    });
  }

  for (const [field, count] of [
    ["priceInfo", summary.rowsRead - summary.rowsWithPriceInfo],
    ["insuranceInfo", summary.rowsRead - summary.rowsWithInsuranceInfo],
    ["hours", summary.rowsRead - summary.rowsWithHours]
  ]) {
    if (count > 0) {
      issues.push({
        field,
        message: `${count} row${count === 1 ? "" : "s"} missing ${field}. This reduces score confidence but does not block import when marked unknown.`,
        severity: "info"
      });
    }
  }

  return issues;
}

function buildReviewRecord(args, summary, duplicateWarnings) {
  const relativeInput = path.relative(projectRoot, args.input).replace(/\\/g, "/");
  const idBase = slugify(
    [args.sourceName, args.state, args.county, path.basename(args.input)]
      .filter(Boolean)
      .join("-")
  );

  return {
    id: idBase || `source-review-${Date.now()}`,
    sourceName: args.sourceName,
    sourceFileName: relativeInput,
    sourceType: args.sourceType,
    state: args.state,
    ...(args.county ? { county: args.county } : {}),
    dateChecked: todayIsoDate(),
    recordsReviewed: summary.rowsRead,
    recordsImportReady: summary.recordsImportReady,
    missingCoordinates: summary.rowsRead - summary.rowsWithCoordinates,
    coordinatesOutsideStateBounds:
      summary.rowsWithCoordinates - summary.rowsWithinStateBounds,
    rowsWithStateMismatch: summary.rowsRead - summary.rowsMatchingRequestedState,
    stateBoundsSource: summary.stateBoundsSource,
    missingSourceUrl: summary.rowsRead - summary.rowsWithSourceInfo,
    missingPriceInfo: summary.rowsRead - summary.rowsWithPriceInfo,
    missingInsuranceInfo: summary.rowsRead - summary.rowsWithInsuranceInfo,
    missingHours: summary.rowsRead - summary.rowsWithHours,
    readinessStatus: summary.readinessStatus,
    issues: buildIssues(summary, duplicateWarnings),
    notes:
      "Source review only. Missing price, insurance or hours fields should remain unknown unless verified from the source."
  };
}

async function readSourceReviews() {
  try {
    const raw = await readFile(sourceReviewsPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeReview(review) {
  const existingReviews = await readSourceReviews();
  const matchingIndex = existingReviews.findIndex(
    (existingReview) => existingReview.id === review.id
  );
  const nextReviews =
    matchingIndex >= 0
      ? existingReviews.map((existingReview, index) =>
          index === matchingIndex ? review : existingReview
        )
      : [...existingReviews, review];

  await mkdir(path.dirname(sourceReviewsPath), { recursive: true });
  await writeFile(sourceReviewsPath, `${JSON.stringify(nextReviews, null, 2)}\n`, "utf8");
}

function printSummary(summary, duplicateWarnings) {
  console.log("Healthcare source CSV review summary");
  console.log(`Input: ${summary.inputPath}`);
  console.log(`Rows read: ${summary.rowsRead}`);
  console.log(`Rows with names: ${summary.rowsWithNames}`);
  console.log(`Rows with coordinates: ${summary.rowsWithCoordinates}`);
  console.log(`Rows within official ${summary.state} boundary extent: ${summary.rowsWithinStateBounds}`);
  console.log(`Rows matching requested state: ${summary.rowsMatchingRequestedState}`);
  console.log(`Rows with phone/website: ${summary.rowsWithContactInfo}`);
  console.log(`Rows with source URL/source info: ${summary.rowsWithSourceInfo}`);
  console.log(`Rows with price info: ${summary.rowsWithPriceInfo}`);
  console.log(`Rows with insurance info: ${summary.rowsWithInsuranceInfo}`);
  console.log(`Rows with hours: ${summary.rowsWithHours}`);
  console.log(`Likely duplicate warnings (including production): ${duplicateWarnings.length}`);
  console.log(`Unsupported/unmapped CSV fields: ${summary.unmappedHeaders.length}`);
  console.log(`Recommended readiness status: ${summary.readinessStatus}`);

  if (duplicateWarnings.length > 0) {
    console.log("Duplicate warnings:");
    for (const warning of duplicateWarnings.slice(0, 20)) {
      console.log(`- ${warning}`);
    }
  }

  if (summary.unmappedHeaders.length > 0) {
    console.log("Unsupported/unmapped CSV fields:");
    for (const header of summary.unmappedHeaders) {
      console.log(`- ${header}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.input) {
    throw new Error("Missing --input=path/to/file.csv.");
  }

  if (!args.sourceName) {
    throw new Error("Missing --source-name=\"...\".");
  }

  if (!allowedSourceTypes.has(args.sourceType)) {
    throw new Error(
      `Unsupported --source-type "${args.sourceType}". Use one of: ${[
        ...allowedSourceTypes
      ].join(", ")}.`
    );
  }

  if (!args.state) {
    throw new Error("Missing --state=XX (for example, --state=NJ, --state=PA or --state=NY).");
  }

  args.state = normalizeStateCode(args.state);
  const stateBounds = await loadStateBounds(projectRoot, args.state);

  const raw = await readFile(args.input, "utf8");
  const rows = parseCsv(raw);

  if (rows.length === 0) {
    throw new Error("The CSV must include a header row.");
  }

  const headers = rows[0].map(normalizeHeader);
  const unmappedHeaders = headers.filter((header) => !mappedHeaders.has(header));
  const dataRows = rows
    .slice(1)
    .filter((row) => !row[0]?.trim().startsWith("#"))
    .map((row) => rowToObject(headers, row));
  const productionFacilities = JSON.parse(await readFile(productionFacilitiesPath, "utf8"));
  const duplicateWarnings = findDuplicateWarnings(dataRows, productionFacilities);
  const rowsWithNames = countRows(dataRows, (row) => hasAnyByAliases(row, aliases.name));
  const rowsWithCoordinates = countRows(dataRows, hasCoordinates);
  const rowsWithSourceInfo = countRows(
    dataRows,
    (row) => hasAnyByAliases(row, aliases.sourceUrl) || hasAnyByAliases(row, aliases.sourceName)
  );
  const summary = {
    inputPath: path.relative(projectRoot, args.input).replace(/\\/g, "/"),
    rowsRead: dataRows.length,
    rowsWithNames,
    rowsWithCoordinates,
    rowsWithinStateBounds: countRows(
      dataRows,
      (row) => hasCoordinates(row) && hasPlausibleCoordinatesForState(row, stateBounds)
    ),
    rowsMatchingRequestedState: countRows(dataRows, (row) => {
      const rowState = normalizeStateCode(getByAliases(row, aliases.state));
      return !rowState || rowState === args.state;
    }),
    rowsWithContactInfo: countRows(
      dataRows,
      (row) => hasAnyByAliases(row, aliases.phone) || hasAnyByAliases(row, aliases.website)
    ),
    rowsWithSourceInfo,
    rowsWithPriceInfo: countRows(dataRows, (row) => hasAnyByAliases(row, aliases.price)),
    rowsWithInsuranceInfo: countRows(dataRows, (row) => hasAnyByAliases(row, aliases.insurance)),
    rowsWithHours: countRows(dataRows, (row) => hasAnyByAliases(row, aliases.hours)),
    recordsImportReady: countRows(
      dataRows,
      (row) => {
        const rowState = normalizeStateCode(getByAliases(row, aliases.state));
        return (
          hasAnyByAliases(row, aliases.name) &&
          hasCoordinates(row) &&
          hasPlausibleCoordinatesForState(row, stateBounds) &&
          (!rowState || rowState === args.state) &&
          (hasAnyByAliases(row, aliases.sourceUrl) || hasAnyByAliases(row, aliases.sourceName))
        );
      }
    ),
    readinessStatus: "not_ready",
    stateBoundsSource: stateBounds.sourceFile
  };
  summary.state = args.state;
  summary.unmappedHeaders = unmappedHeaders;
  summary.readinessStatus = getReadinessStatus(summary, duplicateWarnings);

  printSummary(summary, duplicateWarnings);

  if (!args.writeReview) {
    console.log("");
    console.log("Dry review only. source-reviews.json was not changed.");
    return;
  }

  const review = buildReviewRecord(args, summary, duplicateWarnings);
  await writeReview(review);
  console.log("");
  console.log(`Wrote source review ${review.id} to ${path.relative(projectRoot, sourceReviewsPath)}.`);
}

main().catch((error) => {
  console.error("Healthcare source CSV review failed.");
  console.error(error.message);
  process.exit(1);
});
