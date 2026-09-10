import {
  collectEnrichmentProvenanceErrors,
  enrichmentFields,
  hasEnrichmentValue
} from "./healthcareEnrichmentProvenance.mjs";

const scoreCategoryFields = ["accessibility", "cost", "hours", "insurance", "services"];

const fieldValueKeys = {
  accessibility: ["accessibilityInfo"],
  acceptingPatients: [
    "acceptingPatients",
    "acceptingPatientsInfo",
    "acceptingPatientsNotes"
  ],
  cost: ["priceInfo"],
  hours: ["hours"],
  insurance: ["insuranceInfo"],
  languages: ["languages", "languageNotes"],
  services: ["services"]
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  if (value === undefined) {
    return undefined;
  }

  return structuredClone(value);
}

function copyFieldValue(target, enrichment, field) {
  for (const key of fieldValueKeys[field] ?? []) {
    if (Object.prototype.hasOwnProperty.call(enrichment, key)) {
      target[key] = cloneValue(enrichment[key]);
    }
  }
}

function buildMergedCandidate(productionFacility, input, proposedFields, sourceOnlyFields) {
  const mergedCandidate = structuredClone(productionFacility);
  const fieldSources = isObject(productionFacility.fieldSources)
    ? structuredClone(productionFacility.fieldSources)
    : {};
  const enrichment = isObject(input?.enrichment) ? input.enrichment : {};
  const inputFieldSources = isObject(input?.fieldSources) ? input.fieldSources : {};

  for (const field of proposedFields) {
    copyFieldValue(mergedCandidate, enrichment, field);

    if (Object.prototype.hasOwnProperty.call(inputFieldSources, field)) {
      fieldSources[field] = cloneValue(inputFieldSources[field]);
    }
  }

  for (const field of sourceOnlyFields) {
    fieldSources[field] = cloneValue(inputFieldSources[field]);
  }

  if (Object.keys(fieldSources).length > 0) {
    mergedCandidate.fieldSources = fieldSources;
  }

  return mergedCandidate;
}

function emptyScoreCategoryCounts() {
  return Object.fromEntries(scoreCategoryFields.map((field) => [field, 0]));
}

export function buildEnrichmentPlan(productionFacilities, enrichmentInputs, options = {}) {
  const label = options.label ?? "healthcare enrichment plan";
  const productionById = new Map(
    (Array.isArray(productionFacilities) ? productionFacilities : [])
      .filter((facility) => facility?.id !== undefined)
      .map((facility) => [facility.id, facility])
  );
  const records = [];
  const summary = {
    applicable: 0,
    blocked: 0,
    no_change: 0,
    totalProposedFieldChanges: 0,
    recordsGainingEachScoreCategory: emptyScoreCategoryCounts(),
    note: "No production data written. verificationStatus unchanged."
  };

  for (const input of Array.isArray(enrichmentInputs) ? enrichmentInputs : []) {
    const id = input?.id ?? "";
    const productionFacility = productionById.get(id);

    if (!productionFacility) {
      records.push({
        id,
        classification: "blocked",
        reasons: ["no_matching_production_facility"],
        appliedFields: [],
        skippedExistingFields: [],
        scoreCategoriesNewlyCovered: []
      });
      summary.blocked += 1;
      continue;
    }

    const enrichment = isObject(input?.enrichment) ? input.enrichment : {};
    const inputFieldSources = isObject(input?.fieldSources) ? input.fieldSources : {};
    const proposedFields = [];
    const skippedExistingFields = [];
    const sourceOnlyFields = [];

    for (const field of enrichmentFields) {
      const inputHasValue = hasEnrichmentValue(enrichment, field);
      const productionHasValue = hasEnrichmentValue(productionFacility, field);
      const inputHasFieldSource = Object.prototype.hasOwnProperty.call(inputFieldSources, field);

      if (inputHasValue && productionHasValue) {
        skippedExistingFields.push(field);
        continue;
      }

      if (inputHasValue && !productionHasValue) {
        proposedFields.push(field);
        continue;
      }

      if (!inputHasValue && !productionHasValue && inputHasFieldSource) {
        sourceOnlyFields.push(field);
      }
    }

    const mergedCandidate = buildMergedCandidate(
      productionFacility,
      input,
      proposedFields,
      sourceOnlyFields
    );
    const reasons = collectEnrichmentProvenanceErrors(mergedCandidate, {
      requireSourceBacked: true,
      label: id || label
    });
    const scoreCategoriesNewlyCovered = scoreCategoryFields.filter((field) =>
      proposedFields.includes(field)
    );

    if (reasons.length > 0) {
      records.push({
        id,
        classification: "blocked",
        reasons,
        appliedFields: proposedFields,
        skippedExistingFields,
        scoreCategoriesNewlyCovered
      });
      summary.blocked += 1;
      continue;
    }

    if (proposedFields.length === 0) {
      records.push({
        id,
        classification: "no_change",
        reasons: [],
        appliedFields: [],
        skippedExistingFields,
        scoreCategoriesNewlyCovered: []
      });
      summary.no_change += 1;
      continue;
    }

    records.push({
      id,
      classification: "applicable",
      reasons: [],
      appliedFields: proposedFields,
      skippedExistingFields,
      scoreCategoriesNewlyCovered
    });
    summary.applicable += 1;
    summary.totalProposedFieldChanges += proposedFields.length;

    for (const field of scoreCategoriesNewlyCovered) {
      summary.recordsGainingEachScoreCategory[field] += 1;
    }
  }

  return { records, summary };
}
