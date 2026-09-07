import { useEffect, useRef } from "react";
import type { LatLngBoundsExpression } from "leaflet";
import { Control, DomEvent } from "leaflet";
import { useMap } from "react-leaflet";
import { geographyLayerConfigs } from "../../geographyLayers";
import { requestCareAtlasMapReset } from "./mapReset";
const newJerseyLegalBounds: LatLngBoundsExpression = [
  [38.9, -75.6],
  [41.4, -73.9]
];

type Props = {
  enabled?: boolean;
  onReset: () => void;
};

export function InitialMapFitter({ enabled = true, onReset }: Props) {
  const map = useMap();
  const didFitInitialViewRef = useRef(false);

  useEffect(() => {
    if (!enabled || didFitInitialViewRef.current) {
      return;
    }

    const fitTimer = window.setTimeout(() => {
      fitNewJerseyBounds(map, newJerseyLegalBounds);
      didFitInitialViewRef.current = true;
    }, 0);

    return () => window.clearTimeout(fitTimer);
  }, [enabled, map]);

  useEffect(() => {
    const resetControl = new Control({ position: "bottomright" });

    resetControl.onAdd = () => {
      const container = document.createElement("div");
      const button = document.createElement("button");
      const icon = document.createElement("span");
      const label = document.createElement("span");

      container.className = "leaflet-bar hb-reset-view-control";
      button.type = "button";
      button.className = "hb-reset-view-control__button";
      icon.className = "hb-reset-view-control__icon";
      icon.textContent = "↺";
      icon.setAttribute("aria-hidden", "true");
      label.textContent = "Reset map";
      button.title = "Reset map to New Jersey";
      button.setAttribute("aria-label", "Reset map view to New Jersey");
      button.addEventListener("click", () => {
        map.stop();
        onReset();
        requestCareAtlasMapReset();
        window.requestAnimationFrame(() => {
          fitNewJerseyBounds(map, newJerseyLegalBounds);
        });
      });
      button.append(icon, label);
      container.append(button);
      DomEvent.disableClickPropagation(container);
      DomEvent.disableScrollPropagation(container);

      return container;
    };

    resetControl.addTo(map);

    return () => {
      resetControl.remove();
    };
  }, [map, onReset]);

  return null;
}

function fitNewJerseyBounds(
  map: ReturnType<typeof useMap>,
  bounds: LatLngBoundsExpression
) {
  map.invalidateSize();
  map.fitBounds(bounds, {
    animate: false,
    maxZoom: geographyLayerConfigs.counties.maxZoom - 0.25,
    padding: [10, 10]
  });
  map.setZoom(
    Math.min(
      geographyLayerConfigs.counties.maxZoom - 0.25,
      map.getZoom() + 0.5
    ),
    { animate: false }
  );
}
