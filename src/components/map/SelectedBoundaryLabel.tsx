import { divIcon } from "leaflet";
import { Marker } from "react-leaflet";
import type { SelectedGeography } from "../../types";
import { escapeHtml } from "./boundaryNames";

type SelectedBoundaryLabelProps = {
  selectedGeography: SelectedGeography | null;
};

export function SelectedBoundaryLabel({ selectedGeography }: SelectedBoundaryLabelProps) {
  if (!selectedGeography) {
    return null;
  }

  return (
    <Marker
      icon={divIcon({
        className: "hb-boundary-label-icon",
        html: `<span class="hb-boundary-label hb-boundary-label--selected" title="${escapeHtml(
          selectedGeography.name
        )}">${escapeHtml(selectedGeography.name)}</span>`,
        iconSize: [0, 0]
      })}
      interactive={false}
      keyboard={false}
      pane="boundary-labels"
      position={[selectedGeography.latitude, selectedGeography.longitude]}
    />
  );
}
