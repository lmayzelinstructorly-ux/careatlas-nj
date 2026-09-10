import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  facilitiesPath,
  hasText,
  isObject,
  projectRoot,
  readFacilities,
  sha256File,
  tmpDirectory,
  toProjectPath,
  writeJson
} from "./lib/healthcareAccessReporting.mjs";
import {
  allowedFieldSourceTypes,
  bannedFieldSourceTypes
} from "./lib/healthcareEnrichmentProvenance.mjs";

const reviewedDirectory = path.join(tmpDirectory, "provider-review-packets", "reviewed");
const outputInputPath = path.join(tmpDirectory, "provider-reviewed-healthcare-enrichment-input.json");
const outputPlanPath = path.join(tmpDirectory, "provider-reviewed-healthcare-enrichment-plan.json");
const outputReportPath = path.join(tmpDirectory, "provider-reviewed-healthcare-enrichment-report.json");

const npmCliPath =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

const reviewFields = ["services", "hours", "insurance", "cost", "accessibility"];
const sourceApplicabilityValues = new Set([
  "single_location",
  "all_listed_locations",
  "organization_wide_policy"
]);
const organizationWideAllowedFields = new Set(["cost", "insurance"]);
const fieldValueKeys = {
  accessibility: "accessibilityInfo",
  cost: "priceInfo",
  hours: "hours",
  insurance: "insuranceInfo",
  services: "services"
};
const dayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];
const bannedSourcePattern =
  /\b(google\s*(maps|places|reviews?)|maps\.google|google\.com\/maps|yelp|ratings?|reviews?|patient\s+comments?|facebook|instagram|twitter|x\.com|healthgrades|zocdoc|webmd|sharecare|yellowpages|mapquest)\b/i;
const bannedServiceValuePattern =
  /\b(facility\s*type|site\s*type|location\s*setting|community[_\s-]*health[_\s-]*center|all other clinic types|clinic type|hospital type)\b/i;
const weeklyHoursPattern =
  /\b(weekly|per\s+week|operating\s+hours\s+per\s+week|hours\s*\/\s*week|hrsa operating hours)\b/i;
const unknownValuePattern = /^(unknown|not listed|not available|tbd|to be verified)$/i;

function relative(filePath) {
  return toProjectPath(filePath);
}

async function listReviewedFiles() {
  try {
    const entries = await readdir(reviewedDirectory, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(reviewedDirectory, entry.name))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function addError(errors, filePath, message) {
  errors.push(`${relative(filePath)}: ${message}`);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function sourceUrlHost(sourceUrl) {
  try {
    return new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hasBannedSourceSignal(...values) {
  return values.some((value) => hasText(value) && bannedSourcePattern.test(value));
}

function valueHasText(value) {
  if (Array.isArray(value)) {
    return value.some(hasText);
  }

  if (isObject(value)) {
    return Object.values(value).some((item) => {
      if (typeof item === "boolean") {
        return true;
      }

      if (Array.isArray(item)) {
        return item.some(hasText);
      }

      return hasText(item);
    });
  }

  return hasText(value);
}

function validateFieldValue(field, value, filePath, errors) {
  if (!valueHasText(value)) {
    addError(errors, filePath, `fields.${field}.value must not be empty when apply is true.`);
    return;
  }

  if (field === "services") {
    if (!Array.isArray(value) || !value.every(hasText)) {
      addError(errors, filePath, "fields.services.value must be an array of service names.");
      return;
    }

    for (const service of value) {
      if (bannedServiceValuePattern.test(service) || /^clinic$/i.test(service.trim())) {
        addError(
          errors,
          filePath,
          "fields.services.value must list actual services, not facility type or site type signals."
        );
      }
    }
  }

  if (field === "hours") {
    if (!isObject(value)) {
      addError(errors, filePath, "fields.hours.value must be an object keyed by daily hours.");
      return;
    }

    const hasDailyHours = dayKeys.some((day) => hasText(value[day]));

    if (!hasDailyHours) {
      addError(errors, filePath, "fields.hours.value must include at least one daily-hours field.");
    }

    if (
      Object.keys(value).some((key) => weeklyHoursPattern.test(key)) ||
      weeklyHoursPattern.test(JSON.stringify(value))
    ) {
      addError(errors, filePath, "Weekly hours metadata cannot be used as daily hours.");
    }
  }

  if (field === "insurance") {
    if (!isObject(value)) {
      addError(errors, filePath, "fields.insurance.value must be an object.");
      return;
    }

    const hasInsuranceSignal =
      value.acceptsMedicaid !== undefined ||
      value.acceptsMedicare !== undefined ||
      value.acceptsUninsured !== undefined ||
      (hasText(value.insuranceNotes) && !unknownValuePattern.test(value.insuranceNotes.trim()));

    if (!hasInsuranceSignal) {
      addError(
        errors,
        filePath,
        "fields.insurance.value must include an insurance acceptance boolean or specific notes."
      );
    }
  }

  if (field === "cost") {
    if (!isObject(value)) {
      addError(errors, filePath, "fields.cost.value must be an object.");
      return;
    }

    const hasCostSignal =
      ["free", "low_cost", "standard"].includes(value.priceLevel) ||
      value.acceptsSlidingScale !== undefined ||
      (hasText(value.estimatedVisitCost) &&
        !unknownValuePattern.test(value.estimatedVisitCost.trim())) ||
      (hasText(value.priceNotes) && !unknownValuePattern.test(value.priceNotes.trim()));

    if (!hasCostSignal) {
      addError(
        errors,
        filePath,
        "fields.cost.value must include priceLevel, sliding-scale status, estimated cost, or specific cost notes."
      );
    }
  }

  if (field === "accessibility" && (!hasText(value) || unknownValuePattern.test(value.trim()))) {
    addError(errors, filePath, "fields.accessibility.value must be a text statement.");
  }
}

function appliedFieldsFrom(reviewed) {
  return reviewFields.filter((field) => reviewed.fields?.[field]?.apply === true);
}

function validateReviewedPacket(reviewed, filePath, facilityIdsInProduction) {
  const errors = [];

  if (!isObject(reviewed)) {
    addError(errors, filePath, "Reviewed packet must be a JSON object.");
    return errors;
  }

  for (const key of ["sourceUrl", "sourceTitle", "checkedDate", "sourceType", "reviewedBy"]) {
    if (!hasText(reviewed[key])) {
      addError(errors, filePath, `${key} is required.`);
    }
  }

  if (!validDate(reviewed.checkedDate)) {
    addError(errors, filePath, "checkedDate must use YYYY-MM-DD.");
  }

  if (!sourceApplicabilityValues.has(reviewed.sourceAppliesTo)) {
    addError(
      errors,
      filePath,
      "sourceAppliesTo must be single_location, all_listed_locations, or organization_wide_policy."
    );
  }

  if (hasText(reviewed.sourceUrl) && !sourceUrlHost(reviewed.sourceUrl)) {
    addError(errors, filePath, "sourceUrl must be a valid absolute URL.");
  }

  if (
    hasBannedSourceSignal(
      reviewed.sourceUrl,
      reviewed.sourceTitle,
      reviewed.sourceType,
      reviewed.sourceName
    )
  ) {
    addError(errors, filePath, "Google Maps, Yelp, ratings, reviews, social posts, or random directories are not allowed.");
  }

  if (bannedFieldSourceTypes.has(reviewed.sourceType)) {
    addError(errors, filePath, `sourceType "${reviewed.sourceType}" is banned.`);
  } else if (hasText(reviewed.sourceType) && !allowedFieldSourceTypes.has(reviewed.sourceType)) {
    addError(errors, filePath, `sourceType "${reviewed.sourceType}" is not allowed.`);
  }

  if (!Array.isArray(reviewed.facilityIds) || reviewed.facilityIds.length === 0) {
    addError(errors, filePath, "facilityIds must list exact production facility IDs.");
  } else {
    const uniqueIds = new Set(reviewed.facilityIds);

    if (uniqueIds.size !== reviewed.facilityIds.length) {
      addError(errors, filePath, "facilityIds must not contain duplicates.");
    }

    for (const id of reviewed.facilityIds) {
      if (!facilityIdsInProduction.has(id)) {
        addError(errors, filePath, `facilityIds contains unknown production facility ID "${id}".`);
      }
    }
  }

  if (reviewed.sourceAppliesTo === "single_location" && reviewed.facilityIds?.length !== 1) {
    addError(errors, filePath, "single_location sources must apply to exactly one facilityId.");
  }

  if (!isObject(reviewed.fields)) {
    addError(errors, filePath, "fields object is required.");
    return errors;
  }

  const appliedFields = appliedFieldsFrom(reviewed);

  if (appliedFields.length === 0) {
    addError(errors, filePath, "At least one fields.<field>.apply value must be true.");
  }

  for (const field of appliedFields) {
    const reviewedField = reviewed.fields[field];

    if (
      reviewed.sourceAppliesTo === "organization_wide_policy" &&
      !organizationWideAllowedFields.has(field)
    ) {
      addError(
        errors,
        filePath,
        "organization_wide_policy sources may apply only to cost and insurance."
      );
    }

    if (!hasText(reviewedField.evidence)) {
      addError(errors, filePath, `fields.${field}.evidence is required when apply is true.`);
    } else if (hasBannedSourceSignal(reviewedField.evidence)) {
      addError(errors, filePath, `fields.${field}.evidence mentions a banned source.`);
    }

    if (
      reviewed.sourceAppliesTo === "all_listed_locations" &&
      !/\b(appl(y|ies|icable)|all|listed|locations?)\b/i.test(reviewedField.evidence ?? "")
    ) {
      addError(
        errors,
        filePath,
        `fields.${field}.evidence must say why the source applies to all listed locations.`
      );
    }

    validateFieldValue(field, reviewedField.value, filePath, errors);
  }

  return errors;
}

function enrichmentValueFor(field, value) {
  if (field === "services") {
    return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  }

  if (field === "accessibility") {
    return value.trim();
  }

  return structuredClone(value);
}

function fieldSourceFor(reviewed, field) {
  const locationSpecific = reviewed.sourceAppliesTo !== "organization_wide_policy";
  const applicabilityText = `Source applicability: ${reviewed.sourceAppliesTo}.`;
  const evidenceText = reviewed.fields[field].evidence.trim();

  return {
    checkedDate: reviewed.checkedDate,
    field,
    locationSpecific,
    reviewerNote: `${evidenceText} ${applicabilityText} Reviewed by ${reviewed.reviewedBy}.`,
    sourceLocationScope: locationSpecific ? "facility_location" : "organization_wide_policy",
    sourceTitle: reviewed.sourceTitle,
    sourceType: reviewed.sourceType,
    sourceUrl: reviewed.sourceUrl,
    status: "source_backed"
  };
}

function mergeReviewedPacket(recordsByFacilityId, reviewed, filePath, facilitiesById) {
  const appliedFields = appliedFieldsFrom(reviewed);

  for (const facilityId of reviewed.facilityIds) {
    const facility = facilitiesById.get(facilityId);
    const output =
      recordsByFacilityId.get(facilityId) ??
      {
        id: facilityId,
        name: facility?.name ?? "",
        providerGroup: reviewed.providerGroup ?? "",
        providerReviewedEnrichment: true,
        reviewedSourceFile: relative(filePath),
        enrichment: {},
        fieldSources: {}
      };

    for (const field of appliedFields) {
      if (Object.prototype.hasOwnProperty.call(output.fieldSources, field)) {
        throw new Error(
          `${relative(filePath)} duplicates enrichment for ${facilityId} fieldSources.${field}.`
        );
      }

      output.enrichment[fieldValueKeys[field]] = enrichmentValueFor(
        field,
        reviewed.fields[field].value
      );
      output.fieldSources[field] = fieldSourceFor(reviewed, field);
    }

    recordsByFacilityId.set(facilityId, output);
  }
}

function runPlanCommand() {
  const result = spawnSync(
    process.execPath,
    [
      npmCliPath,
      "run",
      "plan:healthcare-enrichment",
      "--",
      `--input=${relative(outputInputPath)}`,
      `--output=${relative(outputPlanPath)}`
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: "pipe"
    }
  );

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

async function main() {
  const beforeHash = await sha256File(facilitiesPath);
  const [facilities, reviewedFiles] = await Promise.all([readFacilities(facilitiesPath), listReviewedFiles()]);
  const facilityIdsInProduction = new Set(facilities.map((facility) => facility.id));
  const facilitiesById = new Map(facilities.map((facility) => [facility.id, facility]));
  const recordsByFacilityId = new Map();
  const reviewedPackets = [];
  const validationErrors = [];

  for (const filePath of reviewedFiles) {
    const reviewed = JSON.parse(await readFile(filePath, "utf8"));
    const errors = validateReviewedPacket(reviewed, filePath, facilityIdsInProduction);

    reviewedPackets.push({
      file: relative(filePath),
      providerGroup: reviewed.providerGroup ?? "",
      facilityIds: reviewed.facilityIds ?? [],
      appliedFields: appliedFieldsFrom(reviewed),
      errors
    });
    validationErrors.push(...errors);

    if (errors.length === 0) {
      mergeReviewedPacket(recordsByFacilityId, reviewed, filePath, facilitiesById);
    }
  }

  const enrichmentInput = [...recordsByFacilityId.values()].sort((first, second) =>
    first.id.localeCompare(second.id)
  );

  await writeJson(outputInputPath, enrichmentInput);

  const planResult = validationErrors.length === 0 ? runPlanCommand() : null;

  const report = {
    generatedAt: new Date().toISOString(),
    inputs: {
      reviewedDirectory: relative(reviewedDirectory),
      facilities: relative(facilitiesPath)
    },
    outputs: {
      enrichmentInput: relative(outputInputPath),
      enrichmentPlan: relative(outputPlanPath),
      report: relative(outputReportPath)
    },
    summary: {
      reviewedFileCount: reviewedFiles.length,
      enrichmentRecordCount: enrichmentInput.length,
      validationErrorCount: validationErrors.length,
      planExitCode: planResult?.status ?? null,
      note:
        "Reviewed provider enrichment builder is read-only for production data and runs the enrichment planner without --write."
    },
    reviewedPackets,
    validationErrors,
    planStdout: planResult?.stdout ?? "",
    planStderr: planResult?.stderr ?? ""
  };

  await writeJson(outputReportPath, report);

  const afterHash = await sha256File(facilitiesPath);

  if (afterHash !== beforeHash) {
    throw new Error("public/data/healthcare/facilities.json was mutated.");
  }

  if (validationErrors.length > 0) {
    for (const error of validationErrors) {
      console.error(error);
    }

    throw new Error("Reviewed provider enrichment validation failed.");
  }

  if (planResult.status !== 0) {
    process.stdout.write(planResult.stdout);
    process.stderr.write(planResult.stderr);
    throw new Error("npm run plan:healthcare-enrichment failed.");
  }

  process.stdout.write(planResult.stdout);
  process.stderr.write(planResult.stderr);
  console.log("Provider reviewed healthcare enrichment input built.");
  console.log(`Reviewed files: ${reviewedFiles.length}`);
  console.log(`Enrichment records: ${enrichmentInput.length}`);
  console.log(`Input: ${relative(outputInputPath)}`);
  console.log(`Plan: ${relative(outputPlanPath)}`);
  console.log(`Report: ${relative(outputReportPath)}`);
}

main().catch((error) => {
  console.error("Provider reviewed healthcare enrichment build failed.");
  console.error(error.message);
  process.exit(1);
});
