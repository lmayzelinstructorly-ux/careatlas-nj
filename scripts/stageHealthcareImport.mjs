import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isWithinStateBounds,
  loadStateBounds,
  normalizeStateCode
} from "./lib/stateBounds.mjs";
import {
  collectEnrichmentProvenanceErrors,
  hasEnrichmentValue
} from "./lib/healthcareEnrichmentProvenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultOutputPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "staging",
  "facilities.staged.json"
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
const allowedFacilityTypes = new Set([
  "hospital",
  "clinic",
  "urgent_care",
  "community_health_center",
  "pharmacy",
  "mental_health",
  "dental",
  "other"
]);
const allowedPriceLevels = new Set(["free", "low_cost", "standard", "unknown"]);
const allowedVerificationStatuses = new Set([
  "verified",
  "needs_review",
  "unverified",
  "demo"
]);
const booleanFields = new Set([
  "acceptsSlidingScale",
  "acceptsMedicaid",
  "acceptsMedicare",
  "acceptsUninsured"
]);
const demoPattern = /(^|[^a-z])(demo|sample|test|placeholder|fake)([^a-z]|$)/i;
const aliases = {
  id: ["id", "facility id", "site id", "source id"],
  name: ["name", "facility name", "site name", "health center site name", "organization name"],
  facilityType: ["facilitytype", "facility type", "type"],
  address: ["address", "street address", "site address", "physical address", "location address"],
  city: ["city", "site city", "location city"],
  state: ["state", "state abbreviation", "site state", "st"],
  stateFips: ["statefips", "state fips"],
  county: ["county", "county name", "site county"],
  countyFips: ["countyfips", "county fips"],
  postalCode: ["postalcode", "postal code", "zip", "zip code", "zipcode"],
  latitude: ["latitude", "lat", "site latitude", "location latitude"],
  longitude: ["longitude", "lon", "lng", "site longitude", "location longitude"],
  phone: ["phone", "phone number", "telephone", "site phone"],
  website: ["website", "url", "site url", "web site"],
  services: ["services", "service", "service type", "service area"],
  hoursNotes: ["hoursnotes", "hours notes", "hours", "operating hours"],
  priceLevel: ["pricelevel", "price level", "price"],
  acceptsSlidingScale: ["acceptsslidingscale", "accepts sliding scale", "sliding scale"],
  estimatedVisitCost: ["estimatedvisitcost", "estimated visit cost"],
  priceNotes: ["pricenotes", "price notes", "cost notes", "fee notes"],
  acceptsMedicaid: ["acceptsmedicaid", "accepts medicaid", "medicaid"],
  acceptsMedicare: ["acceptsmedicare", "accepts medicare", "medicare"],
  acceptsUninsured: ["acceptsuninsured", "accepts uninsured", "uninsured"],
  insuranceNotes: ["insurancenotes", "insurance notes", "insurance", "payer notes"],
  accessibilityInfo: ["accessibilityinfo", "accessibility info", "accessibility"],
  sourceName: ["sourcename", "source name", "source", "dataset", "source dataset"],
  sourceUrl: ["sourceurl", "source url", "data source url", "record url", "profile url"],
  sourceLastChecked: ["sourcelastchecked", "source last checked", "last checked"],
  sourceNotes: ["sourcenotes", "source notes"],
  sourceId: ["sourceid", "source id"],
  sourceDataset: ["sourcedataset", "source dataset", "dataset", "program"],
  sourceLastUpdated: ["sourcelastupdated", "source last updated", "last updated", "date updated"],
  lastVerified: ["lastverified", "last verified"],
  verificationStatus: ["verificationstatus", "verification status"],
  isDemoData: ["isdemodata", "is demo data", "demo data"],
  fieldSources: ["fieldsources", "field sources", "enrichment sources"]
};
const mappedHeaders = new Set([
  ...Object.values(aliases).flat().map(normalizeHeader),
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
]);

function parseArgs(argv) {
  const args = {
    allowDemo: false,
    input: "",
    output: defaultOutputPath,
    replace: false,
    sourceName: "",
    sourceType: "unknown",
    state: "",
    write: false
  };

  for (const arg of argv) {
    if (arg === "--write") {
      args.write = true;
    } else if (arg === "--replace") {
      args.replace = true;
    } else if (arg === "--allow-demo") {
      args.allowDemo = true;
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
    } else if (arg.startsWith("--output=")) {
      args.output = path.resolve(projectRoot, arg.slice("--output=".length));
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  return args;
}

function printHelp() {
  console.log("Stage source-backed healthcare facility CSV records for review.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run healthcare:hrsa:stage -- --input=public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv --state=PA");
  console.log("  npm run healthcare:hrsa:stage -- --input=public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv --state=PA --write");
  console.log("");
  console.log("Without --write this is a dry run. Use --replace only when intentionally replacing the staging file.");
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

function parseNumber(value) {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getCoordinateStatus(row) {
  const latitudeText = getByAliases(row, aliases.latitude);
  const longitudeText = getByAliases(row, aliases.longitude);
  const hasLatitudeText = hasText(latitudeText);
  const hasLongitudeText = hasText(longitudeText);
  const latitude = parseNumber(latitudeText);
  const longitude = parseNumber(longitudeText);

  return {
    hasCoordinateText: hasLatitudeText || hasLongitudeText,
    hasIncompleteCoordinateText: hasLatitudeText !== hasLongitudeText,
    hasInvalidCoordinateText:
      (hasLatitudeText && latitude === undefined) ||
      (hasLongitudeText && longitude === undefined),
    latitude,
    longitude
  };
}

function parseBoolean(value) {
  const normalized = cleanText(value).toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["true", "yes", "y", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function addText(target, key, value) {
  const text = cleanText(value);

  if (text) {
    target[key] = text;
  }
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidCoordinates(facility) {
  return (
    typeof facility.latitude === "number" &&
    Number.isFinite(facility.latitude) &&
    facility.latitude >= -90 &&
    facility.latitude <= 90 &&
    typeof facility.longitude === "number" &&
    Number.isFinite(facility.longitude) &&
    facility.longitude >= -180 &&
    facility.longitude <= 180
  );
}

function hasCoordinatePair(facility) {
  return facility.latitude !== undefined && facility.longitude !== undefined;
}

function hasPlausibleCoordinatesForState(facility, bounds) {
  if (!hasValidCoordinates(facility)) {
    return true;
  }

  return isWithinStateBounds(facility.latitude, facility.longitude, bounds);
}

function hasUnknownHours(facility) {
  return (
    !facility.hours ||
    !["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "notes"].some(
      (day) => hasText(facility.hours[day])
    )
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

function isDemoLookingText(...parts) {
  return demoPattern.test(parts.filter(Boolean).join(" "));
}

function createStableFacilityId(row, context) {
  const explicitId = getByAliases(row, aliases.id);

  if (explicitId) {
    return slugify(explicitId);
  }

  const sourceId = getByAliases(row, aliases.sourceId);

  if (sourceId) {
    return `${slugify(context.sourceName)}-${slugify(sourceId)}`;
  }

  return [
    slugify(context.state || getByAliases(row, aliases.state) || "unknown"),
    slugify(getByAliases(row, aliases.name) || "unnamed"),
    slugify(getByAliases(row, aliases.city) || "unknown-city"),
    slugify(getByAliases(row, aliases.postalCode) || "nozip")
  ]
    .filter(Boolean)
    .join("-");
}

function normalizeFacility(row, context) {
  const facilityType = getByAliases(row, aliases.facilityType) || "other";
  const priceLevel = getByAliases(row, aliases.priceLevel) || "unknown";
  const verificationStatus =
    getByAliases(row, aliases.verificationStatus) || "needs_review";
  const latitude = parseNumber(getByAliases(row, aliases.latitude));
  const longitude = parseNumber(getByAliases(row, aliases.longitude));
  const facility = {
    id: createStableFacilityId(row, context),
    name: getByAliases(row, aliases.name),
    facilityType,
    address: getByAliases(row, aliases.address),
    city: getByAliases(row, aliases.city),
    state: getByAliases(row, aliases.state) || context.state,
    services: [],
    hours: {},
    priceInfo: {
      priceLevel: allowedPriceLevels.has(priceLevel) ? priceLevel : "unknown"
    },
    insuranceInfo: {},
    importDate: context.importDate,
    verificationStatus
  };

  for (const [targetKey, aliasKey] of [
    ["stateFips", "stateFips"],
    ["county", "county"],
    ["countyFips", "countyFips"],
    ["postalCode", "postalCode"],
    ["phone", "phone"],
    ["website", "website"],
    ["accessibilityInfo", "accessibilityInfo"],
    ["sourceId", "sourceId"],
    ["sourceDataset", "sourceDataset"],
    ["sourceLastUpdated", "sourceLastUpdated"],
    ["lastVerified", "lastVerified"]
  ]) {
    addText(facility, targetKey, getByAliases(row, aliases[aliasKey]));
  }

  if (latitude !== undefined && longitude !== undefined) {
    facility.latitude = latitude;
    facility.longitude = longitude;
  }

  const servicesText = getByAliases(row, aliases.services);
  facility.services = servicesText
    ? servicesText.split(/[;,|]/).map((service) => service.trim()).filter(Boolean)
    : [];

  for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
    addText(facility.hours, day, getByAliases(row, [day]));
  }
  addText(facility.hours, "notes", getByAliases(row, aliases.hoursNotes));

  for (const field of booleanFields) {
    const parsed = parseBoolean(getByAliases(row, aliases[field]));

    if (parsed !== undefined) {
      if (field === "acceptsSlidingScale") {
        facility.priceInfo[field] = parsed;
      } else {
        facility.insuranceInfo[field] = parsed;
      }
    }
  }

  const isDemoData = parseBoolean(getByAliases(row, aliases.isDemoData));

  if (isDemoData !== undefined) {
    facility.isDemoData = isDemoData;
  }

  addText(facility.priceInfo, "estimatedVisitCost", getByAliases(row, aliases.estimatedVisitCost));
  addText(facility.priceInfo, "priceNotes", getByAliases(row, aliases.priceNotes));
  addText(facility.insuranceInfo, "insuranceNotes", getByAliases(row, aliases.insuranceNotes));

  const sourceInfo = {};
  addText(sourceInfo, "sourceName", getByAliases(row, aliases.sourceName) || context.sourceName);
  addText(sourceInfo, "sourceUrl", getByAliases(row, aliases.sourceUrl));
  addText(sourceInfo, "lastChecked", getByAliases(row, aliases.sourceLastChecked) || context.importDate);
  addText(sourceInfo, "notes", getByAliases(row, aliases.sourceNotes));

  if (Object.keys(sourceInfo).length > 0) {
    facility.sourceInfo = sourceInfo;
  }

  const fieldSourcesText = getByAliases(row, aliases.fieldSources);
  if (fieldSourcesText) {
    try {
      facility.fieldSources = JSON.parse(fieldSourcesText);
    } catch {
      facility.fieldSources = { invalid: { status: "needs_review" } };
    }
  }

  facility.dataCompletenessNotes =
    "Staged import preserved source-backed fields only. Missing hours, prices, services, insurance or coordinates remain unknown.";

  return facility;
}

function makeIssue(code, field, message, severity) {
  return { code, field, message, severity };
}

function collectStagingIssues(facility, duplicateWarning, context = {}) {
  const issues = [];
  const coordinateStatus = context.coordinateStatus ?? {};

  if (!hasText(facility.name)) {
    issues.push(makeIssue("missing_name", "name", "Facility name is missing.", "blocker"));
  }

  if (!hasText(facility.address)) {
    issues.push(makeIssue("missing_address", "address", "Facility street address is missing from the source.", "blocker"));
  }

  if (coordinateStatus.hasInvalidCoordinateText || coordinateStatus.hasIncompleteCoordinateText) {
    issues.push(makeIssue("invalid_coordinates", "coordinates", "Coordinate fields are incomplete or cannot be parsed as numbers.", "blocker"));
  } else if (!hasCoordinatePair(facility)) {
    issues.push(makeIssue("missing_coordinates", "coordinates", "Valid map coordinates are missing.", "warning"));
  } else if (!hasValidCoordinates(facility)) {
    issues.push(makeIssue("invalid_coordinates", "coordinates", "Coordinates are invalid and cannot be used for map display.", "blocker"));
  } else if (!hasPlausibleCoordinatesForState(facility, context.stateBounds)) {
    issues.push(makeIssue("coordinates_outside_state_bounds", "coordinates", `Coordinates are outside the official ${context.state} state boundary extent. Verify the state and coordinates against the official source before approval.`, "blocker"));
  }

  if (normalizeStateCode(facility.state) !== normalizeStateCode(context.state)) {
    issues.push(makeIssue("state_mismatch", "state", `Source row state "${facility.state || "missing"}" does not match requested state ${context.state}.`, "blocker"));
  }

  if (!hasText(facility.sourceInfo?.sourceName) && !hasText(facility.sourceInfo?.sourceUrl)) {
    issues.push(makeIssue("missing_source_information", "sourceInfo", "Source name or source URL is missing.", "warning"));
  }

  if (!facility.priceInfo || facility.priceInfo.priceLevel === "unknown") {
    issues.push(makeIssue("unknown_price_info", "priceInfo", "Price information is unknown.", "info"));
  }

  if (hasUnknownInsurance(facility)) {
    issues.push(makeIssue("unknown_insurance_info", "insuranceInfo", "Insurance information is unknown.", "info"));
  }

  if (hasUnknownHours(facility)) {
    issues.push(makeIssue("unknown_hours", "hours", "Hours are unknown.", "info"));
  }

  if (duplicateWarning) {
    issues.push(makeIssue("possible_duplicate", "duplicates", duplicateWarning, "warning"));
  }

  if (
    facility.isDemoData === true ||
    facility.verificationStatus === "demo" ||
    isDemoLookingText(
      facility.id,
      facility.name,
      facility.sourceDataset,
      facility.sourceInfo?.sourceName,
      facility.sourceInfo?.notes
    )
  ) {
    issues.push(makeIssue("demo_looking_record", "demo", "Record looks like demo/sample data.", "blocker"));
  }

  if (!allowedFacilityTypes.has(facility.facilityType)) {
    issues.push(makeIssue("invalid_facility_type", "facilityType", `Facility type "${facility.facilityType}" is not allowed.`, "blocker"));
  }

  if (!allowedVerificationStatuses.has(facility.verificationStatus)) {
    issues.push(makeIssue("invalid_verification_status", "verificationStatus", `Verification status "${facility.verificationStatus}" is not allowed.`, "blocker"));
  }

  const provenanceErrors = collectEnrichmentProvenanceErrors(facility, {
    label: "facility",
    requireSourceBacked: false
  });

  for (const provenanceError of provenanceErrors) {
    const issueCode = provenanceError.includes("banned") || provenanceError.includes("unsupported")
      ? "invalid_field_sources"
      : "enrichment_needs_review";
    issues.push(makeIssue(issueCode, "fieldSources", provenanceError, "blocker"));
  }

  if (facility.fieldSources && typeof facility.fieldSources === "object") {
    for (const [field, source] of Object.entries(facility.fieldSources)) {
      if (source?.status === "needs_review" && hasEnrichmentValue(facility, field)) {
        issues.push(
          makeIssue(
            "enrichment_needs_review",
            "fieldSources",
            `Enrichment for "${field}" has field-level provenance but still needs reviewer approval before promotion.`,
            "blocker"
          )
        );
      }
    }
  }

  if (Array.isArray(context.unmappedHeaders) && context.unmappedHeaders.length > 0) {
    issues.push(makeIssue("unmapped_source_fields", "sourceFile", `Source file includes unsupported fields that were not mapped into the healthcare schema: ${context.unmappedHeaders.join(", ")}.`, "info"));
  }

  return issues;
}

function createNameAddressKey(facility) {
  return [facility.name, facility.address, facility.city, facility.state]
    .map(slugify)
    .join("|");
}

function buildDuplicateWarnings(facilities, existingStagedRecords, productionFacilities) {
  const warningByFacilityId = new Map();
  const ids = new Map();
  const nameAddresses = new Map();

  function visit(facility, label, isIncoming) {
    if (hasText(facility.id)) {
      const prior = ids.get(facility.id);

      if (prior && isIncoming) {
        warningByFacilityId.set(
          facility.id,
          `Possible duplicate id "${facility.id}" also appears in ${prior}.`
        );
      }

      if (!prior) {
        ids.set(facility.id, label);
      }
    }

    const key = createNameAddressKey(facility);

    if (key.replace(/\|/g, "").length === 0) {
      return;
    }

    const prior = nameAddresses.get(key);

    if (prior && isIncoming) {
      warningByFacilityId.set(
        facility.id,
        `Possible duplicate name/address for "${facility.name || "Unknown facility"}" also appears in ${prior}.`
      );
    }

    if (!prior) {
      nameAddresses.set(key, label);
    }
  }

  for (const facility of productionFacilities) {
    visit(facility, "production facilities.json", false);
  }

  for (const stagedRecord of existingStagedRecords) {
    if (stagedRecord?.facility) {
      visit(stagedRecord.facility, "existing staging file", false);
    }
  }

  for (const facility of facilities) {
    visit(facility, "current import", true);
  }

  return warningByFacilityId;
}

function getMissingFieldSummary(facility) {
  const missing = [];

  for (const [label, isMissing] of [
    ["name", !hasText(facility.name)],
    ["coordinates", !hasValidCoordinates(facility)],
    ["source information", !hasText(facility.sourceInfo?.sourceName) && !hasText(facility.sourceInfo?.sourceUrl)],
    ["price information", !facility.priceInfo || facility.priceInfo.priceLevel === "unknown"],
    ["insurance information", hasUnknownInsurance(facility)],
    ["hours", hasUnknownHours(facility)]
  ]) {
    if (isMissing) {
      missing.push(label);
    }
  }

  return missing;
}

function createStagingId(facility, sourceName, rowNumber) {
  return `staged-${slugify(sourceName || "source")}-${slugify(facility.id || facility.name || "record")}-${rowNumber}`;
}

function ensureUniqueStagingIds(records) {
  const seen = new Map();

  return records.map((record) => {
    const currentCount = seen.get(record.stagingId) ?? 0;
    seen.set(record.stagingId, currentCount + 1);

    if (currentCount === 0) {
      return record;
    }

    return {
      ...record,
      stagingId: `${record.stagingId}-${currentCount + 1}`
    };
  });
}

async function readJsonArray(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function printSummary({ args, skippedDemoRows, stagedRecords }) {
  const issueCounts = stagedRecords.reduce((counts, record) => {
    for (const issue of record.stagingIssues) {
      counts[issue.code] = (counts[issue.code] ?? 0) + 1;
    }

    return counts;
  }, {});

  console.log("Healthcare staging import summary");
  console.log(`Input: ${path.relative(projectRoot, args.input).replace(/\\/g, "/")}`);
  console.log(`Output: ${path.relative(projectRoot, args.output).replace(/\\/g, "/")}`);
  console.log(`Records staged for review: ${stagedRecords.length}`);
  console.log(`Demo/sample-looking rows skipped: ${skippedDemoRows.length}`);
  console.log(`Possible duplicates: ${issueCounts.possible_duplicate ?? 0}`);
  console.log(`Missing coordinates: ${issueCounts.missing_coordinates ?? 0}`);
  console.log(`Coordinates outside state bounds: ${issueCounts.coordinates_outside_state_bounds ?? 0}`);
  console.log(`Rows with state mismatch: ${issueCounts.state_mismatch ?? 0}`);
  console.log(`Missing source metadata: ${issueCounts.missing_source_information ?? 0}`);
  console.log(`Unknown price info: ${issueCounts.unknown_price_info ?? 0}`);
  console.log(`Unknown insurance info: ${issueCounts.unknown_insurance_info ?? 0}`);
  console.log(`Unknown hours: ${issueCounts.unknown_hours ?? 0}`);
  console.log(`Enrichment provenance blockers: ${(issueCounts.invalid_field_sources ?? 0) + (issueCounts.enrichment_needs_review ?? 0)}`);

  if (skippedDemoRows.length > 0) {
    console.log("Skipped demo/sample-looking rows:");
    for (const skipped of skippedDemoRows.slice(0, 20)) {
      console.log(`- Row ${skipped.rowNumber}: ${skipped.reason}`);
    }
  }

  if (stagedRecords.length > 0) {
    console.log("Preview of first staged record:");
    console.log(JSON.stringify(stagedRecords[0], null, 2));
  } else {
    console.log("No staged records were created.");
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
    throw new Error(`Unsupported --source-type "${args.sourceType}".`);
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

  const importDate = new Date().toISOString().slice(0, 10);
  const headers = rows[0].map(normalizeHeader);
  const unmappedHeaders = headers.filter((header) => !mappedHeaders.has(header));
  const dataRows = rows
    .slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => !row[0]?.trim().startsWith("#"));
  const context = {
    importDate,
    sourceName: args.sourceName,
    state: args.state
  };
  const normalizedRows = dataRows.map(({ row, rowNumber }) => {
    const rowObject = rowToObject(headers, row);

    return {
      facility: normalizeFacility(rowObject, context),
      coordinateStatus: getCoordinateStatus(rowObject),
      rowNumber
    };
  });
  const existingStagedRecords = args.replace ? [] : await readJsonArray(args.output);
  const productionFacilities = await readJsonArray(productionFacilitiesPath);
  const duplicateWarnings = buildDuplicateWarnings(
    normalizedRows.map(({ facility }) => facility),
    existingStagedRecords,
    productionFacilities
  );
  const skippedDemoRows = [];
  const stagedRecords = [];
  const relativeInput = path.relative(projectRoot, args.input).replace(/\\/g, "/");

  for (const { facility, coordinateStatus, rowNumber } of normalizedRows) {
    const demoLooking =
      isDemoLookingText(relativeInput, facility.id, facility.name, facility.sourceInfo?.notes) ||
      facility.isDemoData === true ||
      facility.verificationStatus === "demo";

    if (demoLooking && !args.allowDemo) {
      skippedDemoRows.push({
        rowNumber,
        reason: "Record or input path looks like demo/sample data. Rerun with --allow-demo only for intentional demo staging."
      });
      continue;
    }

    const duplicateWarning = duplicateWarnings.get(facility.id);
    const issues = collectStagingIssues(facility, duplicateWarning, {
      state: args.state,
      stateBounds,
      coordinateStatus,
      unmappedHeaders
    });
    const record = {
      stagingId: createStagingId(facility, args.sourceName, rowNumber),
      facility,
      stagingStatus: issues.some((issue) => issue.severity === "blocker")
        ? "needs_more_source_info"
        : "pending_review",
      stagingIssues: issues,
      sourceFile: relativeInput,
      sourceName: args.sourceName,
      sourceType: args.sourceType,
      state: args.state,
      importDate,
      ...(duplicateWarning ? { duplicateWarning } : {}),
      ...(unmappedHeaders.length > 0 ? { unmappedSourceFields: unmappedHeaders } : {}),
      missingFieldSummary: getMissingFieldSummary(facility)
    };

    stagedRecords.push(record);
  }

  const stagedRecordsWithUniqueIds = ensureUniqueStagingIds(stagedRecords);
  printSummary({ args, skippedDemoRows, stagedRecords: stagedRecordsWithUniqueIds });

  if (!args.write) {
    console.log("");
    console.log("Dry run only. facilities.staged.json was not changed.");
    console.log("Add --write to save staged records.");
    return;
  }

  const outputRecords = args.replace
    ? stagedRecordsWithUniqueIds
    : ensureUniqueStagingIds([...existingStagedRecords, ...stagedRecordsWithUniqueIds]);

  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(outputRecords, null, 2)}\n`, "utf8");
  console.log("");
  console.log(`Wrote ${stagedRecordsWithUniqueIds.length} new staged records to ${path.relative(projectRoot, args.output).replace(/\\/g, "/")}.`);
}

main().catch((error) => {
  console.error("Healthcare staging import failed.");
  console.error(error.message);
  process.exit(1);
});
