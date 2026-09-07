import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { LatLngBounds } from "leaflet";
import { latLngBounds } from "leaflet";
import { mainlandUsBounds } from "../../mapBounds";
import { getStateFipsFromFeature } from "../../utils/stateFips";

type GeographyData = {
  features: Feature<Geometry, GeoJsonProperties>[];
};

const nonMainlandStateFips = new Set(["02", "15", "60", "66", "69", "72", "78"]);

export type GeoJsonPosition = [number, number] | [number, number, number];
export type LinearRingCoordinates = GeoJsonPosition[];
export type PolygonCoordinates = LinearRingCoordinates[];
export type MultiPolygonCoordinates = PolygonCoordinates[];

export function getFeatureBounds(feature: Feature<Geometry, GeoJsonProperties>) {
  if (
    feature.geometry.type !== "Polygon" &&
    feature.geometry.type !== "MultiPolygon"
  ) {
    return null;
  }

  const positions: GeoJsonPosition[] =
    feature.geometry.type === "Polygon"
      ? (feature.geometry.coordinates as PolygonCoordinates).flat()
      : (feature.geometry.coordinates as MultiPolygonCoordinates).flat(2);

  if (positions.length === 0) {
    return null;
  }

  return positions.reduce(
    (bounds, [longitude, latitude]) => ({
      maxLatitude: Math.max(bounds.maxLatitude, latitude),
      maxLongitude: Math.max(bounds.maxLongitude, longitude),
      minLatitude: Math.min(bounds.minLatitude, latitude),
      minLongitude: Math.min(bounds.minLongitude, longitude)
    }),
    {
      maxLatitude: Number.NEGATIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
      minLatitude: Number.POSITIVE_INFINITY,
      minLongitude: Number.POSITIVE_INFINITY
    }
  );
}

export type FeatureBounds = NonNullable<ReturnType<typeof getFeatureBounds>>;

export function isLower48OrDistrictOfColumbia(
  feature: Feature<Geometry, GeoJsonProperties>
) {
  const stateFips = getStateFipsFromFeature(feature);

  return Boolean(stateFips && !nonMainlandStateFips.has(stateFips));
}

export function getLower48BoundsFromStateData(stateBoundaryData: GeographyData | null) {
  const boundaryBounds = stateBoundaryData?.features
    .filter(isLower48OrDistrictOfColumbia)
    .map(getFeatureBounds)
    .filter((bounds): bounds is FeatureBounds => Boolean(bounds))
    .reduce<FeatureBounds | null>((combinedBounds, bounds) => {
      if (!combinedBounds) {
        return bounds;
      }

      return {
        maxLatitude: Math.max(combinedBounds.maxLatitude, bounds.maxLatitude),
        maxLongitude: Math.max(combinedBounds.maxLongitude, bounds.maxLongitude),
        minLatitude: Math.min(combinedBounds.minLatitude, bounds.minLatitude),
        minLongitude: Math.min(combinedBounds.minLongitude, bounds.minLongitude)
      };
    }, null);

  if (!boundaryBounds) {
    return mainlandUsBounds;
  }

  return latLngBounds(
    [boundaryBounds.minLatitude, boundaryBounds.minLongitude],
    [boundaryBounds.maxLatitude, boundaryBounds.maxLongitude]
  );
}

export function isPointInRing(
  latitude: number,
  longitude: number,
  ring: LinearRingCoordinates
) {
  let isInside = false;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previousIndex];
    const crossesLatitude =
      currentLatitude > latitude !== previousLatitude > latitude;
    const crossingLongitude =
      ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude;

    if (crossesLatitude && longitude < crossingLongitude) {
      isInside = !isInside;
    }
  }

  return isInside;
}

export function isPointInPolygon(
  latitude: number,
  longitude: number,
  polygon: PolygonCoordinates
) {
  const outerRing = polygon[0];

  if (!outerRing || !isPointInRing(latitude, longitude, outerRing)) {
    return false;
  }

  return polygon
    .slice(1)
    .every((hole) => !isPointInRing(latitude, longitude, hole));
}

export function isPointInFeature(
  latitude: number,
  longitude: number,
  feature: Feature<Geometry, GeoJsonProperties>
) {
  if (feature.geometry.type === "Polygon") {
    return isPointInPolygon(
      latitude,
      longitude,
      feature.geometry.coordinates as PolygonCoordinates
    );
  }

  if (feature.geometry.type === "MultiPolygon") {
    return (feature.geometry.coordinates as MultiPolygonCoordinates).some((polygon) =>
      isPointInPolygon(latitude, longitude, polygon)
    );
  }

  return false;
}

export function getBoundsOverlapArea(
  mapBounds: LatLngBounds,
  feature: Feature<Geometry, GeoJsonProperties>
) {
  const featureBounds = getFeatureBounds(feature);

  if (!featureBounds) {
    return 0;
  }

  const west = Math.max(mapBounds.getWest(), featureBounds.minLongitude);
  const east = Math.min(mapBounds.getEast(), featureBounds.maxLongitude);
  const south = Math.max(mapBounds.getSouth(), featureBounds.minLatitude);
  const north = Math.min(mapBounds.getNorth(), featureBounds.maxLatitude);

  return Math.max(0, east - west) * Math.max(0, north - south);
}

export function getLinearRingArea(ring: LinearRingCoordinates) {
  if (ring.length < 3) {
    return 0;
  }

  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [currentX, currentY] = ring[index];
    const [nextX, nextY] = ring[(index + 1) % ring.length];

    area += currentX * nextY - nextX * currentY;
  }

  return area / 2;
}

export function getLinearRingCentroid(ring: LinearRingCoordinates) {
  const signedArea = getLinearRingArea(ring);

  if (Math.abs(signedArea) < Number.EPSILON) {
    return null;
  }

  let longitude = 0;
  let latitude = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [currentX, currentY] = ring[index];
    const [nextX, nextY] = ring[(index + 1) % ring.length];
    const crossProduct = currentX * nextY - nextX * currentY;

    longitude += (currentX + nextX) * crossProduct;
    latitude += (currentY + nextY) * crossProduct;
  }

  return {
    area: Math.abs(signedArea),
    latitude: latitude / (6 * signedArea),
    longitude: longitude / (6 * signedArea)
  };
}

export function getRingBoundsCenter(ring: LinearRingCoordinates) {
  if (ring.length === 0) {
    return null;
  }

  const bounds = ring.reduce(
    (accumulator, [longitude, latitude]) => ({
      maxLatitude: Math.max(accumulator.maxLatitude, latitude),
      maxLongitude: Math.max(accumulator.maxLongitude, longitude),
      minLatitude: Math.min(accumulator.minLatitude, latitude),
      minLongitude: Math.min(accumulator.minLongitude, longitude)
    }),
    {
      maxLatitude: Number.NEGATIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
      minLatitude: Number.POSITIVE_INFINITY,
      minLongitude: Number.POSITIVE_INFINITY
    }
  );

  return {
    area:
      (bounds.maxLongitude - bounds.minLongitude) *
      (bounds.maxLatitude - bounds.minLatitude),
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2
  };
}

type InteriorLabelPoint = {
  clearance: number;
  latitude: number;
  longitude: number;
};

function getSquaredDistanceToSegment(
  longitude: number,
  latitude: number,
  start: GeoJsonPosition,
  end: GeoJsonPosition
) {
  let segmentLongitude = end[0] - start[0];
  let segmentLatitude = end[1] - start[1];
  let pointLongitude = longitude - start[0];
  let pointLatitude = latitude - start[1];
  const segmentLengthSquared =
    segmentLongitude * segmentLongitude + segmentLatitude * segmentLatitude;

  if (segmentLengthSquared > 0) {
    const projection = Math.max(
      0,
      Math.min(
        1,
        (pointLongitude * segmentLongitude + pointLatitude * segmentLatitude) /
          segmentLengthSquared
      )
    );

    segmentLongitude *= projection;
    segmentLatitude *= projection;
  }

  pointLongitude -= segmentLongitude;
  pointLatitude -= segmentLatitude;

  return pointLongitude * pointLongitude + pointLatitude * pointLatitude;
}

function getPolygonBoundaryClearance(
  latitude: number,
  longitude: number,
  polygon: PolygonCoordinates
) {
  let minimumDistanceSquared = Number.POSITIVE_INFINITY;

  for (const ring of polygon) {
    for (let index = 0; index < ring.length; index += 1) {
      minimumDistanceSquared = Math.min(
        minimumDistanceSquared,
        getSquaredDistanceToSegment(
          longitude,
          latitude,
          ring[index],
          ring[(index + 1) % ring.length]
        )
      );
    }
  }

  return Math.sqrt(minimumDistanceSquared);
}

function getInteriorLabelCandidate(
  latitude: number,
  longitude: number,
  polygon: PolygonCoordinates
): InteriorLabelPoint | null {
  if (!isPointInPolygon(latitude, longitude, polygon)) {
    return null;
  }

  return {
    clearance: getPolygonBoundaryClearance(latitude, longitude, polygon),
    latitude,
    longitude
  };
}

function getBetterInteriorLabelPoint(
  current: InteriorLabelPoint | null,
  candidate: InteriorLabelPoint | null
) {
  if (!candidate || (current && current.clearance >= candidate.clearance)) {
    return current;
  }

  return candidate;
}

function findInteriorLabelPoint(polygon: PolygonCoordinates) {
  const outerRing = polygon[0];
  const boundsCenter = outerRing ? getRingBoundsCenter(outerRing) : null;

  if (!outerRing || !boundsCenter) {
    return null;
  }

  const bounds = outerRing.reduce(
    (current, [longitude, latitude]) => ({
      maxLatitude: Math.max(current.maxLatitude, latitude),
      maxLongitude: Math.max(current.maxLongitude, longitude),
      minLatitude: Math.min(current.minLatitude, latitude),
      minLongitude: Math.min(current.minLongitude, longitude)
    }),
    {
      maxLatitude: Number.NEGATIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
      minLatitude: Number.POSITIVE_INFINITY,
      minLongitude: Number.POSITIVE_INFINITY
    }
  );
  let bestPoint: InteriorLabelPoint | null = null;

  bestPoint = getInteriorLabelCandidate(
    boundsCenter.latitude,
    boundsCenter.longitude,
    polygon
  );

  const gridSize = 12;

  for (let row = 0; row < gridSize; row += 1) {
    const latitude =
      bounds.minLatitude +
      ((row + 0.5) / gridSize) *
        (bounds.maxLatitude - bounds.minLatitude);

    for (let column = 0; column < gridSize; column += 1) {
      const longitude =
        bounds.minLongitude +
        ((column + 0.5) / gridSize) *
          (bounds.maxLongitude - bounds.minLongitude);

      bestPoint = getBetterInteriorLabelPoint(
        bestPoint,
        getInteriorLabelCandidate(latitude, longitude, polygon)
      );
    }
  }

  const vertexStep = Math.max(1, Math.ceil(outerRing.length / 80));

  for (let index = 0; index < outerRing.length; index += vertexStep) {
    const [vertexLongitude, vertexLatitude] = outerRing[index];

    bestPoint = getBetterInteriorLabelPoint(
      bestPoint,
      getInteriorLabelCandidate(
        (vertexLatitude + boundsCenter.latitude) / 2,
        (vertexLongitude + boundsCenter.longitude) / 2,
        polygon
      )
    );
  }

  if (!bestPoint) {
    return null;
  }

  let latitudeStep = (bounds.maxLatitude - bounds.minLatitude) / gridSize;
  let longitudeStep = (bounds.maxLongitude - bounds.minLongitude) / gridSize;

  for (let pass = 0; pass < 3; pass += 1) {
    const center = bestPoint;

    if (!center) {
      break;
    }

    for (let row = -2; row <= 2; row += 1) {
      for (let column = -2; column <= 2; column += 1) {
        bestPoint = getBetterInteriorLabelPoint(
          bestPoint,
          getInteriorLabelCandidate(
            center.latitude + row * latitudeStep,
            center.longitude + column * longitudeStep,
            polygon
          )
        );
      }
    }

    latitudeStep /= 3;
    longitudeStep /= 3;
  }

  return bestPoint;
}

export function getPolygonLabelPoint(polygon: PolygonCoordinates) {
  const outerRing = polygon[0];

  if (!outerRing) {
    return null;
  }

  const centroid = getLinearRingCentroid(outerRing);

  if (
    polygon.length === 1 &&
    centroid &&
    isPointInPolygon(centroid.latitude, centroid.longitude, polygon)
  ) {
    return centroid;
  }

  const interiorPoint = findInteriorLabelPoint(polygon);

  if (interiorPoint) {
    return {
      area:
        centroid?.area ??
        getRingBoundsCenter(outerRing)?.area ??
        Number.EPSILON,
      latitude: interiorPoint.latitude,
      longitude: interiorPoint.longitude
    };
  }

  return centroid ?? getRingBoundsCenter(outerRing);
}

export function getFeatureLabelPoint(feature: Feature<Geometry, GeoJsonProperties>) {
  if (feature.geometry.type === "Polygon") {
    return getPolygonLabelPoint(feature.geometry.coordinates as PolygonCoordinates);
  }

  if (feature.geometry.type === "MultiPolygon") {
    return (feature.geometry.coordinates as MultiPolygonCoordinates)
      .map(getPolygonLabelPoint)
      .filter((point): point is NonNullable<ReturnType<typeof getPolygonLabelPoint>> =>
        Boolean(point)
      )
      .sort((a, b) => b.area - a.area)[0] ?? null;
  }

  return null;
}

function getPolygonInteriorPoint(polygon: PolygonCoordinates) {
  const interiorPoint = findInteriorLabelPoint(polygon);

  if (!interiorPoint) {
    return getPolygonLabelPoint(polygon);
  }

  return {
    area: Math.abs(getLinearRingArea(polygon[0] ?? [])),
    latitude: interiorPoint.latitude,
    longitude: interiorPoint.longitude
  };
}

export function getFeatureInteriorPoint(
  feature: Feature<Geometry, GeoJsonProperties>
) {
  if (feature.geometry.type === "Polygon") {
    return getPolygonInteriorPoint(
      feature.geometry.coordinates as PolygonCoordinates
    );
  }

  if (feature.geometry.type === "MultiPolygon") {
    return (feature.geometry.coordinates as MultiPolygonCoordinates)
      .map(getPolygonInteriorPoint)
      .filter(
        (point): point is NonNullable<ReturnType<typeof getPolygonInteriorPoint>> =>
          Boolean(point)
      )
      .sort((a, b) => b.area - a.area)[0] ?? null;
  }

  return null;
}
