import type { HealthcareFacility } from "../types/healthcare";
import { getLimitedRowLevelEvidenceSummary } from "./healthcareRowLevelEvidence";

const dayLabels = {
  friday: "Fri",
  monday: "Mon",
  saturday: "Sat",
  sunday: "Sun",
  thursday: "Thu",
  tuesday: "Tue",
  wednesday: "Wed"
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatSourceProvenance(
  facility: HealthcareFacility,
  field: "services" | "hours" | "insurance" | "cost" | "accessibility"
) {
  const source = facility.fieldSources?.[field];

  if (!source || source.status !== "source_backed") {
    return "Not provided in the current record.";
  }

  const sourceTitle = source.sourceTitle ?? source.sourceLabel ?? "field source";
  const checked = source.checkedDate
    ? `checked ${source.checkedDate}`
    : "checked date not listed";

  return `Dataset detail: ${sourceTitle}; ${checked}.`;
}

function formatDailyHours(facility: HealthcareFacility) {
  const entries = (
    Object.entries(dayLabels) as Array<[keyof typeof dayLabels, string]>
  ).flatMap(([day, label]) =>
    hasText(facility.hours?.[day]) ? [`${label}: ${facility.hours[day]}`] : []
  );

  return entries.length > 0
    ? entries.join("; ")
    : "Not provided in the current record.";
}

function formatWeeklyOperatingHoursMetadata(facility: HealthcareFacility) {
  const evidence =
    getLimitedRowLevelEvidenceSummary(facility).weeklyOperatingHoursEvidence;

  if (!evidence) {
    return "Not provided in the current row-level evidence.";
  }

  return `${evidence.operatingHoursPerWeek} hours/week. ${evidence.label}; display/testing metadata only. ${evidence.note} Source: ${evidence.sourceName}; checked ${evidence.lastChecked}.`;
}

function formatLimitedServiceSignal(facility: HealthcareFacility) {
  const evidence = getLimitedRowLevelEvidenceSummary(facility).limitedServiceSignal;

  if (!evidence) {
    return "Not provided in the current row-level evidence.";
  }

  return `${evidence.signal}. ${evidence.label}; display/testing metadata only. ${evidence.note} Source: ${evidence.sourceName}; checked ${evidence.lastChecked}.`;
}

function formatCostDetails(facility: HealthcareFacility) {
  const details = [];

  if (facility.priceInfo?.priceLevel && facility.priceInfo.priceLevel !== "unknown") {
    details.push(`Price level: ${facility.priceInfo.priceLevel.replace("_", " ")}`);
  }

  if (facility.priceInfo?.acceptsSlidingScale !== undefined) {
    details.push(
      facility.priceInfo.acceptsSlidingScale
        ? "Sliding-fee scale listed."
        : "Sliding-fee scale not listed as available."
    );
  }

  if (hasText(facility.priceInfo?.estimatedVisitCost)) {
    details.push(`Estimated visit cost: ${facility.priceInfo.estimatedVisitCost}`);
  }

  if (hasText(facility.priceInfo?.priceNotes)) {
    details.push(facility.priceInfo.priceNotes);
  }

  return details.length > 0 ? details.join(" ") : "Not provided in the current record.";
}

function formatInsuranceDetails(facility: HealthcareFacility) {
  const details = [];

  for (const [label, value] of [
    ["Medicaid", facility.insuranceInfo?.acceptsMedicaid],
    ["Medicare", facility.insuranceInfo?.acceptsMedicare],
    ["Uninsured patients", facility.insuranceInfo?.acceptsUninsured]
  ] as const) {
    if (value !== undefined) {
      details.push(`${label}: ${value ? "listed" : "not listed as accepted"}`);
    }
  }

  if (hasText(facility.insuranceInfo?.insuranceNotes)) {
    details.push(facility.insuranceInfo.insuranceNotes);
  }

  return details.length > 0 ? details.join(" ") : "Not provided in the current record.";
}

export function getHealthcareFacilityAccessDetailItems(
  facility: HealthcareFacility
) {
  return [
    `Services: ${
      facility.services.length > 0
        ? facility.services.join(", ")
        : "Not provided in the current record."
    } ${formatSourceProvenance(facility, "services")}`,
    `Facility type/site type signal: ${formatLimitedServiceSignal(facility)}`,
    `Daily hours: ${formatDailyHours(facility)} ${formatSourceProvenance(
      facility,
      "hours"
    )}`,
    `Weekly operating hours metadata: ${formatWeeklyOperatingHoursMetadata(
      facility
    )}`,
    `Insurance: ${formatInsuranceDetails(facility)} ${formatSourceProvenance(
      facility,
      "insurance"
    )}`,
    `Cost/sliding-fee: ${formatCostDetails(facility)} ${formatSourceProvenance(
      facility,
      "cost"
    )}`,
    `Accessibility: ${
      hasText(facility.accessibilityInfo)
        ? facility.accessibilityInfo
        : "Not provided in the current record."
    } ${formatSourceProvenance(facility, "accessibility")}`
  ];
}
