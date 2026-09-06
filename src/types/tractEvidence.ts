export type TractEvidenceLayer =
  | "documented_capacity"
  | "community_health_need"
  | "social_barriers"
  | "official_shortage";

export type TractEvidenceEstimateType =
  | "observed"
  | "modeled"
  | "derived"
  | "designation"
  | "unavailable";

export type TractEvidenceObservation = {
  schemaVersion: "1.0.0";
  geography: {
    type: "census_tract";
    geoid: string;
    stateFips: string;
    countyFips: string;
    tractCode: string;
  };
  measure: {
    id: string;
    label: string;
    evidenceLayer: TractEvidenceLayer;
  };
  source: {
    agency: string;
    dataset: string;
    releaseYear: number;
    url: string;
  };
  value: number | string | boolean | null;
  unit: string;
  estimateType: TractEvidenceEstimateType;
  missingness: {
    isMissing: boolean;
    reason: string | null;
  };
  provenance: {
    sourceRecordId: string;
    transformation: string;
    checkedDate: string;
  };
};

export type TractAccessGapState =
  | "potential_access_gap"
  | "elevated_need_without_documented_shortage"
  | "no_current_gap_flag"
  | "insufficient_evidence";

export type TractAccessGapRuleInput = {
  measureId: string;
  value: number | null;
  unit: string;
  operator: ">=" | "<=";
  threshold: number;
  triggered: boolean | null;
  missing: boolean;
  missingReason: string | null;
};

export type TractAccessGapClassification = {
  schemaVersion: "1.0.0";
  ruleVersion: "1.0.0";
  geography: TractEvidenceObservation["geography"];
  state: TractAccessGapState;
  label: string;
  findings: {
    elevatedCommunityHealthNeed: boolean | null;
    elevatedSocialBarriers: boolean | null;
    documentedShortage: boolean | null;
    missingRequiredMeasureIds: string[];
  };
  ruleInputs: TractAccessGapRuleInput[];
  explanations: string[];
  limitations: string[];
  provenance: {
    ruleFile: string;
    sourceEvidenceFamilies: string[];
    sourceCheckedDates: string[];
    generatedDate: string;
  };
};
