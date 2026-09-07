import { useEffect, useRef } from "react";
import { useMapEvents } from "react-leaflet";
import { getGeographyLevelForZoom } from "../../geographyLayers";
import type { GeographyLevel } from "../../geographyLayers";

type ZoomLevelWatcherProps = {
  currentGeographyLevel: GeographyLevel;
  onGeographyLevelChange: (level: GeographyLevel) => void;
  suppressGeographyLevelUpdates: boolean;
};

export function ZoomLevelWatcher({
  currentGeographyLevel,
  onGeographyLevelChange,
  suppressGeographyLevelUpdates
}: ZoomLevelWatcherProps) {
  const currentGeographyLevelRef = useRef(currentGeographyLevel);
  const suppressGeographyLevelUpdatesRef = useRef(
    suppressGeographyLevelUpdates
  );
  const updateFrameRef = useRef<number | null>(null);
  const map = useMapEvents({
    moveend: () => scheduleGeographyLevelUpdate(),
    zoomend: () => scheduleGeographyLevelUpdate()
  });

  useEffect(() => {
    if (updateFrameRef.current !== null) {
      window.cancelAnimationFrame(updateFrameRef.current);
      updateFrameRef.current = null;
    }

    currentGeographyLevelRef.current = currentGeographyLevel;
  }, [currentGeographyLevel]);

  useEffect(() => {
    suppressGeographyLevelUpdatesRef.current = suppressGeographyLevelUpdates;

    if (suppressGeographyLevelUpdates) {
      if (updateFrameRef.current !== null) {
        window.cancelAnimationFrame(updateFrameRef.current);
        updateFrameRef.current = null;
      }
      return;
    }

    scheduleGeographyLevelUpdate();
  }, [suppressGeographyLevelUpdates]);

  function updateGeographyLevel() {
    if (suppressGeographyLevelUpdatesRef.current) {
      return;
    }

    const zoom = map.getZoom();
    const nextGeographyLevel =
      currentGeographyLevelRef.current === "tracts"
        ? "tracts"
        : getGeographyLevelForZoom(zoom);

    if (nextGeographyLevel !== currentGeographyLevelRef.current) {
      onGeographyLevelChange(nextGeographyLevel);
    }
  }

  function scheduleGeographyLevelUpdate() {
    if (updateFrameRef.current !== null) {
      window.cancelAnimationFrame(updateFrameRef.current);
    }

    updateFrameRef.current = window.requestAnimationFrame(() => {
      updateFrameRef.current = null;
      updateGeographyLevel();
    });
  }

  useEffect(() => {
    scheduleGeographyLevelUpdate();

    return () => {
      if (updateFrameRef.current !== null) {
        window.cancelAnimationFrame(updateFrameRef.current);
        updateFrameRef.current = null;
      }
    };
  }, [map]);

  return null;
}
