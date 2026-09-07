import { useEffect, useMemo, useState } from "react";
import type { GeographyData } from "../../hooks/useGeographyData";
import {
  useGapExplorer,
  type GapExplorerCounty,
  type GapExplorerTown
} from "../../hooks/useGapExplorer";
import { getGeographyFeatureColorKey } from "../../utils/geographyColors";
import type { BoundaryAutocompleteCandidate } from "./BoundaryAutocomplete";
import {
  getBoundaryLegalName,
  getBoundaryLegalType,
  getFeaturePropertyText
} from "./boundaryNames";
import { careAtlasMapResetEvent } from "./mapReset";

type Props = {
  countyData: GeographyData | null;
  onSelect: (candidate: BoundaryAutocompleteCandidate) => void;
  townData: GeographyData | null;
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pluralizeTracts(count: number) {
  return `${count} flagged tract${count === 1 ? "" : "s"}`;
}

export function GapExplorer({ countyData, onSelect, townData }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(
    null
  );
  const {
    counties,
    summaryError,
    summaryLoadState,
    townError,
    townLoadState,
    towns
  } = useGapExplorer(selectedCountyFips);
  const selectedCounty = counties.find(
    (county) => county.countyFips === selectedCountyFips
  ) ?? null;
  const normalizedQuery = normalize(query);
  const visibleCounties = useMemo(
    () =>
      counties.filter((county) =>
        normalize(county.countyName).includes(normalizedQuery)
      ),
    [counties, normalizedQuery]
  );
  const visibleTowns = useMemo(
    () => towns.filter((town) => normalize(town.name).includes(normalizedQuery)),
    [normalizedQuery, towns]
  );

  useEffect(() => {
    const reset = () => {
      setIsOpen(false);
      setQuery("");
      setSelectedCountyFips(null);
    };
    window.addEventListener(careAtlasMapResetEvent, reset);
    return () => window.removeEventListener(careAtlasMapResetEvent, reset);
  }, []);

  function getCountyCandidate(county: GapExplorerCounty) {
    const feature = countyData?.features.find(
      (candidate) =>
        getFeaturePropertyText(candidate, ["COUNTYFP", "COUNTYFP20"]) ===
        county.countyFips
    );
    if (!feature) return null;
    const displayName = getBoundaryLegalName(feature, county.countyName);

    return {
      displayName,
      feature,
      key: getGeographyFeatureColorKey(feature, "counties"),
      level: "counties" as const,
      normalizedName: normalize(displayName),
      typeLabel: "County"
    };
  }

  function getTownCandidate(town: GapExplorerTown) {
    const feature = townData?.features.find(
      (candidate) =>
        getFeaturePropertyText(candidate, ["GEOID", "GEOID20", "GEOID10"]) ===
        town.geoid
    );
    if (!feature) return null;
    const displayName = getBoundaryLegalName(feature, town.name);

    return {
      displayName,
      feature,
      key: getGeographyFeatureColorKey(feature, "towns"),
      level: "towns" as const,
      normalizedName: normalize(displayName),
      typeLabel: getBoundaryLegalType(feature) ?? "Municipality"
    };
  }

  function openCountySummary() {
    if (!selectedCounty) return;
    const candidate = getCountyCandidate(selectedCounty);
    if (!candidate) return;
    setIsOpen(false);
    onSelect(candidate);
  }

  function openTown(town: GapExplorerTown) {
    const candidate = getTownCandidate(town);
    if (!candidate) return;
    setIsOpen(false);
    onSelect(candidate);
  }

  if (!isOpen) {
    return (
      <button
        aria-expanded="false"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-hb-teal/25 bg-white px-3 py-2 text-sm font-bold text-hb-navy hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-hb-aqua"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4 text-hb-teal" fill="none" viewBox="0 0 20 20">
          <path d="M3 16.5 7.5 12l3 2.5L17 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <circle cx="17" cy="7" r="2" fill="currentColor" />
        </svg>
        Explore potential gaps
      </button>
    );
  }

  const showingTowns = Boolean(selectedCounty);
  const visibleItems = showingTowns ? visibleTowns : visibleCounties;

  return (
    <section
      aria-label="Explore potential gaps"
      className="relative rounded-lg border border-slate-300 bg-white"
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
    >
      <div className="border-b border-slate-200 p-4 pr-12">
        <p className="text-[11px] font-black uppercase tracking-[0.13em] text-hb-teal">
          CareAtlas NJ gap explorer
        </p>
        <h2 className="mt-1 text-lg font-semibold text-hb-deepNavy">
          {selectedCounty?.countyName ?? "Explore potential gaps"}
        </h2>
        <p className="mt-1 text-xs leading-5 text-hb-muted">
          {selectedCounty
            ? `${pluralizeTracts(selectedCounty.potentialGapTractCount)} in this county. Choose a town to read its summary.`
            : "Choose a county to find towns containing tract areas flagged by the published screening rule."}
        </p>
        <button
          aria-label="Close gap explorer"
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-hb-teal/20 bg-white text-lg font-semibold text-hb-navy shadow-sm hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-hb-aqua/60"
          onClick={() => setIsOpen(false)}
          type="button"
        >
          ×
        </button>
      </div>

      <div className="p-3">
        {showingTowns && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              className="text-xs font-semibold text-hb-navy underline"
              onClick={() => {
                setSelectedCountyFips(null);
                setQuery("");
              }}
              type="button"
            >
              Back to all counties
            </button>
            <button
              className="rounded border border-hb-teal/35 px-2.5 py-1.5 text-xs font-bold text-hb-navy hover:bg-cyan-50"
              onClick={openCountySummary}
              type="button"
            >
              Open county summary
            </button>
          </div>
        )}

        <label className="sr-only" htmlFor="gap-explorer-search">
          Search {showingTowns ? "flagged towns" : "counties with flagged tracts"}
        </label>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-hb-deepNavy outline-none placeholder:text-hb-muted focus:border-hb-aqua focus:ring-2 focus:ring-cyan-100"
          id="gap-explorer-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={showingTowns ? "Search towns..." : "Search counties..."}
          type="search"
          value={query}
        />
      </div>

      <div className="max-h-[22rem] overflow-y-auto border-t border-slate-200">
        {!showingTowns && summaryLoadState === "loading" && (
          <p className="p-4 text-sm text-hb-muted">Loading county gap counts...</p>
        )}
        {!showingTowns && summaryLoadState === "error" && (
          <p role="alert" className="p-4 text-sm text-rose-700">
            {summaryError ?? "County gap counts could not be loaded."}
          </p>
        )}
        {showingTowns && townLoadState === "loading" && (
          <p className="p-4 text-sm text-hb-muted">Loading flagged towns...</p>
        )}
        {showingTowns && townLoadState === "error" && (
          <p role="alert" className="p-4 text-sm text-rose-700">
            {townError ?? "Town gap counts could not be loaded."}
          </p>
        )}
        {visibleItems.length > 0 && (
          <ul className="divide-y divide-slate-200">
            {showingTowns
              ? visibleTowns.map((town) => (
                  <li key={town.geoid}>
                    <button
                      className="w-full px-4 py-3 text-left transition hover:bg-cyan-50 focus:bg-cyan-50 focus:outline-none"
                      onClick={() => openTown(town)}
                      type="button"
                    >
                      <span className="block text-sm font-bold text-hb-deepNavy">
                        {getTownCandidate(town)?.displayName ?? town.name}
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-hb-muted">
                        {pluralizeTracts(town.potentialGapTractCount)} · {town.contextKind === "primary-assigned" ? "assigned to this town" : "overlap this town"}
                      </span>
                    </button>
                  </li>
                ))
              : visibleCounties.map((county) => (
                  <li key={county.countyFips}>
                    <button
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-cyan-50 focus:bg-cyan-50 focus:outline-none"
                      onClick={() => {
                        setSelectedCountyFips(county.countyFips);
                        setQuery("");
                      }}
                      type="button"
                    >
                      <span className="text-sm font-bold text-hb-deepNavy">
                        {county.countyName}
                      </span>
                      <span className="shrink-0 rounded-full bg-fuchsia-50 px-2 py-1 text-[11px] font-bold text-fuchsia-800">
                        {county.potentialGapTractCount}
                      </span>
                    </button>
                  </li>
                ))}
          </ul>
        )}
        {((!showingTowns && summaryLoadState === "ready") ||
          (showingTowns && townLoadState === "ready")) &&
          visibleItems.length === 0 && (
            <p className="p-4 text-sm text-hb-muted">
              No {showingTowns ? "flagged town" : "county"} matches this search.
            </p>
          )}
      </div>

      <p className="border-t border-slate-200 px-4 py-3 text-[11px] leading-4 text-hb-muted">
        {showingTowns
          ? "Town counts can overlap when one tract intersects more than one municipality. Select a town for its data-quality explanation."
          : "Counties are listed alphabetically. Counts are tract screening results, not scores or rankings."}
      </p>
    </section>
  );
}
