import type { PathOptions } from "leaflet";
import type { TractAccessGapState } from "../types/tractEvidence";

export type TractClassificationVisual = {
  state: TractAccessGapState;
  label: string;
  shortExplanation: string;
  patternClass: string;
};

export const tractBoundaryColor = "#3D7F88";

export const tractClassificationVisuals: TractClassificationVisual[] = [
  {
    state: "potential_access_gap",
    label: "Potential access gap",
    shortExplanation: "Elevated need or barriers with documented shortage evidence.",
    patternClass: "hb-tract-state-swatch--potential"
  },
  {
    state: "elevated_need_without_documented_shortage",
    label: "Elevated need without documented shortage",
    shortExplanation: "Elevated need or barriers without a matching reviewed shortage designation.",
    patternClass: "hb-tract-state-swatch--elevated"
  },
  {
    state: "no_current_gap_flag",
    label: "No current gap flag",
    shortExplanation: "The rule did not meet its elevated-need condition; this does not prove adequate access.",
    patternClass: "hb-tract-state-swatch--no-flag"
  },
  {
    state: "insufficient_evidence",
    label: "Insufficient evidence",
    shortExplanation: "At least one required value is missing.",
    patternClass: "hb-tract-state-swatch--insufficient"
  }
];

const visualByState = new Map(
  tractClassificationVisuals.map((visual) => [visual.state, visual])
);

export function getTractClassificationVisual(state: TractAccessGapState) {
  const visual = visualByState.get(state);
  if (!visual) {
    throw new Error(`Unknown tract screening state: ${state}`);
  }
  return visual;
}

export function getTractClassificationStyle(
  state: TractAccessGapState,
  selected: boolean,
  hovered = false
): PathOptions {
  const isPotentialGap = state === "potential_access_gap";
  return {
    color: selected
      ? "#071827"
      : hovered
        ? "#102A43"
        : isPotentialGap
          ? "#6F2E58"
          : tractBoundaryColor,
    fillColor: isPotentialGap ? "#A0467A" : "#F7FAFB",
    fillOpacity: isPotentialGap ? 0.84 : 0.98,
    opacity: 1,
    weight: selected ? 4.25 : hovered ? 2.4 : isPotentialGap ? 1.8 : 1.05
  };
}
