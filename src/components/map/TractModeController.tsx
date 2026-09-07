import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { SelectedGeography } from "../../types";
import { getFeatureBounds } from "./geometry";
import { careAtlasMapResetEvent } from "./mapReset";

type Props = {
  activeArea: SelectedGeography | null;
  navigationOverrideActive?: boolean;
  tractMode: boolean;
};

export function TractModeController({
  activeArea,
  navigationOverrideActive = false,
  tractMode
}: Props) {
  const map = useMap();
  const previousAreaRef = useRef<SelectedGeography | null>(null);

  useEffect(() => {
    const reset = () => {
      previousAreaRef.current = null;
      map.stop();
    };
    window.addEventListener(careAtlasMapResetEvent, reset);
    return () => window.removeEventListener(careAtlasMapResetEvent, reset);
  }, [map]);

  useEffect(() => {
    const area = activeArea ?? previousAreaRef.current;
    const bounds = area?.feature ? getFeatureBounds(area.feature) : null;

    if (activeArea) {
      previousAreaRef.current = activeArea;
    }

    if (!bounds || navigationOverrideActive) return;

    map.fitBounds(
      [
        [bounds.minLatitude, bounds.minLongitude],
        [bounds.maxLatitude, bounds.maxLongitude]
      ],
      {
        animate: true,
        maxZoom:
          area?.level === "towns"
            ? tractMode
              ? 11.5
              : 10.5
            : tractMode
              ? 10
              : 8.75,
        padding: [32, 32]
      }
    );
  }, [activeArea, map, navigationOverrideActive, tractMode]);

  return null;
}
