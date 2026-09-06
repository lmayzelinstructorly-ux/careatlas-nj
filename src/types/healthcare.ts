export type HealthcareFacilityType =
  | "hospital"
  | "clinic"
  | "urgent_care"
  | "community_health_center"
  | "pharmacy"
  | "mental_health"
  | "dental"
  | "other";

export type HealthcarePriceLevel =
  | "free"
  | "low_cost"
  | "standard"
  | "unknown";

export type HealthcareVerificationStatus =
  | "verified"
  | "needs_review"
  | "unverified"
  | "demo";

export type HealthcareDataReadinessLevel =
  | "ready"
  | "needs_review"
  | "insufficient_data";

export type HealthcareImportReadinessStatus =
  | "ready_to_import"
  | "needs_review"
  | "not_ready";

export type HealthcareSourceType =
  | "official"
  | "hospital_system"
  | "state_open_data"
  | "federal_open_data"
  | "manually_collected"
  | "unknown";

export type HealthcareSourceIssueSeverity =
  | "info"
  | "warning"
  | "critical";

export type HealthcareSourceIssue = {
  field: string;
  message: string;
  severity: HealthcareSourceIssueSeverity;
};

export type HealthcareStagingStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_more_source_info";

export type HealthcareStagingIssueSeverity =
  | "info"
  | "warning"
  | "blocker";

export type HealthcareStagingIssueCode =
  | "missing_name"
  | "missing_address"
  | "missing_coordinates"
  | "invalid_coordinates"
  | "coordinates_outside_state_bounds"
  | "state_mismatch"
  | "missing_source_information"
  | "unknown_price_info"
  | "unknown_insurance_info"
  | "unknown_hours"
  | "possible_duplicate"
  | "manual_review_issue"
  | "demo_looking_record"
  | "invalid_facility_type"
  | "invalid_verification_status"
  | "invalid_field_sources"
  | "enrichment_needs_review"
  | "unmapped_source_fields";

export type HealthcareStagingIssue = {
  code: HealthcareStagingIssueCode;
  field: string;
  message: string;
  severity: HealthcareStagingIssueSeverity;
};

export type HealthcareStagingReview = {
  reviewedBy?: string;
  reviewedDate?: string;
  reviewerNotes?: string;
};

export type HealthcareSourceCoverageSummary = {
  recordsReviewed: number;
  recordsImportReady: number;
  missingCoordinates: number;
  missingSourceUrl: number;
  missingPriceInfo: number;
  missingInsuranceInfo: number;
  missingHours: number;
};

export type HealthcareSourceReview = HealthcareSourceCoverageSummary & {
  id: string;
  sourceName: string;
  sourceType: HealthcareSourceType;
  sourceUrl?: string;
  sourceFileName?: string;
  state: string;
  county?: string;
  dateChecked: string;
  readinessStatus: HealthcareImportReadinessStatus;
  issues?: HealthcareSourceIssue[];
  notes?: string;
  isDemo?: boolean;
};

export type HealthcareDataQualityIssueSeverity =
  | "info"
  | "warning"
  | "critical";

export type HealthcareDataQualityIssue = {
  field: string;
  message: string;
  severity: HealthcareDataQualityIssueSeverity;
};

export type HealthcareFacilityDataQualityAudit = {
  facilityId: string;
  facilityName: string;
  readinessLevel: HealthcareDataReadinessLevel;
  qualityScore: number;
  issues: HealthcareDataQualityIssue[];
  missingFields: string[];
  recommendedDataFixes: string[];
};

export type HealthcareDataQualityGap = {
  label: string;
  count: number;
  percent: number;
};

export type HealthcareDataQualityAudit = {
  readinessLevel: HealthcareDataReadinessLevel;
  totalFacilities: number;
  verifiedCount: number;
  needsReviewCount: number;
  unverifiedCount: number;
  demoCount: number;
  percentWithCoordinates: number;
  percentWithSourceUrls: number;
  percentWithPriceInfo: number;
  percentWithInsuranceInfo: number;
  percentWithHours: number;
  percentWithServices: number;
  averageQualityScore: number;
  facilityAudits: HealthcareFacilityDataQualityAudit[];
  topDataGaps: HealthcareDataQualityGap[];
  recommendedNextSteps: string[];
  emptyMessage?: string;
};

export type HealthcareFacilityTypeFilter = HealthcareFacilityType | "all";
export type HealthcarePriceLevelFilter = HealthcarePriceLevel | "all";
export type HealthcareInsuranceAccessFilter =
  | "all"
  | "medicaid"
  | "medicare"
  | "uninsured"
  | "unknown";
export type HealthcareDataReadinessFilter =
  | HealthcareDataReadinessLevel
  | "all";
export type HealthcareSourceStatusFilter =
  | HealthcareVerificationStatus
  | "source_unknown"
  | "all";

export type HealthcareFacilityFilters = {
  dataReadiness: HealthcareDataReadinessFilter;
  facilityType: HealthcareFacilityTypeFilter;
  insuranceAccess: HealthcareInsuranceAccessFilter;
  priceLevel: HealthcarePriceLevelFilter;
  sourceStatus: HealthcareSourceStatusFilter;
};

export type HealthcareFacilityFilterSummary = {
  key: keyof HealthcareFacilityFilters;
  label: string;
  valueLabel: string;
};

export type HealthcareHours = {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  notes?: string;
};

export type HealthcarePriceInfo = {
  priceLevel: HealthcarePriceLevel;
  acceptsSlidingScale?: boolean;
  estimatedVisitCost?: string;
  priceNotes?: string;
};

export type HealthcareInsuranceInfo = {
  acceptsMedicaid?: boolean;
  acceptsMedicare?: boolean;
  acceptsUninsured?: boolean;
  insuranceNotes?: string;
};

export type HealthcareSourceInfo = {
  sourceName: string;
  sourceUrl: string;
  lastChecked: string;
  notes?: string;
};

export type HealthcareEnrichmentField =
  | "services"
  | "hours"
  | "insurance"
  | "cost"
  | "accessibility"
  | "languages"
  | "acceptingPatients";

export type HealthcareFieldSourceStatus = "source_backed" | "needs_review";

export type HealthcareFieldSourceType =
  | "official_facility_page"
  | "health_system_location_page"
  | "federal_open_data"
  | "state_open_data"
  | "local_open_data"
  | "regulated_directory"
  | "approved_nonprofit_directory"
  | "approved_api"
  | "other_official";

export type HealthcareFieldSource = {
  field: HealthcareEnrichmentField;
  status: HealthcareFieldSourceStatus;
  sourceUrl: string;
  sourceTitle?: string;
  sourceLabel?: string;
  checkedDate: string;
  sourceType: HealthcareFieldSourceType;
  locationSpecific: boolean;
  sourceLocationScope?: "facility_location" | "organization" | "dataset" | "directory" | "unknown";
  reviewerNote?: string;
};

export type HealthcareFacility = {
  id: string;
  name: string;
  facilityType: HealthcareFacilityType;
  address: string;
  city: string;
  state: string;
  postalCode?: string;
  stateFips?: string;
  county?: string;
  countyFips?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  services: string[];
  hours: HealthcareHours;
  priceInfo: HealthcarePriceInfo;
  insuranceInfo: HealthcareInsuranceInfo;
  accessibilityInfo?: string;
  languages?: string[];
  languageNotes?: string;
  acceptingPatients?: boolean;
  acceptingPatientsInfo?: string;
  acceptingPatientsNotes?: string;
  sourceInfo?: HealthcareSourceInfo;
  fieldSources?: Partial<Record<HealthcareEnrichmentField, HealthcareFieldSource>>;
  sourceId?: string;
  sourceDataset?: string;
  sourceLastUpdated?: string;
  importDate?: string;
  isDemoData?: boolean;
  dataCompletenessNotes?: string;
  lastVerified?: string;
  verificationStatus: HealthcareVerificationStatus;
};

export type StagedHealthcareFacility = {
  stagingId: string;
  facility: HealthcareFacility;
  stagingStatus: HealthcareStagingStatus;
  stagingIssues: HealthcareStagingIssue[];
  sourceFile: string;
  sourceName: string;
  sourceType: HealthcareSourceType;
  state: string;
  importDate: string;
  review?: HealthcareStagingReview;
  reviewedAt?: string;
  reviewerNotes?: string;
  duplicateWarning?: string;
  missingFieldSummary?: string[];
};
