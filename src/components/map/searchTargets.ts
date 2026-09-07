import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { GeographyLevel } from "../../geographyLayers";
import type { BoundarySearchTarget, SelectedGeography } from "../../types";
import { getStateFipsFromFeature } from "../../utils/stateFips";
import { getFeaturePropertyText } from "./boundaryNames";

export function getSearchTargetKey(target: BoundarySearchTarget) {
  return `${target.level}:${target.stateFips}:${target.geoid ?? target.id}`;
}

export function getSearchTargetGeographyLevel(target: BoundarySearchTarget): GeographyLevel {
  if (target.level === "state") {
    return "states";
  }

  if (target.level === "county") {
    return "counties";
  }

  if (target.level === "tract") {
    // The dedicated Batch 8 tract overlay loads the selected county shard.
    // Keep the base boundary layer on towns so county/town outlines and labels
    // remain visible beneath the tract screening colors.
    return "towns";
  }

  return "towns";
}

export function getSelectedGeographyFromFeature(
  feature: Feature<Geometry, GeoJsonProperties>,
  level: GeographyLevel,
  name: string,
  latitude: number,
  longitude: number
): SelectedGeography {
  const stateFips = getStateFipsFromFeature(feature);
  const geoid = getFeaturePropertyText(feature, ["GEOID", "GEOID20", "GEOID10"]);
  const countyFips =
    getFeaturePropertyText(feature, ["COUNTYFP", "COUNTYFP20", "countyfp"]) ??
    (geoid && geoid.length >= 5 ? geoid.slice(2, 5) : null);
  const stateAbbr = getFeaturePropertyText(feature, ["STUSPS", "stusps", "postal"]);

  return {
    countyFips,
    feature,
    geoid,
    latitude,
    level,
    longitude,
    name,
    stateAbbr,
    stateFips
  };
}

export function isSearchTargetFeature(
  feature: Feature<Geometry, GeoJsonProperties>,
  target: BoundarySearchTarget
) {
  const geoid = getFeaturePropertyText(feature, ["GEOID", "GEOID20", "GEOID10"]);
  const geoidFq = getFeaturePropertyText(feature, ["GEOIDFQ"]);
  const cousubNs = getFeaturePropertyText(feature, ["COUSUBNS"]);

  return [geoid, geoidFq, cousubNs].some(
    (value) => value && (value === target.geoid || value === target.id)
  );
}
