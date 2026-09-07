import { useEffect } from "react";
import { latLngBounds, point } from "leaflet";
import { useMap } from "react-leaflet";
import { geographyLayerConfigs } from "../../geographyLayers";
import type { BoundaryAutocompleteCandidate } from "./BoundaryAutocomplete";
import { getFeatureBounds } from "./geometry";

export type BoundaryAutocompleteRequest = {
  candidate: BoundaryAutocompleteCandidate;
  requestId: number;
};

export function BoundaryAutocompleteController({
  onNavigationComplete,
  request
}: {
  onNavigationComplete: () => void;
  request: BoundaryAutocompleteRequest | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!request) {
      return;
    }

    const featureBounds = getFeatureBounds(request.candidate.feature);

    if (!featureBounds) {
      onNavigationComplete();
      return;
    }

    const bounds = latLngBounds(
      [featureBounds.minLatitude, featureBounds.minLongitude],
      [featureBounds.maxLatitude, featureBounds.maxLongitude]
    );
    const padding = point(36, 36);
    let settleTimer: number | null = null;
    const navigationFrame = window.requestAnimationFrame(() => {
      const maximumTargetZoom = request.candidate.level === "towns"
        ? 11.5
        : geographyLayerConfigs.counties.maxZoom - 0.25;
      const targetZoom = Math.min(
        map.getBoundsZoom(bounds, false, padding),
        maximumTargetZoom,
        map.getMaxZoom()
      );

      map.stop();
      map.invalidateSize({ pan: false });
      map.fitBounds(bounds, {
        animate: true,
        duration: 0.7,
        easeLinearity: 0.3,
        maxZoom: maximumTargetZoom,
        padding
      });

      settleTimer = window.setTimeout(() => {
        const centerDistance = map.getCenter().distanceTo(bounds.getCenter());
        const zoomDifference = Math.abs(map.getZoom() - targetZoom);

        if (centerDistance > 2500 || zoomDifference > 0.51) {
          map.stop();
          map.fitBounds(bounds, {
            animate: false,
            maxZoom: maximumTargetZoom,
            padding
          });
        }

        onNavigationComplete();
      }, 900);
    });

    return () => {
      window.cancelAnimationFrame(navigationFrame);

      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
    };
  }, [map, onNavigationComplete, request]);

  return null;
}
