import { useEffect } from "react";
import { useMap } from "react-leaflet";

// Switching modes and changing viewport size can resize the map's grid cell.
export function MapSizeObserver() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
