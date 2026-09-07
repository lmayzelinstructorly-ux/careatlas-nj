import { useEffect } from "react";
import { useMap } from "react-leaflet";

type BoundaryLayerVisibilityControllerProps = {
  showingTowns: boolean;
  tractMode: boolean;
};

const countyPaneName = "county-boundaries";
const townPaneName = "town-boundaries";

export function BoundaryLayerVisibilityController({
  showingTowns,
  tractMode
}: BoundaryLayerVisibilityControllerProps) {
  const map = useMap();

  useEffect(() => {
    function applyVisibility() {
      const countyPane = map.getPane(countyPaneName);
      const townPane = map.getPane(townPaneName);

      if (countyPane) {
        countyPane.style.display = showingTowns || tractMode ? "none" : "block";
        countyPane.style.pointerEvents = showingTowns || tractMode ? "none" : "auto";
      }

      if (townPane) {
        townPane.style.display = showingTowns && !tractMode ? "block" : "none";
        townPane.style.pointerEvents = showingTowns && !tractMode ? "auto" : "none";
      }
    }

    applyVisibility();
    const visibilityFrame = window.requestAnimationFrame(applyVisibility);

    return () => window.cancelAnimationFrame(visibilityFrame);
  }, [map, showingTowns, tractMode]);

  return null;
}

export { countyPaneName, townPaneName };
