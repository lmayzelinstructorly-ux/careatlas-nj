import { useEffect, useRef } from "react";
import type { LatLng } from "leaflet";
import { useMap, useMapEvents } from "react-leaflet";
import { geographyLayerConfigs } from "../../geographyLayers";
import type { useGeographyData } from "../../hooks/useGeographyData";
import { getStateFipsFromFeature } from "../../utils/stateFips";
import { getBoundsOverlapArea, isPointInFeature } from "./geometry";

type ActiveStateWatcherProps = {
  activeStateFips: string | null;
  stateBoundaryData: NonNullable<ReturnType<typeof useGeographyData>["data"]> | null;
  onActiveStateFipsChange: (stateFips: string | null) => void;
};

function getActiveStateFipsFromMap(
  map: ReturnType<typeof useMap>,
  stateBoundaryData: NonNullable<ReturnType<typeof useGeographyData>["data"]>,
  cursorLatLng: LatLng | null
) {
  const center = map.getCenter();
  const centerState = stateBoundaryData.features.find((feature) =>
    isPointInFeature(center.lat, center.lng, feature)
  );

  if (centerState) {
    return getStateFipsFromFeature(centerState);
  }

  const visibleBounds = map.getBounds();
  const visibleState = stateBoundaryData.features
    .map((feature) => ({
      feature,
      overlapArea: getBoundsOverlapArea(visibleBounds, feature)
    }))
    .filter(({ overlapArea }) => overlapArea > 0)
    .sort((first, second) => second.overlapArea - first.overlapArea)[0]?.feature;

  if (visibleState) {
    return getStateFipsFromFeature(visibleState);
  }

  if (cursorLatLng && visibleBounds.contains(cursorLatLng)) {
    const cursorState = stateBoundaryData.features.find((feature) =>
      isPointInFeature(cursorLatLng.lat, cursorLatLng.lng, feature)
    );

    if (cursorState) {
      return getStateFipsFromFeature(cursorState);
    }
  }

  return null;
}

function isStateFipsVisibleInMap(
  stateFips: string | null,
  map: ReturnType<typeof useMap>,
  stateBoundaryData: NonNullable<ReturnType<typeof useGeographyData>["data"]>
) {
  if (!stateFips) {
    return false;
  }

  const visibleBounds = map.getBounds();

  return stateBoundaryData.features.some((feature) => {
    if (getStateFipsFromFeature(feature) !== stateFips) {
      return false;
    }

    return getBoundsOverlapArea(visibleBounds, feature) > 0;
  });
}

export function ActiveStateWatcher({
  activeStateFips,
  stateBoundaryData,
  onActiveStateFipsChange
}: ActiveStateWatcherProps) {
  const cursorLatLngRef = useRef<LatLng | null>(null);
  const activeStateFipsRef = useRef(activeStateFips);
  const pendingStateFipsRef = useRef<string | null>(null);
  const updateTimerRef = useRef<number | null>(null);
  const map = useMapEvents({
    mousemove: (event) => {
      cursorLatLngRef.current = event.latlng;
    },
    mouseout: () => {
      cursorLatLngRef.current = null;
    },
    moveend: () => scheduleActiveStateUpdate(),
    zoomend: () => scheduleActiveStateUpdate()
  });

  useEffect(() => {
    activeStateFipsRef.current = activeStateFips;
  }, [activeStateFips]);

  function scheduleActiveStateUpdate() {
    if (updateTimerRef.current !== null) {
      window.clearTimeout(updateTimerRef.current);
    }

    updateTimerRef.current = window.setTimeout(() => {
      updateTimerRef.current = null;
      updateActiveState();
    }, 160);
  }

  function updateActiveState() {
    if (!stateBoundaryData) {
      return;
    }

    if (map.getZoom() < geographyLayerConfigs.counties.minZoom) {
      pendingStateFipsRef.current = null;

      if (activeStateFipsRef.current !== null) {
        onActiveStateFipsChange(null);
      }

      return;
    }

    const detectedStateFips = getActiveStateFipsFromMap(
      map,
      stateBoundaryData,
      cursorLatLngRef.current
    );
    const currentStateFips = activeStateFipsRef.current;

    if (detectedStateFips === currentStateFips) {
      pendingStateFipsRef.current = null;
      return;
    }

    const currentStateStillVisible = isStateFipsVisibleInMap(
      currentStateFips,
      map,
      stateBoundaryData
    );

    if (currentStateStillVisible && pendingStateFipsRef.current !== detectedStateFips) {
      pendingStateFipsRef.current = detectedStateFips;
      return;
    }

    pendingStateFipsRef.current = null;

    if (detectedStateFips !== currentStateFips) {
      onActiveStateFipsChange(detectedStateFips);
    }
  }

  useEffect(() => {
    scheduleActiveStateUpdate();

    return () => {
      if (updateTimerRef.current !== null) {
        window.clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [map, stateBoundaryData]);

  return null;
}
