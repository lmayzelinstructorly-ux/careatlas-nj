import { useEffect } from "react";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { CircleMarker, Tooltip, useMap } from "react-leaflet";
import { getFeatureBounds } from "./geometry";

export type AddressTractNavigationRequest = {
  feature: Feature<Geometry, GeoJsonProperties>;
  latitude: number;
  longitude: number;
  requestId: number;
};

export function AddressTractLocation({
  request
}: {
  request: AddressTractNavigationRequest | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!request) return;
    const bounds = getFeatureBounds(request.feature);
    if (!bounds) return;

    map.fitBounds(
      [
        [bounds.minLatitude, bounds.minLongitude],
        [bounds.maxLatitude, bounds.maxLongitude]
      ],
      { animate: false, maxZoom: 12, padding: [44, 44] }
    );
  }, [map, request]);

  if (!request) return null;

  return (
    <CircleMarker
      center={[request.latitude, request.longitude]}
      interactive
      pane="address-location"
      pathOptions={{
        color: "#002B4D",
        fillColor: "#FBBF24",
        fillOpacity: 1,
        opacity: 1,
        weight: 3
      }}
      radius={7}
    >
      <Tooltip direction="top" offset={[0, -7]} opacity={0.97} permanent={false}>
        Matched address location · not saved
      </Tooltip>
    </CircleMarker>
  );
}
