import type {
  HealthcareFacility,
  HealthcareFacilityDataQualityAudit,
  HealthcareFacilityFilterSummary,
  HealthcareFacilityFilters
} from "../types/healthcare";
import { auditSingleHealthcareFacility } from "./healthcareDataQuality";

export type FilteredHealthcareFacility = {
  facility: HealthcareFacility;
  qualityAudit: HealthcareFacilityDataQualityAudit;
};

export type HealthcareFacilityFilterOption = {
  label: string;
  value: string;
};

export const healthcareFacilityFilterGroups: Array<{
  key: keyof HealthcareFacilityFilters;
  label: string;
  options: HealthcareFacilityFilterOption[];
}> = [
  {
    key: "facilityType",
    label: "Facility type",
    options: [
      { label: "All", value: "all" },
      { label: "Hospital", value: "hospital" },
      { label: "Clinic", value: "clinic" },
      { label: "Urgent care", value: "urgent_care" },
      { label: "Community health center", value: "community_health_center" },
      { label: "Pharmacy", value: "pharmacy" },
      { label: "Mental health", value: "mental_health" },
      { label: "Dental", value: "dental" },
      { label: "Other", value: "other" }
    ]
  },
  {
    key: "priceLevel",
    label: "Price",
    options: [
      { label: "All", value: "all" },
      { label: "Free", value: "free" },
      { label: "Low cost", value: "low_cost" },
      { label: "Standard", value: "standard" },
      { label: "Unknown", value: "unknown" }
    ]
  },
  {
    key: "insuranceAccess",
    label: "Insurance access",
    options: [
      { label: "All", value: "all" },
      { label: "Accepts Medicaid", value: "medicaid" },
      { label: "Accepts Medicare", value: "medicare" },
      { label: "Accepts uninsured", value: "uninsured" },
      { label: "Insurance unknown", value: "unknown" }
    ]
  },
  {
    key: "dataReadiness",
    label: "Data quality",
    options: [
      { label: "All", value: "all" },
      { label: "Ready", value: "ready" },
      { label: "Needs review", value: "needs_review" },
      { label: "Insufficient data", value: "insufficient_data" }
    ]
  },
  {
    key: "sourceStatus",
    label: "Source status",
    options: [
      { label: "All", value: "all" },
      { label: "Verified", value: "verified" },
      { label: "Needs review", value: "needs_review" },
      { label: "Unverified", value: "unverified" },
      { label: "Sample/demo", value: "demo" },
      { label: "Source unknown", value: "source_unknown" }
    ]
  }
];

export const defaultHealthcareFacilityFilters: HealthcareFacilityFilters = {
  dataReadiness: "all",
  facilityType: "all",
  insuranceAccess: "all",
  priceLevel: "all",
  sourceStatus: "all"
};

export function hasActiveHealthcareFacilityFilters(
  filters: HealthcareFacilityFilters
) {
  return Object.entries(filters).some(
    ([key, value]) =>
      defaultHealthcareFacilityFilters[
        key as keyof HealthcareFacilityFilters
      ] !== value
  );
}

export function getActiveHealthcareFacilityFilterSummaries(
  filters: HealthcareFacilityFilters
): HealthcareFacilityFilterSummary[] {
  return healthcareFacilityFilterGroups.flatMap((group) => {
    const value = filters[group.key];

    if (value === defaultHealthcareFacilityFilters[group.key]) {
      return [];
    }

    const option = group.options.find(
      (currentOption) => currentOption.value === value
    );

    return [
      {
        key: group.key,
        label: group.label,
        valueLabel: option?.label ?? String(value)
      }
    ];
  });
}

export function hasValidHealthcareFacilityCoordinates(
  facility: HealthcareFacility
): facility is HealthcareFacility & { latitude: number; longitude: number } {
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

function matchesInsuranceAccess(
  facility: HealthcareFacility,
  filters: HealthcareFacilityFilters
) {
  const insurance = facility.insuranceInfo;

  if (filters.insuranceAccess === "medicaid") {
    return insurance?.acceptsMedicaid === true;
  }

  if (filters.insuranceAccess === "medicare") {
    return insurance?.acceptsMedicare === true;
  }

  if (filters.insuranceAccess === "uninsured") {
    return insurance?.acceptsUninsured === true;
  }

  if (filters.insuranceAccess === "unknown") {
    return (
      !insurance ||
      (insurance.acceptsMedicaid === undefined &&
        insurance.acceptsMedicare === undefined &&
        insurance.acceptsUninsured === undefined)
    );
  }

  return true;
}

function matchesSourceStatus(
  facility: HealthcareFacility,
  filters: HealthcareFacilityFilters
) {
  if (filters.sourceStatus === "source_unknown") {
    return !facility.sourceInfo && !facility.sourceDataset && !facility.sourceId;
  }

  return (
    filters.sourceStatus === "all" ||
    facility.verificationStatus === filters.sourceStatus ||
    (filters.sourceStatus === "demo" && facility.isDemoData === true)
  );
}

export function getFilteredHealthcareFacilities(
  facilities: HealthcareFacility[],
  filters: HealthcareFacilityFilters
): FilteredHealthcareFacility[] {
  return facilities
    .map((facility) => ({
      facility,
      qualityAudit: auditSingleHealthcareFacility(facility)
    }))
    .filter(({ facility, qualityAudit }) => {
      return (
        (filters.facilityType === "all" ||
          facility.facilityType === filters.facilityType) &&
        (filters.priceLevel === "all" ||
          facility.priceInfo?.priceLevel === filters.priceLevel ||
          (filters.priceLevel === "unknown" && !facility.priceInfo)) &&
        matchesInsuranceAccess(facility, filters) &&
        (filters.dataReadiness === "all" ||
          qualityAudit.readinessLevel === filters.dataReadiness) &&
        matchesSourceStatus(facility, filters)
      );
    });
}
