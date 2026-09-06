import { startTransition, useEffect, useState } from "react";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { SelectedGeography } from "../types";

export type BoundaryHealthcareSummaryLevel =
  | "county"
  | "local_jurisdiction"
  | "state";

export type BoundaryHealthcareSummaryStatus =
  | "has_facilities"
  | "limited_data"
  | "no_assigned_facilities"
  | "score_unavailable";

export type BoundaryHealthcareSummary = {
  boundaryId: string;
  boundaryLevel: BoundaryHealthcareSummaryLevel;
  boundaryName: string;
  countyFips: string | null;
  cousubFips: string | null;
  dataCompletenessNotes: string[];
  facilitiesMissingCoordinates: number;
  facilitiesWithValidCoordinates: number;
  facilityTypeCounts: Record<string, number>;
  missingDataWarnings: string[];
  sourceCoverageNotes: string[];
  sourceFacilityIds: string[];
  stateFips: string | null;
  statuses: BoundaryHealthcareSummaryStatus[];
  summaryStatus: BoundaryHealthcareSummaryStatus;
  totalAssignedFacilities: number;
};

export type BoundaryHealthcareNoAssignedPolicy = Pick<
  BoundaryHealthcareSummary,
  | "dataCompletenessNotes"
  | "missingDataWarnings"
  | "sourceCoverageNotes"
  | "statuses"
  | "summaryStatus"
  | "totalAssignedFacilities"
>;

export type BoundaryHealthcareSummariesArtifact = {
  metadata?: {
    generatedAt?: string;
    summaryMethod?: string;
  };
  noAssignedFacilityPolicy: BoundaryHealthcareNoAssignedPolicy;
  summaries: Record<
    BoundaryHealthcareSummaryLevel,
    Record<string, BoundaryHealthcareSummary>
  >;
};

export type BoundaryHealthcareSummaryLoadState =
  | "error"
  | "idle"
  | "loading"
  | "ready";

export type BoundaryHealthcareSummaryLookup =
  | {
      kind: "not_selected";
    }
  | {
      boundaryId: string | null;
      boundaryLevel: BoundaryHealthcareSummaryLevel;
      kind: "missing_stable_id";
    }
  | {
      boundaryId: string;
      boundaryLevel: BoundaryHealthcareSummaryLevel;
      kind: "materialized" | "no_assigned_policy";
      summary: BoundaryHealthcareSummary;
    }
  | {
      boundaryId: string;
      boundaryLevel: BoundaryHealthcareSummaryLevel;
      kind: "unavailable";
    }
  | {
      boundaryId: string | null;
      kind: "tract_foundation";
    };

export type HealthcareAccessChoroplethCategoryId =
  | "stronger_mapped_access"
  | "moderate_mapped_access"
  | "limited_mapped_access"
  | "no_mapped_source_backed_facilities"
  | "insufficient_data";

export type HealthcareAccessChoroplethCategory = {
  color: string;
  description: string;
  id: HealthcareAccessChoroplethCategoryId;
  label: string;
  lineColor: string;
};

export const healthcareAccessChoroplethCategories: HealthcareAccessChoroplethCategory[] =
  [
    {
      color: "#55B947",
      description: "More mapped source-backed facility records; not a measure of access quality.",
      id: "stronger_mapped_access",
      label: "More mapped facilities",
      lineColor: "#2F7D2A"
    },
    {
      color: "#18C7C0",
      description: "Some mapped source-backed facility records; not complete coverage.",
      id: "moderate_mapped_access",
      label: "Some mapped facilities",
      lineColor: "#0D7D82"
    },
    {
      color: "#009CA6",
      description: "Few mapped source-backed facility records; missing coverage is not negative evidence.",
      id: "limited_mapped_access",
      label: "Few mapped facilities",
      lineColor: "#006E78"
    },
    {
      color: "#FFFFFF",
      description: "Coverage is not loaded in the current source view; this does not mean zero healthcare.",
      id: "no_mapped_source_backed_facilities",
      label: "Facility coverage not loaded",
      lineColor: "#D6E8EB"
    },
    {
      color: "#003B66",
      description: "Required facility-count evidence is unavailable.",
      id: "insufficient_data",
      label: "Limited data view",
      lineColor: "#002B4D"
    }
  ];

const healthcareAccessChoroplethCategoryById = new Map(
  healthcareAccessChoroplethCategories.map((category) => [category.id, category])
);

export function getHealthcareAccessChoroplethCategoryById(
  id: HealthcareAccessChoroplethCategoryId
) {
  return healthcareAccessChoroplethCategoryById.get(id) ??
    healthcareAccessChoroplethCategoryById.get("insufficient_data")!;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getPropertyText(
  feature: Feature<Geometry, GeoJsonProperties> | null | undefined,
  propertyNames: string[]
) {
  if (!feature?.properties) {
    return null;
  }

  for (const propertyName of propertyNames) {
    const value = feature.properties[propertyName];

    if ((typeof value === "string" && value.trim()) || typeof value === "number") {
      return String(value).trim();
    }
  }

  return null;
}

function getBoundaryLevel(
  level: SelectedGeography["level"]
): BoundaryHealthcareSummaryLevel {
  if (level === "states") {
    return "state";
  }

  if (level === "counties") {
    return "county";
  }

  return "local_jurisdiction";
}

export function getBoundaryGeoid(boundary: SelectedGeography | null) {
  return (
    boundary?.geoid ??
    getPropertyText(boundary?.feature, ["GEOID", "GEOID20", "GEOID10"]) ??
    null
  );
}

export function getBoundaryFeatureGeoid(
  feature: Feature<Geometry, GeoJsonProperties> | null | undefined
) {
  return getPropertyText(feature, ["GEOID", "GEOID20", "GEOID10"]);
}

function getBoundaryStateFips(boundary: SelectedGeography | null) {
  return (
    boundary?.stateFips ??
    getPropertyText(boundary?.feature, ["STATEFP", "STATEFP20", "statefp"]) ??
    getBoundaryGeoid(boundary)?.slice(0, 2) ??
    null
  );
}

function getBoundaryCountyFips(boundary: SelectedGeography | null) {
  const directCountyFips =
    boundary?.countyFips ??
    getPropertyText(boundary?.feature, ["COUNTYFP", "COUNTYFP20", "countyfp"]);

  if (directCountyFips) {
    return directCountyFips.padStart(3, "0");
  }

  const geoid = getBoundaryGeoid(boundary);

  return geoid && geoid.length >= 5 ? geoid.slice(2, 5) : null;
}

function getBoundaryCousubFips(boundary: SelectedGeography | null) {
  const directCousubFips = getPropertyText(boundary?.feature, [
    "COUSUBFP",
    "COUSUBFP20",
    "cousubfp"
  ]);

  if (directCousubFips) {
    return directCousubFips.padStart(5, "0");
  }

  const geoid = getBoundaryGeoid(boundary);

  return geoid && geoid.length >= 10 ? geoid.slice(5, 10) : null;
}

function isSummariesArtifact(
  value: unknown
): value is BoundaryHealthcareSummariesArtifact {
  return (
    isObject(value) &&
    isObject(value.noAssignedFacilityPolicy) &&
    isObject(value.summaries) &&
    isObject(value.summaries.state) &&
    isObject(value.summaries.county) &&
    isObject(value.summaries.local_jurisdiction)
  );
}

function createNoAssignedBoundarySummary(
  boundary: SelectedGeography,
  boundaryId: string,
  boundaryLevel: BoundaryHealthcareSummaryLevel,
  policy: BoundaryHealthcareNoAssignedPolicy
): BoundaryHealthcareSummary {
  return {
    boundaryId,
    boundaryLevel,
    boundaryName: boundary.name,
    countyFips: getBoundaryCountyFips(boundary),
    cousubFips: getBoundaryCousubFips(boundary),
    dataCompletenessNotes: policy.dataCompletenessNotes,
    facilitiesMissingCoordinates: 0,
    facilitiesWithValidCoordinates: 0,
    facilityTypeCounts: {},
    missingDataWarnings: policy.missingDataWarnings,
    sourceCoverageNotes: policy.sourceCoverageNotes,
    sourceFacilityIds: [],
    stateFips: getBoundaryStateFips(boundary),
    statuses: policy.statuses,
    summaryStatus: policy.summaryStatus,
    totalAssignedFacilities: policy.totalAssignedFacilities
  };
}

export function lookupBoundaryHealthcareSummary(
  selectedBoundary: SelectedGeography | null,
  artifact: BoundaryHealthcareSummariesArtifact | null
): BoundaryHealthcareSummaryLookup {
  if (!selectedBoundary) {
    return { kind: "not_selected" };
  }

  if (selectedBoundary.level === "tracts") {
    return {
      boundaryId: getBoundaryGeoid(selectedBoundary),
      kind: "tract_foundation"
    };
  }

  const boundaryLevel = getBoundaryLevel(selectedBoundary.level);
  const boundaryId = getBoundaryGeoid(selectedBoundary);

  if (!boundaryId) {
    return {
      boundaryId,
      boundaryLevel,
      kind: "missing_stable_id"
    };
  }

  if (!artifact) {
    return {
      boundaryId,
      boundaryLevel,
      kind: "unavailable"
    };
  }

  const materializedSummary = artifact.summaries[boundaryLevel][boundaryId];

  if (materializedSummary) {
    return {
      boundaryId,
      boundaryLevel,
      kind: "materialized",
      summary: materializedSummary
    };
  }

  return {
    boundaryId,
    boundaryLevel,
    kind: "no_assigned_policy",
    summary: createNoAssignedBoundarySummary(
      selectedBoundary,
      boundaryId,
      boundaryLevel,
      artifact.noAssignedFacilityPolicy
    )
  };
}

export function getBoundaryHealthcareAccessCategory(
  summary: BoundaryHealthcareSummary | null
): HealthcareAccessChoroplethCategory {
  if (!summary) {
    return getHealthcareAccessChoroplethCategoryById("insufficient_data");
  }

  if (summary.totalAssignedFacilities === 0) {
    return getHealthcareAccessChoroplethCategoryById(
      "no_mapped_source_backed_facilities"
    );
  }

  if (summary.totalAssignedFacilities >= 20) {
    return getHealthcareAccessChoroplethCategoryById("stronger_mapped_access");
  }

  if (summary.totalAssignedFacilities >= 5) {
    return getHealthcareAccessChoroplethCategoryById("moderate_mapped_access");
  }

  return getHealthcareAccessChoroplethCategoryById("limited_mapped_access");
}

let boundaryHealthcareSummariesRequest: Promise<BoundaryHealthcareSummariesArtifact> | null =
  null;

function requestBoundaryHealthcareSummaries() {
  if (boundaryHealthcareSummariesRequest) {
    return boundaryHealthcareSummariesRequest;
  }

  boundaryHealthcareSummariesRequest = fetch(
    "/data/healthcare/boundary-healthcare-summaries.json"
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data: unknown = await response.json();

      if (!isSummariesArtifact(data)) {
        throw new Error("Boundary healthcare summary data has an unexpected shape.");
      }

      return data;
    })
    .catch((error) => {
      boundaryHealthcareSummariesRequest = null;
      throw error;
    });

  return boundaryHealthcareSummariesRequest;
}

export function useBoundaryHealthcareSummaries(enabled = false) {
  const [artifact, setArtifact] =
    useState<BoundaryHealthcareSummariesArtifact | null>(null);
  const [error, setError] = useState("");
  const [loadState, setLoadState] =
    useState<BoundaryHealthcareSummaryLoadState>("idle");

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isMounted = true;
    setLoadState("loading");
    setError("");

    async function loadBoundarySummaries() {
      try {
        const data = await requestBoundaryHealthcareSummaries();

        if (isMounted) {
          startTransition(() => {
            setArtifact(data);
            setError("");
            setLoadState("ready");
          });
        }
      } catch (loadError) {
        if (isMounted) {
          setArtifact(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Boundary healthcare summaries could not be loaded."
          );
          setLoadState("error");
        }
      }
    }

    loadBoundarySummaries();

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  return {
    artifact,
    error,
    loadState
  };
}
