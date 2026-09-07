import { canvas } from "leaflet";
import { Fragment, useMemo } from "react";
import { GeoJSON } from "react-leaflet";
import type { GeographyData } from "../../hooks/useGeographyData";
import { tractBoundaryColor } from "../../utils/tractClassification";

type Props = {
  countyGeography: GeographyData;
  tractGeography: GeographyData | null;
  townGeography: GeographyData | null;
};

export function TractContextBoundaryLayer({
  countyGeography,
  tractGeography,
  townGeography
}: Props) {
  const renderer = useMemo(
    () => canvas({ padding: 0.5, pane: "tract-context-boundaries" }),
    []
  );

  return (
    <Fragment>
      <GeoJSON
        data={countyGeography}
        interactive={false}
        pane="tract-context-boundaries"
        style={{
          color: "#8B989F",
          fillColor: "#E1E7EA",
          fillOpacity: 1,
          opacity: 0.72,
          renderer,
          weight: 1
        }}
      />
      {tractGeography && (
        <GeoJSON
          data={tractGeography}
          interactive={false}
          pane="tract-context-boundaries"
          style={{
            color: tractBoundaryColor,
            fillColor: "#F7FAFB",
            fillOpacity: 1,
            opacity: 0.95,
            renderer,
            weight: 1.05
          }}
        />
      )}
      {townGeography && (
        <GeoJSON
          data={townGeography}
          interactive={false}
          pane="tract-context-boundaries"
          style={{
            color: "#53636D",
            fillOpacity: 0,
            opacity: 0.9,
            renderer,
            weight: 1.25
          }}
        />
      )}
      <GeoJSON
        data={countyGeography}
        interactive={false}
        pane="tract-context-boundaries"
        style={{
          color: "#5F6E77",
          fillOpacity: 0,
          opacity: 0.88,
          renderer,
          weight: 1.5
        }}
      />
    </Fragment>
  );
}
