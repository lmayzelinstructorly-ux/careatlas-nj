import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { PathOptions } from "leaflet";
import type { GeographyLevel } from "../../geographyLayers";
import { geographyLayerConfigs } from "../../geographyLayers";
import { careAtlasColors } from "../../theme/colors";
import type { SelectedGeography } from "../../types";
import type {
  BoundaryHealthcareSummariesArtifact,
  BoundaryHealthcareSummary,
  BoundaryHealthcareSummaryLevel
} from "../../utils/boundaryHealthcareSummary";
import {
  getBoundaryFeatureGeoid,
  getBoundaryHealthcareAccessCategory
} from "../../utils/boundaryHealthcareSummary";
import { getGeographyFeatureColorKey } from "../../utils/geographyColors";
import { getStateFipsFromFeature } from "../../utils/stateFips";
import { getFeatureName, isNewJerseyState } from "./boundaryNames";
import type { RoadMode } from "./mapTypes";

export function shouldDrillIntoFeature(
  feature: Feature<Geometry, GeoJsonProperties>,
  level: GeographyLevel
) {
  if (level === "states") {
    return Boolean(getStateFipsFromFeature(feature) || isNewJerseyState(feature));
  }

  return level === "counties" || level === "towns";
}

export function getRoadModeBoundaryStyle(
  baseStyle: PathOptions,
  roadMode: RoadMode,
  isSelected: boolean,
  isHovered: boolean
): PathOptions {
  if (roadMode === "off") {
    return baseStyle;
  }

  const roadVisibleFillOpacityOffset =
    roadMode === "labeled" ? -0.06 : 0;

  if (isSelected) {
    return {
      ...baseStyle,
      fillOpacity: isHovered
        ? 0.62 + roadVisibleFillOpacityOffset
        : 0.52 + roadVisibleFillOpacityOffset,
      opacity: 1,
      weight: isHovered ? 3.8 : 3.45
    };
  }

  return {
    ...baseStyle,
    fillOpacity: isHovered
      ? 0.42 + roadVisibleFillOpacityOffset
      : 0.3 + roadVisibleFillOpacityOffset,
    opacity: isHovered ? 1 : 0.92,
    weight: isHovered ? 2.3 : 1.65
  };
}

export function getBoundaryHealthcareSummaryLevel(
  level: GeographyLevel
): BoundaryHealthcareSummaryLevel {
  if (level === "states") {
    return "state";
  }

  if (level === "counties") {
    return "county";
  }

  if (level === "tracts") {
    return "local_jurisdiction";
  }

  return "local_jurisdiction";
}

export function getHealthcareAccessSummaryForFeature(
  feature: Feature<Geometry, GeoJsonProperties>,
  level: GeographyLevel,
  summariesArtifact: BoundaryHealthcareSummariesArtifact | null
): BoundaryHealthcareSummary | null {
  if (!summariesArtifact || level === "tracts") {
    return null;
  }

  const boundaryLevel = getBoundaryHealthcareSummaryLevel(level);
  const boundaryId = getBoundaryFeatureGeoid(feature);

  if (!boundaryId) {
    return null;
  }

  const materializedSummary =
    summariesArtifact.summaries[boundaryLevel][boundaryId];

  if (materializedSummary) {
    return materializedSummary;
  }

  const policy = summariesArtifact.noAssignedFacilityPolicy;

  return {
    boundaryId,
    boundaryLevel,
    boundaryName: getFeatureName(feature, getSelectedFeatureFallback(level)),
    countyFips: null,
    cousubFips: null,
    dataCompletenessNotes: policy.dataCompletenessNotes,
    facilitiesMissingCoordinates: 0,
    facilitiesWithValidCoordinates: 0,
    facilityTypeCounts: {},
    missingDataWarnings: policy.missingDataWarnings,
    sourceCoverageNotes: policy.sourceCoverageNotes,
    sourceFacilityIds: [],
    stateFips: getStateFipsFromFeature(feature),
    statuses: policy.statuses,
    summaryStatus: policy.summaryStatus,
    totalAssignedFacilities: policy.totalAssignedFacilities
  };
}

export function getHealthcareAccessBoundaryStyle(
  feature: Feature<Geometry, GeoJsonProperties>,
  level: GeographyLevel,
  selectedColorKey: string | null,
  summariesArtifact: BoundaryHealthcareSummariesArtifact | null
): PathOptions {
  const featureColorKey = getGeographyFeatureColorKey(feature, level);
  const isSelected = featureColorKey === selectedColorKey;

  if (isSelected) {
    return {
      color: careAtlasColors.deepNavy,
      fillColor: careAtlasColors.aqua,
      fillOpacity: 0.7,
      opacity: 1,
      weight: 3.5
    };
  }

  const summary = getHealthcareAccessSummaryForFeature(
    feature,
    level,
    summariesArtifact
  );
  const category = getBoundaryHealthcareAccessCategory(summary);

  return {
    color: category.lineColor,
    fillColor: category.color,
    fillOpacity:
      category.id === "no_mapped_source_backed_facilities" ? 0.72 : 0.64,
    opacity: 0.9,
    weight: category.id === "no_mapped_source_backed_facilities" ? 1.1 : 1.45
  };
}

export function getHealthcareAccessBoundaryHoverStyle(
  feature: Feature<Geometry, GeoJsonProperties>,
  level: GeographyLevel,
  selectedColorKey: string | null,
  summariesArtifact: BoundaryHealthcareSummariesArtifact | null
): PathOptions {
  const baseStyle = getHealthcareAccessBoundaryStyle(
    feature,
    level,
    selectedColorKey,
    summariesArtifact
  );
  const isSelected =
    getGeographyFeatureColorKey(feature, level) === selectedColorKey;

  return {
    ...baseStyle,
    color: careAtlasColors.deepNavy,
    fillOpacity: isSelected ? 0.74 : 0.78,
    opacity: 1,
    weight: isSelected ? 3.8 : 2.3
  };
}

export function getSelectedFeatureFallback(level: GeographyLevel) {
  if (level === "counties") {
    return "Unnamed county";
  }

  if (level === "tracts") {
    return "Unnamed census tract";
  }

  return `Unnamed ${geographyLayerConfigs[level].label.toLowerCase().slice(0, -1)}`;
}

export function getDrillTargetZoom(level: GeographyLevel) {
  if (level === "states") {
    return geographyLayerConfigs.counties.minZoom;
  }

  if (level === "counties") {
    return geographyLayerConfigs.towns.minZoom;
  }

  if (level === "towns") {
    return null;
  }

  return null;
}

export function getSelectedGeographyLevelLabel(level: GeographyLevel) {
  if (level === "states") {
    return "State";
  }

  if (level === "counties") {
    return "County";
  }

  if (level === "tracts") {
    return "Census tract";
  }

  return "Town or township";
}

export function getSelectedGeographyOfficialId(selectedGeography: SelectedGeography) {
  return selectedGeography.geoid ?? null;
}
