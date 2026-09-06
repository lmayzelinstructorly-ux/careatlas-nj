export type HealthcareCoverageState = {
  postalCode: string;
  name: string;
  stateFips: string | null;
  facilityCount: number;
  facilitiesWithValidCoordinates: number;
  facilitiesMissingCoordinates: number;
  sourceNames: string[];
  sourceDatasets: string[];
  facilityTypes: string[];
  latestLastVerifiedDate: string | null;
  latestSourceUpdatedDate: string | null;
};

export type HealthcareCoverageSource = {
  name: string;
  facilityCount: number;
  datasets: string[];
  loadedStates: string[];
};

export type HealthcareCoverageSummary = {
  schemaVersion: number;
  generatedFrom: string;
  coverageStatus: "limited_production_coverage";
  totalFacilities: number;
  loadedStates: HealthcareCoverageState[];
  sources: HealthcareCoverageSource[];
  facilityTypes: Array<{
    facilityType: string;
    facilityCount: number;
  }>;
  coordinateCoverage: {
    facilitiesWithValidCoordinates: number;
    facilitiesMissingCoordinates: number;
  };
  dateCoverage: {
    earliestLastVerifiedDate: string | null;
    latestLastVerifiedDate: string | null;
    earliestSourceUpdatedDate: string | null;
    latestSourceUpdatedDate: string | null;
  };
  caveats: string[];
};
