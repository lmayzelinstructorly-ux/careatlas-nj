import type { HealthcareFacility } from "../types/healthcare";

export const tractFacilityDistanceMethod = {
  earthRadiusMiles: 3958.7613,
  name: "Haversine great-circle distance"
} as const;

export type TractReferencePoint = {
  latitude: number;
  longitude: number;
};

export type NearbySafetyNetCenter = {
  directionsUrl: string;
  distanceMiles: number;
  facility: HealthcareFacility & {
    latitude: number;
    longitude: number;
  };
};

export type TractFacilityProximity = {
  nearestCenters: NearbySafetyNetCenter[];
  withinFiveMiles: number;
  withinTenMiles: number;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function hasCoordinates(
  facility: HealthcareFacility
): facility is HealthcareFacility & { latitude: number; longitude: number } {
  return (
    typeof facility.latitude === "number" &&
    Number.isFinite(facility.latitude) &&
    facility.latitude >= -90 &&
    facility.latitude <= 90 &&
    typeof facility.longitude === "number" &&
    Number.isFinite(facility.longitude) &&
    facility.longitude >= -180 &&
    facility.longitude <= 180
  );
}

export function getGreatCircleMiles(
  first: TractReferencePoint,
  second: TractReferencePoint
) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    tractFacilityDistanceMethod.earthRadiusMiles *
    Math.asin(Math.sqrt(haversine))
  );
}

export function getFacilityDirectionsUrl(
  facility: { latitude: number; longitude: number }
) {
  const destination = `${facility.latitude},${facility.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function getTractFacilityProximity(
  origin: TractReferencePoint,
  facilities: HealthcareFacility[],
  nearestLimit = 3
): TractFacilityProximity {
  const sortedCenters = facilities
    .filter(hasCoordinates)
    .filter(
      (facility) =>
        facility.state === "NJ" &&
        facility.facilityType === "community_health_center" &&
        Boolean(facility.sourceInfo?.sourceUrl)
    )
    .map((facility) => ({
      distanceMiles: getGreatCircleMiles(origin, facility),
      facility
    }))
    .sort(
      (first, second) =>
        first.distanceMiles - second.distanceMiles ||
        first.facility.name.localeCompare(second.facility.name) ||
        first.facility.id.localeCompare(second.facility.id)
    );

  return {
    nearestCenters: sortedCenters.slice(0, nearestLimit).map((center) => ({
      directionsUrl: getFacilityDirectionsUrl(center.facility),
      distanceMiles: Number(center.distanceMiles.toFixed(2)),
      facility: center.facility
    })),
    withinFiveMiles: sortedCenters.filter(
      (center) => center.distanceMiles <= 5
    ).length,
    withinTenMiles: sortedCenters.filter(
      (center) => center.distanceMiles <= 10
    ).length
  };
}
