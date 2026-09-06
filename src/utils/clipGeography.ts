import type {
  Feature,
  GeoJsonProperties,
  Geometry,
  MultiPolygon as GeoJsonMultiPolygon,
  Polygon as GeoJsonPolygon
} from "geojson";
import {
  intersection,
  type MultiPolygon as ClippingMultiPolygon
} from "polygon-clipping";
import type { GeographyData } from "../hooks/useGeographyData";

type BoundaryFeature = Feature<Geometry, GeoJsonProperties>;
type BoundaryGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

function isBoundaryGeometry(geometry: Geometry): geometry is BoundaryGeometry {
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
}

function toClippingMultiPolygon(
  geometry: BoundaryGeometry
): ClippingMultiPolygon {
  return (geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates) as ClippingMultiPolygon;
}

function getClippedGeometry(
  feature: BoundaryFeature,
  boundary: BoundaryFeature
): BoundaryGeometry | null {
  if (
    !isBoundaryGeometry(feature.geometry) ||
    !isBoundaryGeometry(boundary.geometry)
  ) {
    return null;
  }

  const coordinates = intersection(
    toClippingMultiPolygon(feature.geometry),
    toClippingMultiPolygon(boundary.geometry)
  );

  if (coordinates.length === 0) {
    return null;
  }

  return coordinates.length === 1
    ? {
        type: "Polygon",
        coordinates: coordinates[0] as GeoJsonPolygon["coordinates"]
      }
    : {
        type: "MultiPolygon",
        coordinates: coordinates as GeoJsonMultiPolygon["coordinates"]
      };
}

function hasMappedLand(feature: BoundaryFeature) {
  const mappedLandArea =
    feature.properties?.ALAND ?? feature.properties?.AREALAND;

  if (mappedLandArea === undefined || mappedLandArea === null) {
    return true;
  }

  const numericArea = Number(mappedLandArea);
  return !Number.isFinite(numericArea) || numericArea > 0;
}

export function clipFeatureToBoundary(
  feature: BoundaryFeature,
  boundary: BoundaryFeature
) {
  const geometry = getClippedGeometry(feature, boundary);

  return geometry
    ? {
        ...feature,
        geometry
      }
    : null;
}

export function clipGeographyToBoundary(
  geography: GeographyData,
  boundary: BoundaryFeature,
  { excludeWaterOnly = false }: { excludeWaterOnly?: boolean } = {}
): GeographyData {
  return {
    ...geography,
    features: geography.features.flatMap((feature) => {
      if (excludeWaterOnly && !hasMappedLand(feature)) {
        return [];
      }

      const clippedFeature = clipFeatureToBoundary(feature, boundary);
      return clippedFeature ? [clippedFeature] : [];
    })
  };
}

export function clipGeographyToCountyBoundaries(
  geography: GeographyData,
  counties: GeographyData
): GeographyData {
  const countyByFips = new Map(
    counties.features.map((county) => [
      String(county.properties?.COUNTYFP ?? ""),
      county
    ])
  );

  return {
    ...geography,
    features: geography.features.flatMap((feature) => {
      const county = countyByFips.get(
        String(feature.properties?.COUNTYFP ?? "")
      );
      if (!county) return [];

      const clippedFeature = clipFeatureToBoundary(feature, county);
      return clippedFeature ? [clippedFeature] : [];
    })
  };
}
