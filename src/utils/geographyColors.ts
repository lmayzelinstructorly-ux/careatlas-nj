import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { PathOptions } from "leaflet";
import type { GeographyLevel } from "../geographyLayers";
import { careAtlasColors } from "../theme/colors";

type GeographyFeature = Feature<Geometry, GeoJsonProperties>;

type GeographyColor = {
  fill: string;
  hoverFill: string;
  line: string;
};

export const townBoundaryFill = "#E4EFEE";
const townBoundaryColors: GeographyColor = {
  fill: townBoundaryFill,
  hoverFill: "#C6E1DE",
  line: "#3D6F78"
};

const geoidPropertyPriority = [
  "GEOID",
  "geoid",
  "GEOID20",
  "GEOID10",
  "GEOIDFQ",
  "COUNTYFP",
  "COUNTYFP20",
  "STATEFP",
  "STATEFP20"
] as const;

const namePropertyPriority = [
  "NAME",
  "name",
  "NAMELSAD",
  "town",
  "TOWN",
  "townName",
  "TOWN_NAME",
  "municipality",
  "MUNICIPALITY",
  "MUN_LABEL"
] as const;

function getStablePropertyValue(
  properties: GeoJsonProperties,
  propertyPriority: readonly string[]
) {
  if (!properties) {
    return null;
  }

  for (const propertyName of propertyPriority) {
    const value = properties[propertyName];

    if (
      (typeof value === "string" && value.trim().length > 0) ||
      typeof value === "number"
    ) {
      return String(value).trim();
    }
  }

  return null;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getFeatureStableIdentifier(feature: GeographyFeature) {
  const geoidValue = getStablePropertyValue(
    feature.properties,
    geoidPropertyPriority
  );

  if (geoidValue) {
    return `geoid:${geoidValue}`;
  }

  const nameValue = getStablePropertyValue(
    feature.properties,
    namePropertyPriority
  );

  if (nameValue) {
    return `name:${nameValue}`;
  }

  if (typeof feature.id === "string" || typeof feature.id === "number") {
    return `id:${String(feature.id)}`;
  }

  return `geometry:${JSON.stringify(feature.geometry)}`;
}

export function getGeographyFeatureColorKey(
  feature: GeographyFeature,
  level: GeographyLevel
) {
  return `${level}:${getFeatureStableIdentifier(feature).toLowerCase()}`;
}

export function getGeographyFeatureColors(
  feature: GeographyFeature,
  level: GeographyLevel
): GeographyColor {
  const colorKey = getGeographyFeatureColorKey(feature, level);
  const colorHash = hashString(colorKey);

  if (level === "towns") {
    return townBoundaryColors;
  }

  const hue =
    level === "counties"
      ? 194 + (colorHash % 34)
      : colorHash % 360;
  const saturation = level === "counties" ? 42 + (colorHash % 10) : 38 + (colorHash % 12);
  const fillLightness = 84 + (colorHash % 7);
  const hoverLightness = fillLightness - 8;

  return {
    fill: `hsl(${hue} ${saturation}% ${fillLightness}%)`,
    hoverFill: `hsl(${hue} ${saturation + 8}% ${hoverLightness}%)`,
    line: `hsl(${hue} ${Math.max(34, saturation - 4)}% 40%)`
  };
}

export function getGeographyBoundaryStyle(
  feature: GeographyFeature,
  level: GeographyLevel,
  selectedColorKey: string | null
): PathOptions {
  const featureColorKey = getGeographyFeatureColorKey(feature, level);
  const featureColor = getGeographyFeatureColors(feature, level);

  if (featureColorKey === selectedColorKey) {
    return {
      color: careAtlasColors.deepNavy,
      fillColor: careAtlasColors.aqua,
      fillOpacity: level === "towns" ? 0.9 : 0.58,
      opacity: 1,
      weight: 3.2
    };
  }

  return {
    color: featureColor.line,
    fillColor: featureColor.fill,
    fillOpacity: level === "towns" ? 1 : 0.46,
    opacity: level === "towns" ? 0.96 : 0.82,
    weight: level === "counties" ? 1.7 : 1.55
  };
}

export function getGeographyBoundaryHoverStyle(
  feature: GeographyFeature,
  level: GeographyLevel,
  selectedColorKey: string | null
): PathOptions {
  const featureColorKey = getGeographyFeatureColorKey(feature, level);
  const featureColor = getGeographyFeatureColors(feature, level);
  const isSelected = featureColorKey === selectedColorKey;

  return {
    color: careAtlasColors.deepNavy,
    fillColor: isSelected ? careAtlasColors.aqua : featureColor.hoverFill,
    fillOpacity: isSelected ? 0.94 : level === "towns" ? 1 : 0.56,
    opacity: isSelected ? 1 : 0.94,
    weight: isSelected ? 3.6 : level === "towns" ? 2.35 : 2.1
  };
}
