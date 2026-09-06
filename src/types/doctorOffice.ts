export type DoctorOfficeSpecialtyId =
  | "pediatrics"
  | "dermatology"
  | "oncology";

export type DoctorOfficeSpecialty = {
  id: DoctorOfficeSpecialtyId;
  label: string;
  officeCount: number;
  providerCount: number;
  sourceSpecialties: string[];
};

export type DoctorOfficeProvider = {
  credentials: string[];
  displayName: string;
  enrollmentIds: string[];
  groupNames: string[];
  normalizedSpecialtyIds: DoctorOfficeSpecialtyId[];
  npi: string;
  nppesStatus: "not_deactivated_in_snapshot";
  primarySpecialties: string[];
  secondarySpecialties: string[];
};

export type DoctorOfficeProvenance = {
  censusGeocoderBenchmark: string;
  censusGeocoderCheckedDate: string;
  censusGeocoderMatchType: string;
  censusGeocoderMatchedAddress: string;
  cmsAddressId: string;
  cmsDatasetId: string;
  cmsReleaseDate: string;
  nppesCheckedDate: string;
  sourceRowIds: string[];
};

export type DoctorOfficeLocation = {
  addressLine1: string;
  addressLine2: string | null;
  addressPrecision: "suite" | "building";
  city: string;
  countyFips: string;
  displayName: string;
  id: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  postalCode: string;
  practiceNames: string[];
  providers: DoctorOfficeProvider[];
  provenance: DoctorOfficeProvenance;
  specialtyIds: DoctorOfficeSpecialtyId[];
  state: "NJ";
};

export type DoctorOfficeSource = {
  checkedDate: string;
  datasetId?: string;
  dataDate?: string;
  downloadUrl?: string;
  name: string;
  nextUpdateDate?: string;
  releaseDate?: string;
  serviceUrl?: string;
  url: string;
};

export type DoctorOfficeArtifact = {
  coverage: {
    candidateOfficeCount?: number;
    cmsQueryRowCount?: number;
    eligibleSourceRowCount?: number;
    explanation: string;
    exclusions?: Record<string, number>;
    geocoderResultDigestSha256?: string;
    isComplete: false;
    nppesDeactivationRecordCount?: number;
    nppesSourceDigestSha256?: string;
    officeCount: number;
    providerCount: number;
    sourceRowDigestSha256?: string;
  };
  generatedAt: string;
  limitations: string[];
  offices: DoctorOfficeLocation[];
  publicationStatus: "foundation_empty" | "validated_pilot";
  refreshPolicy: {
    cadence: "monthly";
    nextReviewDate: string;
    staleAfterDays: number;
  };
  schemaVersion: "1.0.0";
  sources: DoctorOfficeSource[];
  specialtyNormalizationVersion: "1.0.0";
  specialties: DoctorOfficeSpecialty[];
  state: "NJ";
  stateFips: "34";
};
