import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { GeoJSON } from "react-leaflet";

export function TownTractOutlineLayer({
  feature
}: {
  feature: Feature<Geometry, GeoJsonProperties>;
}) {
  return (
    <GeoJSON
      data={feature}
      interactive={false}
      pane="town-tract-outline"
      style={{
        color: "#3F4B52",
        fillOpacity: 0,
        lineCap: "round",
        lineJoin: "round",
        opacity: 0.92,
        weight: 2.1
      }}
    />
  );
}
