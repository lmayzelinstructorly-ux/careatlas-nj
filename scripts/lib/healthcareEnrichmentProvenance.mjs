export const enrichmentFields = [
  "services",
  "hours",
  "insurance",
  "cost",
  "accessibility",
  "languages",
  "acceptingPatients"
];

export const locationSpecificEnrichmentFields = new Set(enrichmentFields);

export const allowedFieldSourceStatuses = new Set([
  "source_backed",
  "needs_review"
]);

export const allowedFieldSourceTypes = new Set([
  "official_facility_page",
  "health_system_location_page",
  "federal_open_data",
  "state_open_data",
  "local_open_data",
  "regulated_directory",
  "approved_nonprofit_directory",
  "approved_api",
  "other_official"
]);

export const bannedFieldSourceTypes = new Set([
  "google_maps",
  "google_reviews",
  "yelp",
  "review_site",
  "patient_comments",
  "copied_directory_reviews",
  "scraped_reviews"
]);

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
  /\b(google\s*(maps|places|reviews?)|maps\.google|google\.com\/maps|yelp|ratings?|patient\s+comments?|review\s+summar(y|ies)|copied\s+directory\s+reviews?)\b/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasArrayText(value) {
  return Array.isArray(value) && value.some(hasText);
}

export function hasEnrichmentValue(facility, field) {
  if (!isObject(facility)) {
    return false;
  }

  if (field === "services") {
    return hasArrayText(facility.services);
  }

  if (field === "hours") {
    return isObject(facility.hours) && dayKeys.some((day) => hasText(facility.hours[day]));
  }

  if (field === "insurance") {
    return (
      isObject(facility.insuranceInfo) &&
      (facility.insuranceInfo.acceptsMedicaid !== undefined ||
        facility.insuranceInfo.acceptsMedicare !== undefined ||
        facility.insuranceInfo.acceptsUninsured !== undefined ||
        hasText(facility.insuranceInfo.insuranceNotes))
    );
  }

  if (field === "cost") {
    return (
      isObject(facility.priceInfo) &&
      (facility.priceInfo.priceLevel === "free" ||
        facility.priceInfo.priceLevel === "low_cost" ||
        facility.priceInfo.priceLevel === "standard" ||
        facility.priceInfo.acceptsSlidingScale !== undefined ||
        hasText(facility.priceInfo.estimatedVisitCost) ||
        hasText(facility.priceInfo.priceNotes))
    );
  }

  if (field === "accessibility") {
    return hasText(facility.accessibilityInfo);
  }

  if (field === "languages") {
    return hasArrayText(facility.languages) || hasText(facility.languageNotes);
  }

  if (field === "acceptingPatients") {
    return (
      facility.acceptingPatients !== undefined ||
      hasText(facility.acceptingPatientsInfo) ||
      hasText(facility.acceptingPatientsNotes)
    );
  }

  return false;
}

export function getPopulatedEnrichmentFields(facility) {
  return enrichmentFields.filter((field) => hasEnrichmentValue(facility, field));
}

function sourceLabel(source) {
  return source?.sourceTitle ?? source?.sourceLabel ?? source?.sourceName ?? "source";
}

function hasBannedSourceSignal(source) {
  if (!isObject(source)) {
    return false;
  }

  if (bannedFieldSourceTypes.has(source.sourceType)) {
    return true;
  }

  return [
    source.sourceUrl,
    source.sourceTitle,
    source.sourceLabel,
    source.sourceName
  ].some((value) => hasText(value) && bannedSourcePattern.test(value));
}

function hasValidCheckedDate(source) {
  if (!hasText(source.checkedDate)) {
    return false;
  }

  const checkedDate = new Date(`${source.checkedDate}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(source.checkedDate) && !Number.isNaN(checkedDate.getTime());
}

function isLocationSpecificSource(source) {
  return source.locationSpecific === true || source.sourceLocationScope === "facility_location";
}

export function collectFieldSourceErrors(field, source, options = {}) {
  const errors = [];
  const requireSourceBacked = options.requireSourceBacked ?? true;

  if (!isObject(source)) {
    return [`fieldSources.${field} must be an object with field-level source provenance.`];
  }

  if (!allowedFieldSourceStatuses.has(source.status)) {
    errors.push(`fieldSources.${field}.status must be source_backed or needs_review.`);
  } else if (requireSourceBacked && source.status !== "source_backed") {
    errors.push(`fieldSources.${field}.status must be source_backed before production promotion.`);
  }

  if (source.field !== field) {
    errors.push(`fieldSources.${field}.field must exactly match "${field}".`);
  }

  if (!hasText(source.sourceUrl)) {
    errors.push(`fieldSources.${field}.sourceUrl is required.`);
  }

  if (!hasText(source.sourceTitle) && !hasText(source.sourceLabel)) {
    errors.push(`fieldSources.${field} needs sourceTitle or sourceLabel.`);
  }

  if (!hasValidCheckedDate(source)) {
    errors.push(`fieldSources.${field}.checkedDate is required in YYYY-MM-DD format.`);
  }

  if (!hasText(source.sourceType)) {
    errors.push(`fieldSources.${field}.sourceType is required.`);
  } else if (bannedFieldSourceTypes.has(source.sourceType)) {
    errors.push(`fieldSources.${field}.sourceType "${source.sourceType}" is not allowed for production enrichment.`);
  } else if (!allowedFieldSourceTypes.has(source.sourceType)) {
    errors.push(`fieldSources.${field}.sourceType "${source.sourceType}" is not an allowed enrichment source type.`);
  }

  if (locationSpecificEnrichmentFields.has(field) && !isLocationSpecificSource(source)) {
    errors.push(
      `fieldSources.${field} must point to a location-specific source for ${sourceLabel(source)}.`
    );
  }

  if (hasBannedSourceSignal(source)) {
    errors.push(`fieldSources.${field} uses a banned review, rating, Google, Yelp or patient-comment source.`);
  }

  return errors;
}

export function collectEnrichmentProvenanceErrors(facility, options = {}) {
  const errors = [];
  const requireSourceBacked = options.requireSourceBacked ?? true;
  const label = options.label ?? "facility";

  if (!isObject(facility)) {
    return [`${label} must be an object before enrichment provenance can be validated.`];
  }

  if (facility.fieldSources !== undefined && !isObject(facility.fieldSources)) {
    errors.push(`${label} fieldSources must be an object when provided.`);
    return errors;
  }

  const fieldSources = isObject(facility.fieldSources) ? facility.fieldSources : {};

  for (const field of Object.keys(fieldSources)) {
    if (!enrichmentFields.includes(field)) {
      errors.push(`${label} fieldSources has unsupported field "${field}".`);
    }
  }

  for (const field of enrichmentFields) {
    const hasValue = hasEnrichmentValue(facility, field);
    const source = fieldSources[field];

    if (hasValue && source === undefined) {
      errors.push(
        `${label} has ${field} enrichment values, so fieldSources.${field} with exact source URL and checked date is required.`
      );
      continue;
    }

    if (source !== undefined) {
      if (!hasValue) {
        errors.push(`${label} fieldSources.${field} is present but ${field} has no enriched value.`);
      }

      for (const sourceError of collectFieldSourceErrors(field, source, {
        requireSourceBacked
      })) {
        errors.push(`${label} ${sourceError}`);
      }
    }
  }

  return errors;
}
