import { useTownFlaggedTracts } from "../../hooks/useTownFlaggedTracts";

type Props = {
  countyFips: string;
  onSelectTract: (geoid: string) => void;
  tractGeoids: string[];
  usesPrimaryAssignment: boolean;
};

export function TownFlaggedTractList({
  countyFips,
  onSelectTract,
  tractGeoids,
  usesPrimaryAssignment
}: Props) {
  const flaggedTracts = useTownFlaggedTracts(countyFips, tractGeoids);

  if (tractGeoids.length === 0) return null;

  return (
    <details className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-hb-navy">
        Flagged tract areas in this town
      </summary>
      <div className="mt-3">
        {!usesPrimaryAssignment && (
          <p className="mb-3 text-xs leading-5 text-amber-800">
            These census tracts overlap this town and may also appear in
            neighboring towns. No tract is assigned primarily to this town.
          </p>
        )}
        {flaggedTracts.loadState === "loading" && (
          <p className="text-xs text-hb-muted">Loading validated tract records...</p>
        )}
        {flaggedTracts.loadState === "error" && (
          <p className="text-xs leading-5 text-rose-700">
            {flaggedTracts.error ??
              "The validated flagged tract records could not be loaded."}
          </p>
        )}
        {flaggedTracts.loadState === "ready" && (
          <ul className="space-y-2">
            {flaggedTracts.records.map((tract) => (
              <li key={tract.geoid}>
                <button
                  className="w-full rounded-md border border-fuchsia-200 bg-fuchsia-50 px-3 py-2.5 text-left transition hover:border-fuchsia-300 hover:bg-fuchsia-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                  onClick={() => onSelectTract(tract.geoid)}
                  type="button"
                >
                  <span className="block text-sm font-bold text-hb-deepNavy">
                    {tract.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-hb-muted">
                    GEOID {tract.geoid}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-700">
                    {tract.reason}
                  </span>
                  <span className="mt-1.5 block text-xs font-bold text-hb-navy underline">
                    Open tract brief
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
