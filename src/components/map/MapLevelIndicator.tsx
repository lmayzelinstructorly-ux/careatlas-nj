import { useMemo } from "react";
import type { GeographyLevel } from "../../geographyLayers";

export type MapLevelIndicatorProps = {
  activeStateName: string | null;
  currentGeographyLevel: GeographyLevel;
};

export function MapLevelIndicator({
  activeStateName,
  currentGeographyLevel
}: MapLevelIndicatorProps) {
  const levelContent = useMemo(() => {
    if (currentGeographyLevel === "states") {
      return {
        className: "hb-map-level-indicator--states",
        helperText: "New Jersey map boundary",
        label: "New Jersey"
      };
    }

    if (currentGeographyLevel === "counties") {
      return {
        className: "hb-map-level-indicator--counties",
        helperText: activeStateName
          ? `Showing counties in ${activeStateName}. Zoom in for towns.`
          : "Showing New Jersey county boundaries. Zoom in for towns.",
        label: "County view"
      };
    }

    if (currentGeographyLevel === "tracts") {
      return {
        className: "hb-map-level-indicator--tracts",
        helperText: "Showing official 2024 Census tract boundaries for the selected New Jersey county",
        label: "NJ tract view"
      };
    }

    return {
      className: "hb-map-level-indicator--local",
      helperText: activeStateName
        ? `Showing towns and local jurisdictions in ${activeStateName}`
        : "Showing New Jersey towns and local jurisdictions",
      label: "Town view"
    };
  }, [activeStateName, currentGeographyLevel]);

  return (
    <div
      aria-live="polite"
      className={`hb-map-level-indicator ${levelContent.className}`}
    >
      <div className="hb-map-level-indicator__header">
        <span className="hb-map-level-indicator__dot" />
        <p className="hb-map-level-indicator__label">{levelContent.label}</p>
      </div>
      <p className="hb-map-level-indicator__helper">
        {levelContent.helperText}
      </p>
      {activeStateName && currentGeographyLevel !== "states" && (
        <p className="hb-map-level-indicator__state">{activeStateName}</p>
      )}
    </div>
  );
}
