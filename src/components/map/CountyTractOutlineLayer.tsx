import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { GeoJSON } from "react-leaflet";
import { careAtlasColors } from "../../theme/colors";

export function CountyTractOutlineLayer({
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
        color: careAtlasColors.deepNavy,
        fillOpacity: 0,
        lineCap: "round",
        lineJoin: "round",
        opacity: 1,
        weight: 3.2
      }}
    />
  );
}
