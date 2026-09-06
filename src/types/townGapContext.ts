import type { TractAccessGapState } from "./tractEvidence";

export type TownScreeningStateCounts = {
  elevated_need_without_documented_shortage: number;
  insufficient_evidence: number;
  no_current_gap_flag: number;
  potential_access_gap: number;
};

export type TownTractScreeningContext = {
  schemaVersion: string;
  recordType: "town_tract_screening_context";
  geography: {
    type: "county_subdivision";
    geoid: string;
    stateFips: string;
    countyFips: string;
    name: string;
    countyName: string;
  };
  tractContext: {
    primaryAssignedTractCount: number;
    intersectingTractCount: number;
    primaryAssignedTractsCrossingTownBoundaries: number;
    screeningStateCountsForPrimaryAssignedTracts: TownScreeningStateCounts;
    screeningStateCountsForIntersectingTracts: TownScreeningStateCounts;
  };
  dataQuality: {
    hasPrimaryAssignedTracts: boolean;
    hasInsufficientEvidence: boolean;
    requiresPartialTractExplanation: boolean;
  };
};

export type TownTractCrosswalkRecord = {
  geography: {
    geoid: string;
  };
  primaryTown: {
    geoid: string | null;
  };
  screeningState: TractAccessGapState;
  overlaps: Array<{
    townGeoid: string;
  }>;
};

export type CountyTownGapFoundationArtifact = {
  schemaVersion: string;
  recordType: "county_tract_to_town_foundation";
  ruleVersion: string;
  limitations: string[];
  tracts: TownTractCrosswalkRecord[];
  towns: TownTractScreeningContext[];
};
