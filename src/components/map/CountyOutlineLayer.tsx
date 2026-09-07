import { canvas } from "leaflet";
import { useMemo } from "react";
import { GeoJSON } from "react-leaflet";
import type { GeographyData } from "../../hooks/useGeographyData";
import { townBoundaryFill } from "../../utils/geographyColors";

export function CountyOutlineLayer({
  geography,
  townCoverageGeography = null
}: {
  geography: GeographyData;
  townCoverageGeography?: GeographyData | null;
}) {
  const renderer = useMemo(
    () => canvas({ padding: 0.5, pane: "boundary-outlines" }),
    []
  );

  return (
    <>
      {townCoverageGeography && (
        <GeoJSON
          data={townCoverageGeography}
          interactive={false}
          pane="boundary-outlines"
          style={{
            color: townBoundaryFill,
            fillColor: townBoundaryFill,
            fillOpacity: 1,
            lineCap: "round",
            lineJoin: "round",
            opacity: 1,
            renderer,
            weight: 4
          }}
        />
      )}
      <GeoJSON
        data={geography}
        interactive={false}
        pane="boundary-outlines"
        style={{
          color: "#143B53",
          fillOpacity: 0,
          opacity: 0.94,
          renderer,
          weight: 2.4
        }}
      />
    </>
  );
}
