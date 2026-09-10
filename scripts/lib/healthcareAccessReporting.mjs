import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFieldSourceErrors } from "./healthcareEnrichmentProvenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..", "..");
export const facilitiesPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
export const tmpDirectory = path.join(projectRoot, "tmp");


export const accessCategoryFields = [
  "services",
  "hours",
  "insurance",
  "cost",
  "accessibility"
];

export const categoryLabels = {
  accessibility: "accessibility",
  cost: "cost and price",
  hours: "daily hours",
  insurance: "insurance",
  services: "services"
};

export const rawFieldByCategory = {
  accessibility: "accessibilityInfo",
  cost: "priceInfo",
  hours: "hours",
  insurance: "insuranceInfo",
  services: "services"
};

export const dayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

export function toProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll("\\", "/");
}

export function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasListedValue(value) {
  return (
    hasText(value) &&
    !/(unknown|not listed|not available|tbd|to be verified)/i.test(value)
  );
}

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isValidLatitude(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

export function isValidLongitude(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

export function hasValidCoordinates(facility) {
  return isValidLatitude(facility.latitude) && isValidLongitude(facility.longitude);
}

export function hasNamedSource(facility) {
  return hasText(facility.sourceInfo?.sourceName ?? facility.sourceDataset);
}

export function hasCompleteSourceInfo(facility) {
  return (
    hasText(facility.sourceInfo?.sourceName) &&
    hasText(facility.sourceInfo?.sourceUrl) &&
    hasText(facility.sourceInfo?.lastChecked)
  );
}

export function hasContactPath(facility) {
  return hasText(facility.phone) || hasText(facility.website);
}

export function hasUsableFacilityWebsiteOrSourcePath(facility) {
  return hasText(facility.website) || hasText(facility.sourceInfo?.sourceUrl);
}

export function isDemoRecord(facility) {
  if (facility.isDemoData === true || facility.verificationStatus === "demo") {
    return true;
  }

  return /(^|[^a-z])(demo|sample|test|placeholder|fake)([^a-z]|$)/i.test(
    [
      facility.id,
      facility.name,
      facility.sourceDataset,
      facility.sourceInfo?.sourceName,
      facility.sourceInfo?.notes,
      facility.dataCompletenessNotes
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function hasRawValue(facility, field) {
  if (field === "services") {
    return Array.isArray(facility.services) && facility.services.some(hasListedValue);
  }

  if (field === "hours") {
    return (
      isObject(facility.hours) &&
      dayKeys.some((day) => hasListedValue(facility.hours?.[day]))
    );
  }

  if (field === "insurance") {
    const insuranceInfo = facility.insuranceInfo;

    return Boolean(
      isObject(insuranceInfo) &&
        (insuranceInfo.acceptsMedicaid !== undefined ||
          insuranceInfo.acceptsMedicare !== undefined ||
          insuranceInfo.acceptsUninsured !== undefined ||
          hasListedValue(insuranceInfo.insuranceNotes))
    );
  }

  if (field === "cost") {
    const priceInfo = facility.priceInfo;

    return Boolean(
      isObject(priceInfo) &&
        (priceInfo.priceLevel !== "unknown" ||
          priceInfo.acceptsSlidingScale !== undefined ||
          hasListedValue(priceInfo.estimatedVisitCost) ||
          hasListedValue(priceInfo.priceNotes))
    );
  }

  if (field === "accessibility") {
    return hasListedValue(facility.accessibilityInfo);
  }

  return false;
}

export function hasValidFieldSource(facility, field) {
  const source = facility.fieldSources?.[field];

  return Boolean(
    source &&
      source.status === "source_backed" &&
      hasText(source.sourceUrl) &&
      hasText(source.checkedDate) &&
      (hasText(source.sourceTitle) || hasText(source.sourceLabel)) &&
      source.locationSpecific === true
  );
}

export function getFieldSourceIssues(facility, field) {
  const source = facility.fieldSources?.[field];
  const issues = [];

  if (!hasRawValue(facility, field)) {
    if (source !== undefined) {
      issues.push(`fieldSources.${field} is present but ${field} has no raw value.`);
    }

    return issues;
  }

  if (source === undefined) {
    return [`fieldSources.${field} is missing for existing ${field} raw data.`];
  }

  return collectFieldSourceErrors(field, source, {
    requireSourceBacked: true
  });
}

export function getAccessCategoryDiagnostics(facility, categoryCoverage = {}) {
  return accessCategoryFields.map((field) => {
    const source = facility.fieldSources?.[field];
    const rawValuePresent = hasRawValue(facility, field);
    const validFieldSource = hasValidFieldSource(facility, field);

    return {
      field,
      label: categoryLabels[field],
      rawField: rawFieldByCategory[field],
      rawValuePresent,
      validFieldSource,
      usableForScoreTrust: categoryCoverage[field] === true,
      fieldSourceStatus: source?.status ?? null,
      fieldSourceUrl: source?.sourceUrl ?? null,
      fieldSourceCheckedDate: source?.checkedDate ?? null,
      fieldSourceIssues: getFieldSourceIssues(facility, field)
    };
  });
}

export function summarizeCategoryGaps(facility, categoryCoverage = {}) {
  const diagnostics = getAccessCategoryDiagnostics(facility, categoryCoverage);

  return {
    diagnostics,
    missingAccessCategories: diagnostics
      .filter((item) => !item.usableForScoreTrust)
      .map((item) => item.field),
    missingRawFields: diagnostics
      .filter((item) => !item.rawValuePresent)
      .map((item) => ({
        field: item.field,
        rawField: item.rawField,
        label: item.label
      })),
    rawValuePresentButFieldSourcesMissingOrInvalid: diagnostics
      .filter((item) => item.rawValuePresent && !item.validFieldSource)
      .map((item) => ({
        field: item.field,
        rawField: item.rawField,
        label: item.label,
        fieldSourceIssues: item.fieldSourceIssues
      })),
    missingOrInvalidFieldSources: diagnostics
      .filter((item) => item.fieldSourceIssues.length > 0)
      .map((item) => ({
        field: item.field,
        rawField: item.rawField,
        label: item.label,
        issues: item.fieldSourceIssues
      }))
  };
}

export function getCriticalIssuesExceptVerification(qualityAudit) {
  return qualityAudit.issues.filter(
    (issue) => issue.severity === "critical" && issue.field !== "verificationStatus"
  );
}

export function uniqueItems(items) {
  return [...new Set(items.filter(hasText))];
}

export function countBy(items, getKey) {
  const counts = {};

  for (const item of items) {
    const key = getKey(item) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

export function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = Array.isArray(value)
    ? value.join("; ")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function buildCsv(rows, columns) {
  return [
    columns.map((column) => csvEscape(column.header)).join(","),
    ...rows.map((row) =>
      columns
        .map((column) => csvEscape(column.value ? column.value(row) : row[column.key]))
        .join(",")
    )
  ].join("\n");
}

export async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function writeCsv(filePath, rows, columns) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${buildCsv(rows, columns)}\n`, "utf8");
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function readFacilities(filePath = facilitiesPath) {
  const facilities = await readJson(filePath);

  if (!Array.isArray(facilities)) {
    throw new Error(`${toProjectPath(filePath)} must contain a JSON array.`);
  }

  return facilities;
}

export async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}
