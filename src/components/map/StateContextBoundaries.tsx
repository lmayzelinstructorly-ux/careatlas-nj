import { useEffect, useMemo, useRef } from "react";
import type { GeoJSON as LeafletGeoJSON } from "leaflet";
import { canvas } from "leaflet";
import { GeoJSON } from "react-leaflet";
import type { useGeographyData } from "../../hooks/useGeographyData";
import {
  roadModeStateContextBoundaryStyle,
  stateContextBoundaryStyle
} from "./mapConstants";
import type { RoadMode } from "./mapTypes";

type StateContextBoundariesProps = {
  roadMode: RoadMode;
  stateBoundaryData: NonNullable<ReturnType<typeof useGeographyData>["data"]>;
};

export function StateContextBoundaries({
  roadMode,
  stateBoundaryData
}: StateContextBoundariesProps) {
  const contextRenderer = useMemo(() => canvas({ padding: 0.5 }), []);
  const contextLayerRef = useRef<LeafletGeoJSON | null>(null);
  const contextStyle = roadMode !== "off"
    ? roadModeStateContextBoundaryStyle
    : stateContextBoundaryStyle;

  useEffect(() => {
    contextLayerRef.current?.setStyle(contextStyle);
  }, [contextStyle]);

  return (
    <GeoJSON
      data={stateBoundaryData}
      interactive={false}
      key="state-context-boundaries"
      pane="state-context-boundaries"
      ref={contextLayerRef}
      style={{
        ...contextStyle,
        renderer: contextRenderer
      }}
    />
  );
}
