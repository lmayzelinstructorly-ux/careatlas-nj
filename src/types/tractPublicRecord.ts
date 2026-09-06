import type {
  TractAccessGapRuleInput,
  TractAccessGapState,
  TractEvidenceObservation
} from "./tractEvidence";

export type TractPublicSource = {
  agency: string;
  dataset: string;
  releaseYear?: number;
  url: string | null;
  checkedDate: string | null;
  sourceId?: string | null;
};

export type TractPublicFacility = {
  id: string;
  name: string;
  facilityType: "community_health_center" | "hospital" | string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  source: TractPublicSource;
  contactAndSourceNotes: string | null;
  missingFields: string[];
  dataCompletenessNotes: string | null;
};

export type TractPublicRuleInput = TractAccessGapRuleInput & {
  label: string;
  meaning: string | null;
  estimateType: TractEvidenceObservation["estimateType"];
  source: TractEvidenceObservation["source"] | null;
  checkedDate: string | null;
  transformation: string | null;
};

export type TractGapDriver = {
  id: string;
  label: string;
  summary: string;
  relatedMeasureIds: string[];
  availableMeasureIds: string[];
  missingMeasureIds: string[];
  interpretation: string;
};

export type TractActionPath = {
  id: string;
  title: string;
  summary: string;
  relatedMeasureIds: string[];
  officialResource: {
    agency: string;
    name: string;
    url: string;
  };
  limitation: string;
  framing: string;
};

export type TractPublicRecord = {
  schemaVersion: "1.1.0";
  recordType: "tract_access_gap_screening_record";
  ruleVersion: "1.0.0";
  generatedDate: string;
  geography: {
    type: "census_tract";
    geoid: string;
    stateFips: "34";
    countyFips: string;
    tractCode: string;
    name: string;
    countyName: string;
    officialInternalPoint: {
      latitude: number;
      longitude: number;
      method: string;
      sourceAgency: string;
      sourceDataset: string;
      checkedDate: string;
    };
  };
  screening: {
    state: TractAccessGapState;
    label: string;
    findings: {
      elevatedCommunityHealthNeed: boolean | null;
      elevatedSocialBarriers: boolean | null;
      documentedShortage: boolean | null;
      missingRequiredMeasureIds: string[];
    };
    ruleInputs: TractPublicRuleInput[];
  };
  evidence: {
    communityHealthNeed: TractEvidenceObservation[];
    socialBarriers: TractEvidenceObservation[];
    officialShortage: TractEvidenceObservation[];
  };
  documentedFacilityContext: {
    countsByType: {
      hrsaCommunityHealthCenters: number;
      cmsHospitals: number;
    };
    loadedFacilitiesInTract: TractPublicFacility[];
    nearestSourceBackedSafetyNetCenter: {
      distanceMiles: number;
      distanceMethod: {
        name: string;
        units: "miles";
        earthRadiusMiles: number;
        note: string;
      };
      facility: TractPublicFacility;
    } | null;
    limitations: string[];
  };
  gapDrivers: TractGapDriver[];
  actionPaths: TractActionPath[];
  missingEvidence: Array<{
    measureId: string;
    label: string;
    reason: string | null;
    requiredByRule: boolean;
  }>;
  explanations: string[];
  limitations: string[];
  sources: TractPublicSource[];
};

export type TractPublicRecordLoadState =
  | "idle"
  | "loading"
  | "ready"
  | "error";
