import type {
  HealthcareDataQualityAudit,
  HealthcareDataQualityGap,
  HealthcareDataQualityIssue,
  HealthcareDataReadinessLevel,
  HealthcareFacility,
  HealthcareFacilityDataQualityAudit
} from "../types/healthcare";

const requiredTextFields: Array<{
  field: keyof HealthcareFacility;
  label: string;
}> = [
  { field: "id", label: "Facility ID" },
  { field: "name", label: "Facility name" },
  { field: "facilityType", label: "Facility type" },
  { field: "address", label: "Street address" },
  { field: "city", label: "City" },
  { field: "state", label: "State" },
  { field: "verificationStatus", label: "Verification status" }
];

const dayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;

const enrichmentFields = [
  "services",
  "hours",
  "insurance",
  "cost",
  "accessibility"
] as const;

type AuditedEnrichmentField = (typeof enrichmentFields)[number];

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasListedValue(value: unknown) {
  return hasText(value) && !/(unknown|not listed|not available|tbd|to be verified)/i.test(value);
}

function isValidLatitude(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

function daysSince(dateText?: string) {
  if (!hasText(dateText)) {
    return null;
  }

  const date = new Date(`${dateText}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (Date.now() - date.getTime()) / 86_400_000;
}

function roundPercent(count: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((count / total) * 100);
}

function countFacilities(
  facilities: HealthcareFacility[],
  predicate: (facility: HealthcareFacility) => boolean
) {
  return facilities.filter(predicate).length;
}

function addIssue(
  issues: HealthcareDataQualityIssue[],
  missingFields: string[],
  field: string,
  message: string,
  severity: HealthcareDataQualityIssue["severity"] = "warning"
) {
  issues.push({ field, message, severity });

  if (severity !== "info") {
    missingFields.push(field);
  }
}

function hasCoordinates(facility: HealthcareFacility) {
  return isValidLatitude(facility.latitude) && isValidLongitude(facility.longitude);
}

function hasSourceUrl(facility: HealthcareFacility) {
  return hasText(facility.sourceInfo?.sourceUrl);
}

function hasFieldSourceBackedValue(
  facility: HealthcareFacility,
  field: AuditedEnrichmentField
) {
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

function hasRawPriceInfo(facility: HealthcareFacility) {
  return (
    Boolean(facility.priceInfo) &&
    (facility.priceInfo.priceLevel !== "unknown" ||
      facility.priceInfo.acceptsSlidingScale ||
      hasText(facility.priceInfo.estimatedVisitCost) ||
      hasText(facility.priceInfo.priceNotes))
  );
}

function hasPriceInfo(facility: HealthcareFacility) {
  return hasRawPriceInfo(facility) && hasFieldSourceBackedValue(facility, "cost");
}

function hasRawInsuranceInfo(facility: HealthcareFacility) {
  return (
    Boolean(facility.insuranceInfo) &&
    (facility.insuranceInfo.acceptsMedicaid !== undefined ||
      facility.insuranceInfo.acceptsMedicare !== undefined ||
      facility.insuranceInfo.acceptsUninsured !== undefined ||
      hasText(facility.insuranceInfo.insuranceNotes))
  );
}

function hasInsuranceInfo(facility: HealthcareFacility) {
  return hasRawInsuranceInfo(facility) && hasFieldSourceBackedValue(facility, "insurance");
}

function hasRawHours(facility: HealthcareFacility) {
  return Boolean(facility.hours) && dayKeys.some((day) => hasListedValue(facility.hours[day]));
}

function hasHours(facility: HealthcareFacility) {
  return hasRawHours(facility) && hasFieldSourceBackedValue(facility, "hours");
}

function hasRawServices(facility: HealthcareFacility) {
  return Array.isArray(facility.services) && facility.services.some(hasText);
}

function hasServices(facility: HealthcareFacility) {
  return hasRawServices(facility) && hasFieldSourceBackedValue(facility, "services");
}

function hasRawAccessibilityInfo(facility: HealthcareFacility) {
  return hasText(facility.accessibilityInfo);
}

function getReadinessLevel(
  qualityScore: number,
  issues: HealthcareDataQualityIssue[],
  verificationStatus: HealthcareFacility["verificationStatus"]
): HealthcareDataReadinessLevel {
  const hasCriticalIssue = issues.some((issue) => issue.severity === "critical");

  if (qualityScore >= 82 && !hasCriticalIssue && verificationStatus === "verified") {
    return "ready";
  }

  if (qualityScore < 55 || hasCriticalIssue) {
    return "insufficient_data";
  }

  return "needs_review";
}

function uniqueItems(items: string[]) {
  return [...new Set(items)];
}

function getRecommendedFixes(
  facility: HealthcareFacility,
  missingFields: string[],
  issues: HealthcareDataQualityIssue[]
) {
  const fixes: string[] = [];

  if (missingFields.some((field) => field.startsWith("required."))) {
    fixes.push("Complete the core facility identity and location fields.");
  }

  if (missingFields.includes("coordinates")) {
    fixes.push("Add verified latitude and longitude before future map display.");
  }

  if (missingFields.includes("hours")) {
    fixes.push("Verify current operating hours from a source-backed listing.");
  }

  if (missingFields.includes("priceInfo")) {
    fixes.push("Add source-backed price level, sliding-scale or cost notes.");
  }

  if (missingFields.includes("insuranceInfo")) {
    fixes.push("Confirm Medicaid, Medicare, uninsured access or insurance notes.");
  }

  if (missingFields.includes("services")) {
    fixes.push("List the services available at this facility.");
  }

  if (missingFields.includes("contactInfo")) {
    fixes.push("Add a phone number or website so users can verify details.");
  }

  if (missingFields.includes("sourceInfo")) {
    fixes.push("Add source name, source URL and last checked date.");
  }

  if (facility.verificationStatus !== "verified") {
    fixes.push("Move the record through verification before treating it as AI-ready.");
  }

  if (issues.some((issue) => issue.field === "lastVerified")) {
    fixes.push("Update the last verified date after checking the source.");
  }

  return uniqueItems(
    fixes.length > 0 ? fixes : ["Review the record against current source-backed facility data."]
  ).slice(0, 5);
}

const facilityAuditCache = new WeakMap<
  HealthcareFacility,
  HealthcareFacilityDataQualityAudit
>();

// The audit is a pure function of the facility record, so results are cached
// per facility object. This keeps repeated filter/weight/preference changes,
// marker rendering and the explorer from re-auditing all loaded records.
export function auditSingleHealthcareFacility(
  facility: HealthcareFacility
): HealthcareFacilityDataQualityAudit {
  const cachedAudit = facilityAuditCache.get(facility);

  if (cachedAudit) {
    return cachedAudit;
  }

  const audit = computeSingleHealthcareFacilityAudit(facility);
  facilityAuditCache.set(facility, audit);
  return audit;
}

function computeSingleHealthcareFacilityAudit(
  facility: HealthcareFacility
): HealthcareFacilityDataQualityAudit {
  const issues: HealthcareDataQualityIssue[] = [];
  const missingFields: string[] = [];
  let qualityScore = 100;

  for (const requiredField of requiredTextFields) {
    if (!hasText(facility[requiredField.field])) {
      addIssue(
        issues,
        missingFields,
        `required.${String(requiredField.field)}`,
        `${requiredField.label} is missing.`,
        "critical"
      );
      qualityScore -= 12;
    }
  }

  if (!hasCoordinates(facility)) {
    addIssue(
      issues,
      missingFields,
      "coordinates",
      "Coordinates are missing or outside valid latitude/longitude ranges.",
      "critical"
    );
    qualityScore -= 14;
  }

  if (!hasHours(facility)) {
    addIssue(issues, missingFields, "hours", "Operating hours are incomplete.");
    qualityScore -= 10;
  }

  if (!hasPriceInfo(facility)) {
    addIssue(issues, missingFields, "priceInfo", "Price or cost information is incomplete.");
    qualityScore -= 10;
  }

  if (!hasInsuranceInfo(facility)) {
    addIssue(
      issues,
      missingFields,
      "insuranceInfo",
      "Insurance acceptance information is incomplete."
    );
    qualityScore -= 10;
  }

  if (!hasServices(facility)) {
    addIssue(issues, missingFields, "services", "Services are not listed.");
    qualityScore -= 10;
  }

  for (const field of enrichmentFields) {
    const hasRawValue =
      (field === "services" && hasRawServices(facility)) ||
      (field === "hours" && hasRawHours(facility)) ||
      (field === "insurance" && hasRawInsuranceInfo(facility)) ||
      (field === "cost" && hasRawPriceInfo(facility)) ||
      (field === "accessibility" && hasRawAccessibilityInfo(facility));

    if (hasRawValue && !hasFieldSourceBackedValue(facility, field)) {
      addIssue(
        issues,
        missingFields,
        `fieldSources.${field}`,
        `${field} is listed but lacks complete source-backed field-level provenance.`,
        "critical"
      );
      qualityScore -= 12;
    }
  }

  if (!hasText(facility.phone) && !hasText(facility.website)) {
    addIssue(
      issues,
      missingFields,
      "contactInfo",
      "Phone and website contact information are both missing."
    );
    qualityScore -= 8;
  }

  if (
    !facility.sourceInfo ||
    !hasText(facility.sourceInfo.sourceName) ||
    !hasText(facility.sourceInfo.sourceUrl) ||
    !hasText(facility.sourceInfo.lastChecked)
  ) {
    addIssue(
      issues,
      missingFields,
      "sourceInfo",
      "Source name, URL or last checked date is incomplete.",
      "critical"
    );
    qualityScore -= 12;
  }

  if (facility.verificationStatus === "demo") {
    addIssue(
      issues,
      missingFields,
      "verificationStatus",
      "Demo records are not AI-ready until replaced by real source-backed data."
    );
    qualityScore -= 20;
  } else if (facility.verificationStatus === "unverified") {
    addIssue(issues, missingFields, "verificationStatus", "Record is unverified.");
    qualityScore -= 15;
  } else if (facility.verificationStatus === "needs_review") {
    addIssue(issues, missingFields, "verificationStatus", "Record needs review.");
    qualityScore -= 8;
  }

  const lastVerifiedDays = daysSince(facility.lastVerified || facility.sourceInfo?.lastChecked);

  if (lastVerifiedDays === null) {
    addIssue(
      issues,
      missingFields,
      "lastVerified",
      "Recent verification date is missing or invalid."
    );
    qualityScore -= 8;
  } else if (lastVerifiedDays > 365) {
    addIssue(
      issues,
      missingFields,
      "lastVerified",
      "Record has not been verified within the past year."
    );
    qualityScore -= 6;
  }

  const boundedQualityScore = Math.round(Math.min(Math.max(qualityScore, 0), 100));
  const uniqueMissingFields = uniqueItems(missingFields);

  return {
    facilityId: facility.id,
    facilityName: facility.name,
    readinessLevel: getReadinessLevel(
      boundedQualityScore,
      issues,
      facility.verificationStatus
    ),
    qualityScore: boundedQualityScore,
    issues,
    missingFields: uniqueMissingFields,
    recommendedDataFixes: getRecommendedFixes(facility, uniqueMissingFields, issues)
  };
}

function getTopDataGaps(facilityAudits: HealthcareFacilityDataQualityAudit[]) {
  const gapCounts = new Map<string, number>();

  for (const audit of facilityAudits) {
    for (const field of audit.missingFields) {
      gapCounts.set(field, (gapCounts.get(field) ?? 0) + 1);
    }
  }

  const labels: Record<string, string> = {
    contactInfo: "Contact info",
    coordinates: "Coordinates",
    hours: "Hours",
    insuranceInfo: "Insurance info",
    "fieldSources.accessibility": "Accessibility provenance",
    "fieldSources.cost": "Cost provenance",
    "fieldSources.hours": "Hours provenance",
    "fieldSources.insurance": "Insurance provenance",
    "fieldSources.services": "Services provenance",
    lastVerified: "Recent verification",
    priceInfo: "Price info",
    services: "Services",
    sourceInfo: "Source coverage",
    verificationStatus: "Verification status"
  };

  return [...gapCounts.entries()]
    .map(([field, count]) => ({
      count,
      label: labels[field] ?? field.replace(/^required\./, "Required "),
      percent: roundPercent(count, facilityAudits.length)
    }))
    .sort((firstGap, secondGap) => secondGap.count - firstGap.count)
    .slice(0, 3);
}

function getDatasetReadinessLevel(
  averageQualityScore: number,
  verifiedPercent: number,
  demoCount: number,
  totalFacilities: number
): HealthcareDataReadinessLevel {
  if (totalFacilities === 0 || averageQualityScore < 55 || demoCount === totalFacilities) {
    return "insufficient_data";
  }

  if (averageQualityScore >= 82 && verifiedPercent >= 80 && demoCount === 0) {
    return "ready";
  }

  return "needs_review";
}

function getRecommendedNextSteps(
  audit: Omit<
    HealthcareDataQualityAudit,
    "facilityAudits" | "recommendedNextSteps" | "topDataGaps"
  >,
  topDataGaps: HealthcareDataQualityGap[]
) {
  if (audit.totalFacilities === 0) {
    return [
      "Import source-backed healthcare facility records before using AI readiness signals.",
      "Keep demo records out of production facility data."
    ];
  }

  const nextSteps: string[] = [];

  if (audit.demoCount > 0) {
    nextSteps.push("Replace demo records with real source-backed facility data.");
  }

  if (audit.verifiedCount < audit.totalFacilities) {
    nextSteps.push("Prioritize verification for records marked needs review or unverified.");
  }

  for (const gap of topDataGaps) {
    nextSteps.push(`Improve ${gap.label.toLowerCase()} for ${gap.count} record${gap.count === 1 ? "" : "s"}.`);
  }

  if (audit.percentWithCoordinates < 100) {
    nextSteps.push("Add verified coordinates before future healthcare map markers are enabled.");
  }

  return uniqueItems(nextSteps).slice(0, 4);
}

export function auditHealthcareFacilityData(
  facilities: HealthcareFacility[]
): HealthcareDataQualityAudit {
  if (facilities.length === 0) {
    return {
      readinessLevel: "insufficient_data",
      totalFacilities: 0,
      verifiedCount: 0,
      needsReviewCount: 0,
      unverifiedCount: 0,
      demoCount: 0,
      percentWithCoordinates: 0,
      percentWithSourceUrls: 0,
      percentWithPriceInfo: 0,
      percentWithInsuranceInfo: 0,
      percentWithHours: 0,
      percentWithServices: 0,
      averageQualityScore: 0,
      facilityAudits: [],
      topDataGaps: [],
      recommendedNextSteps: [
        "Import source-backed healthcare facility records before using AI readiness signals.",
        "Use the CSV template and validation script to keep fields consistent."
      ],
      emptyMessage:
        "No healthcare facility records are loaded yet, so AI readiness cannot be established."
    };
  }

  const facilityAudits = facilities.map(auditSingleHealthcareFacility);
  const totalFacilities = facilities.length;
  const verifiedCount = countFacilities(
    facilities,
    (facility) => facility.verificationStatus === "verified"
  );
  const needsReviewCount = countFacilities(
    facilities,
    (facility) => facility.verificationStatus === "needs_review"
  );
  const unverifiedCount = countFacilities(
    facilities,
    (facility) => facility.verificationStatus === "unverified"
  );
  const demoCount = countFacilities(
    facilities,
    (facility) => facility.verificationStatus === "demo"
  );
  const averageQualityScore = Math.round(
    facilityAudits.reduce((sum, audit) => sum + audit.qualityScore, 0) /
      totalFacilities
  );
  const topDataGaps = getTopDataGaps(facilityAudits);
  const verifiedPercent = roundPercent(verifiedCount, totalFacilities);
  const baseAudit = {
    readinessLevel: getDatasetReadinessLevel(
      averageQualityScore,
      verifiedPercent,
      demoCount,
      totalFacilities
    ),
    totalFacilities,
    verifiedCount,
    needsReviewCount,
    unverifiedCount,
    demoCount,
    percentWithCoordinates: roundPercent(
      countFacilities(facilities, hasCoordinates),
      totalFacilities
    ),
    percentWithSourceUrls: roundPercent(
      countFacilities(facilities, hasSourceUrl),
      totalFacilities
    ),
    percentWithPriceInfo: roundPercent(
      countFacilities(facilities, hasPriceInfo),
      totalFacilities
    ),
    percentWithInsuranceInfo: roundPercent(
      countFacilities(facilities, hasInsuranceInfo),
      totalFacilities
    ),
    percentWithHours: roundPercent(countFacilities(facilities, hasHours), totalFacilities),
    percentWithServices: roundPercent(
      countFacilities(facilities, hasServices),
      totalFacilities
    ),
    averageQualityScore,
    facilityAudits
  };

  return {
    ...baseAudit,
    topDataGaps,
    recommendedNextSteps: getRecommendedNextSteps(baseAudit, topDataGaps)
  };
}
