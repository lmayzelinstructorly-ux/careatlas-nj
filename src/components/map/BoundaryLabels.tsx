import { useEffect, useMemo, useRef, useState } from "react";
import { divIcon } from "leaflet";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import type { GeographyLevel } from "../../geographyLayers";
import type { useGeographyData } from "../../hooks/useGeographyData";
import {
  escapeHtml,
  getBoundaryLabelText,
  getFeatureLabelKey
} from "./boundaryNames";
import {
  canDisplayAllBoundaryLabels,
  getBoundaryLabelOpacity,
  shouldShowBoundaryLabels
} from "./boundaryLabelUtils";
import type {
  BoundaryLabel,
  BoundaryLabelLayoutCandidate
} from "./boundaryLabelUtils";
import { getFeatureBounds, getFeatureLabelPoint } from "./geometry";

type BoundaryLabelsProps = {
  currentGeographyLevel: GeographyLevel;
  geographyData: NonNullable<ReturnType<typeof useGeographyData>["data"]>;
  selectedFeatureColorKey: string | null;
};

type BoundaryFeature = Feature<Geometry, GeoJsonProperties>;
type FeatureLabelPoint = ReturnType<typeof getFeatureLabelPoint>;

const featureLabelPointCache = new WeakMap<
  BoundaryFeature,
  FeatureLabelPoint
>();

function getCachedFeatureLabelPoint(feature: BoundaryFeature) {
  if (featureLabelPointCache.has(feature)) {
    return featureLabelPointCache.get(feature) ?? null;
  }

  const point = getFeatureLabelPoint(feature);
  featureLabelPointCache.set(feature, point);
  return point;
}

export function BoundaryLabels({
  currentGeographyLevel,
  geographyData,
  selectedFeatureColorKey
}: BoundaryLabelsProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [visibleBounds, setVisibleBounds] = useState(() => map.getBounds());
  const refreshFrameRef = useRef<number | null>(null);
  const shouldShowLabels = shouldShowBoundaryLabels(
    currentGeographyLevel,
    zoom
  );
  const labelOpacity = getBoundaryLabelOpacity(currentGeographyLevel, zoom);
  const labels = useMemo<BoundaryLabel[]>(() => {
    if (!shouldShowLabels || selectedFeatureColorKey) {
      return [];
    }

    const north = visibleBounds.getNorth();
    const east = visibleBounds.getEast();
    const south = visibleBounds.getSouth();
    const west = visibleBounds.getWest();
    const candidates = geographyData.features
      .flatMap((feature, index) => {
        const bounds = getFeatureBounds(feature);
        if (
          !bounds ||
          bounds.maxLatitude < south ||
          bounds.minLatitude > north ||
          bounds.maxLongitude < west ||
          bounds.minLongitude > east
        ) {
          return [];
        }

        const point = getCachedFeatureLabelPoint(feature);
        const labelText = getBoundaryLabelText(feature);
        if (
          !point ||
          !labelText ||
          !visibleBounds.contains([point.latitude, point.longitude])
        ) {
          return [];
        }

        return [{
          ...point,
          fullText: labelText.fullText,
          key: getFeatureLabelKey(feature, labelText.fullText, index),
          text: labelText.text
        }];
      })
      .sort((a, b) => b.area - a.area);

    const layoutCandidates: BoundaryLabelLayoutCandidate[] = candidates.map(
      (candidate) => {
        const pixelPoint = map.latLngToContainerPoint([
          candidate.latitude,
          candidate.longitude
        ]);

        return {
          ...candidate,
          pixelX: pixelPoint.x,
          pixelY: pixelPoint.y
        };
      }
    );
    const mapSize = map.getSize();

    return canDisplayAllBoundaryLabels(
      layoutCandidates,
      currentGeographyLevel,
      { height: mapSize.y, width: mapSize.x }
    )
      ? candidates
      : [];
  }, [
    currentGeographyLevel,
    geographyData,
    map,
    selectedFeatureColorKey,
    shouldShowLabels,
    visibleBounds
  ]);

  function clearLabelRefresh() {
    if (refreshFrameRef.current !== null) {
      window.cancelAnimationFrame(refreshFrameRef.current);
      refreshFrameRef.current = null;
    }
  }

  function scheduleLabelRefresh() {
    clearLabelRefresh();

    refreshFrameRef.current = window.requestAnimationFrame(() => {
      refreshFrameRef.current = null;
      setZoom(map.getZoom());
      setVisibleBounds(map.getBounds());
    });
  }

  useMapEvents({
    moveend: scheduleLabelRefresh,
    resize: scheduleLabelRefresh,
    zoomend: scheduleLabelRefresh
  });

  useEffect(() => {
    return () => {
      clearLabelRefresh();
    };
  }, []);

  if (!shouldShowLabels) {
    return null;
  }

  return (
    <>
      {labels.map((label) => (
        <Marker
          icon={divIcon({
            className: "hb-boundary-label-icon",
            html: `<span class="hb-boundary-label hb-boundary-label--${currentGeographyLevel}" title="${escapeHtml(
              label.fullText
            )}" style="opacity: ${labelOpacity}">${escapeHtml(
              label.text
            )}</span>`,
            iconSize: [0, 0]
          })}
          interactive={false}
          key={`${currentGeographyLevel}-${label.key}`}
          keyboard={false}
          pane="boundary-labels"
          position={[label.latitude, label.longitude]}
        />
      ))}
    </>
  );
}
