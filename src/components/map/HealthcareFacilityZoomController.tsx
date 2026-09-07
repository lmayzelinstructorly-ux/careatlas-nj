import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { HealthcareFacility } from "../../types/healthcare";
import type { HealthcareFacilityZoomRequest } from "./mapTypes";

type HealthcareFacilityZoomControllerProps = {
  facilities: HealthcareFacility[];
  zoomRequest: HealthcareFacilityZoomRequest | null;
};

export function hasValidFacilityCoordinates(
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

export function HealthcareFacilityZoomController({
  facilities,
  zoomRequest
}: HealthcareFacilityZoomControllerProps) {
  const map = useMap();
  const lastRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!zoomRequest || lastRequestIdRef.current === zoomRequest.requestId) {
      return;
    }

    lastRequestIdRef.current = zoomRequest.requestId;

    const facility = facilities.find(
      (candidate) => candidate.id === zoomRequest.facilityId
    );

    if (!facility || !hasValidFacilityCoordinates(facility)) {
      return;
    }

    const { latitude, longitude } = facility;

    map.setView(
      [latitude, longitude],
      Math.max(map.getZoom(), 12),
      { animate: true }
    );
  }, [facilities, map, zoomRequest]);

  return null;
}
