import { healthcareAccessChoroplethCategories } from "../../utils/boundaryHealthcareSummary";
export type MapLayerControlPanelProps = {
  activeTractCountyFips: string | null;
  healthcareAccessChoroplethDisabled: boolean;
  healthcareAccessChoroplethEnabled: boolean;
  healthcareAccessChoroplethMessage: string;
  healthcareFacilitiesWithCoordinates: number;
  onHealthcareAccessChoroplethChange: (enabled: boolean) => void;
  onTractClassificationEnabledChange: (enabled: boolean) => void;
  showHealthcareMarkers: boolean;
  tractClassificationEnabled: boolean;
  tractClassificationError: string | null;
  tractClassificationLoadState: "idle" | "loading" | "ready" | "error";
};

export function MapLayerControlPanel({
  activeTractCountyFips,
  healthcareAccessChoroplethDisabled,
  healthcareAccessChoroplethEnabled,
  healthcareAccessChoroplethMessage,
  healthcareFacilitiesWithCoordinates,
  onHealthcareAccessChoroplethChange,
  onTractClassificationEnabledChange,
  showHealthcareMarkers,
  tractClassificationEnabled,
  tractClassificationError,
  tractClassificationLoadState
}: MapLayerControlPanelProps) {
  return (
    <div className="absolute bottom-3 right-3 z-[1000] max-h-[min(34rem,calc(100%-2rem))] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto rounded border border-slate-300 bg-white/95 px-3 py-2.5 sm:bottom-4 sm:right-4">
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-hb-deepNavy">
          Advanced map options
        </summary>
        {showHealthcareMarkers && healthcareFacilitiesWithCoordinates > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-hb-border pt-3 text-[11px] font-bold text-hb-muted">
            <span className="hb-healthcare-legend-dot hb-healthcare-marker--medium" aria-hidden="true" />
            <span>Source-backed facility record</span>
          </div>
        )}
        <div className="mt-3 border-t border-hb-border pt-3">
          <p className="text-xs font-black text-hb-deepNavy">
            Tract screening view
          </p>
          <label className="mt-2 flex items-start gap-2">
            <input
              aria-describedby="tract-screening-layer-help"
              checked={tractClassificationEnabled}
              className="mt-0.5 h-4 w-4 rounded border-hb-aqua text-hb-teal focus:ring-hb-aqua"
              disabled={!activeTractCountyFips}
              onChange={(event) =>
                onTractClassificationEnabledChange(event.target.checked)
              }
              type="checkbox"
            />
            <span className="text-[11px] font-semibold leading-4 text-hb-muted">
              Show the four rule version 1.0.0 tract screening states.
            </span>
          </label>
          <p id="tract-screening-layer-help" className="mt-2 text-[11px] font-semibold leading-4 text-hb-muted">
            {!activeTractCountyFips
              ? "Select or search a New Jersey county or tract first. Startup does not load statewide tract geometry."
              : tractClassificationLoadState === "loading"
                ? `Loading county shard ${activeTractCountyFips}...`
                : tractClassificationLoadState === "error"
                  ? `This county shard could not be loaded. ${tractClassificationError ?? "Try again."}`
                  : tractClassificationEnabled
                    ? "Select a colored tract to open its evidence record. Hide this layer when you want to select town boundaries beneath it."
                    : `County shard ${activeTractCountyFips} is ready when requested.`}
          </p>
        </div>
        <div className="mt-3 border-t border-hb-border pt-3">
          <p className="text-xs font-black text-hb-deepNavy">
            Center count view
          </p>
          <label className="mt-2 flex items-start gap-2">
            <input
              checked={healthcareAccessChoroplethEnabled}
              className="mt-0.5 h-4 w-4 rounded border-hb-aqua text-hb-teal focus:ring-hb-aqua"
              disabled={healthcareAccessChoroplethDisabled}
              onChange={(event) =>
                onHealthcareAccessChoroplethChange(event.target.checked)
              }
              type="checkbox"
            />
            <span className="text-[11px] font-semibold leading-4 text-hb-muted">
              {healthcareAccessChoroplethMessage}
            </span>
          </label>
          {healthcareAccessChoroplethEnabled && (
            <div className="mt-2 grid gap-1.5">
              {healthcareAccessChoroplethCategories.map((category) => (
                <div
                  className="flex items-center gap-2 text-[11px] font-bold text-hb-muted"
                  key={category.id}
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-sm border border-hb-border"
                    style={{
                      backgroundColor: category.color,
                      borderColor: category.lineColor
                    }}
                  />
                  <span>{category.label}</span>
                </div>
              ))}
              <p className="text-[11px] font-semibold leading-4 text-hb-muted">
                Colors show counts of mapped healthcare centers, not complete
                access, medical quality or better/worse boundaries.
              </p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
