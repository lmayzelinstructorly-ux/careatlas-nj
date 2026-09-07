import { useEffect } from "react";
import type { LatLng } from "leaflet";
import { useMap } from "react-leaflet";
import {
  customWheelZoomInStep,
  customWheelZoomOutStep
} from "./mapConstants";

export function CustomWheelZoom() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let animationFrameId: number | null = null;
    let pendingZoomDelta = 0;
    let pendingCursorLatLng: LatLng | null = null;

    map.scrollWheelZoom.disable();

    function flushWheelZoom() {
      animationFrameId = null;

      if (!pendingCursorLatLng || pendingZoomDelta === 0) {
        pendingZoomDelta = 0;
        return;
      }

      const targetZoom = Math.max(
        map.getMinZoom(),
        Math.min(map.getMaxZoom(), map.getZoom() + pendingZoomDelta)
      );

      pendingZoomDelta = 0;

      if (targetZoom !== map.getZoom()) {
        map.setZoomAround(pendingCursorLatLng, targetZoom);
      }
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();

      const zoomStep =
        event.deltaY < 0 ? customWheelZoomInStep : customWheelZoomOutStep;
      const direction = event.deltaY < 0 ? 1 : -1;
      const deltaMagnitude = Math.min(1, Math.abs(event.deltaY) / 80);

      pendingCursorLatLng = map.mouseEventToLatLng(event);
      pendingZoomDelta = Math.max(
        -customWheelZoomOutStep * 2,
        Math.min(
          customWheelZoomInStep * 2,
          pendingZoomDelta + direction * zoomStep * deltaMagnitude
        )
      );

      if (animationFrameId === null) {
        animationFrameId = window.requestAnimationFrame(flushWheelZoom);
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [map]);

  return null;
}
