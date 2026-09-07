import { useMemo, useState } from "react";
import type { HealthcareFacilitiesLoadState } from "../hooks/useHealthcareFacilities";
import type { HealthcareCoverageSummary } from "../types/healthcareCoverage";
import type { HealthcareFacility, HealthcareFacilityFilters } from "../types/healthcare";
import { auditSingleHealthcareFacility } from "../utils/healthcareDataQuality";
import {
  defaultHealthcareFacilityFilters,
  getFilteredHealthcareFacilities,
  healthcareFacilityFilterGroups
} from "../utils/healthcareFacilityFilters";
import HealthcareFacilityReportCard from "./HealthcareFacilityReportCard";

type HealthcareFacilityExplorerProps = {
  coverageSummary: HealthcareCoverageSummary | null;
  facilities: HealthcareFacility[];
  facilityFilters: HealthcareFacilityFilters;
  isDemoMode: boolean;
  loadError?: string;
  loadState: HealthcareFacilitiesLoadState;
  onFacilityFiltersChange: (filters: HealthcareFacilityFilters) => void;
  onFacilitySelect: (facilityId: string) => void;
  onFacilityZoom: (facilityId: string) => void;
  onRetry?: () => void;
  selectedFacilityId: string | null;
};

function HealthcareFacilityExplorer({
  coverageSummary,
  facilities,
  facilityFilters,
  isDemoMode,
  loadError,
  loadState,
  onFacilityFiltersChange,
  onFacilitySelect,
  onFacilityZoom,
  onRetry,
  selectedFacilityId
}: HealthcareFacilityExplorerProps) {
  const [searchText, setSearchText] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [countyFilter, setCountyFilter] = useState("all");
  const [sortMode, setSortMode] = useState<"name" | "type" | "source_date">("name");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => getFilteredHealthcareFacilities(facilities, facilityFilters), [facilities, facilityFilters]);
  const stateOptions = useMemo(() => [...new Set(facilities.map((item) => item.state).filter(Boolean))].sort(), [facilities]);
  const countyOptions = useMemo(() => [...new Set(facilities.filter((item) => stateFilter === "all" || item.state === stateFilter).map((item) => item.county).filter((item): item is string => Boolean(item)))].sort(), [facilities, stateFilter]);
  const results = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return filtered
      .filter(({ facility }) =>
        (stateFilter === "all" || facility.state === stateFilter) &&
        (countyFilter === "all" || facility.county === countyFilter) &&
        (!query || [facility.name, facility.city, facility.county, facility.state, facility.address, facility.facilityType].filter(Boolean).join(" ").toLowerCase().includes(query)))
      .sort((a, b) => {
        if (sortMode === "type") return a.facility.facilityType.localeCompare(b.facility.facilityType) || a.facility.name.localeCompare(b.facility.name);
        if (sortMode === "source_date") return (b.facility.sourceLastUpdated ?? b.facility.lastVerified ?? "").localeCompare(a.facility.sourceLastUpdated ?? a.facility.lastVerified ?? "") || a.facility.name.localeCompare(b.facility.name);
        return a.facility.name.localeCompare(b.facility.name);
      });
  }, [countyFilter, filtered, searchText, sortMode, stateFilter]);

  const resetFilters = () => {
    setSearchText("");
    setStateFilter("all");
    setCountyFilter("all");
    onFacilityFiltersChange(defaultHealthcareFacilityFilters);
  };

  return (
    <section aria-labelledby="healthcare-facility-explorer-heading" className="bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-hb-teal">Facility records</p>
          <h2 className="mt-1 text-lg font-semibold text-hb-deepNavy" id="healthcare-facility-explorer-heading">Browse documented facilities</h2>
        </div>
        <span className="text-xs font-semibold text-hb-muted">{loadState === "ready" ? `${facilities.length} loaded` : loadState === "error" ? "Unavailable" : "Loading"}</span>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-hb-muted">
        Search and filter source-backed records. Their presence does not measure medical quality and missing records do not prove that an area has no healthcare.
      </p>

      {isDemoMode && <p className="mt-3 rounded border border-hb-aqua/30 bg-hb-background p-3 text-sm font-semibold text-hb-muted">Demo mode is active. These sample records are not real facilities.</p>}
      {(loadState === "idle" || loadState === "loading") && <p className="mt-3 rounded border border-hb-border bg-hb-background p-3 text-sm font-semibold text-hb-muted">{loadState === "loading" ? "Loading facility records..." : "Facility records have not been requested yet."}</p>}
      {loadState === "error" && (
        <div className="mt-3 rounded border border-hb-border bg-hb-background p-3">
          <p className="font-semibold text-hb-deepNavy">Facility records are temporarily unavailable.</p>
          {import.meta.env.DEV && loadError && <p className="mt-2 text-xs text-hb-muted">{loadError}</p>}
          <div className="mt-3 flex gap-2">
            {onRetry && <button className="rounded border border-hb-border bg-white px-3 py-2 text-xs font-semibold" onClick={onRetry} type="button">Try again</button>}
          </div>
        </div>
      )}

      {loadState === "ready" && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-hb-muted">Search<input className="mt-1 w-full rounded border border-hb-border px-2 py-2" onChange={(event) => setSearchText(event.target.value)} placeholder="Name, city or address" value={searchText} /></label>
            <label className="text-xs font-semibold text-hb-muted">State<select className="mt-1 w-full rounded border border-hb-border px-2 py-2" onChange={(event) => { setStateFilter(event.target.value); setCountyFilter("all"); }} value={stateFilter}><option value="all">All states</option>{stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
            <label className="text-xs font-semibold text-hb-muted">County<select className="mt-1 w-full rounded border border-hb-border px-2 py-2" onChange={(event) => setCountyFilter(event.target.value)} value={countyFilter}><option value="all">All counties</option>{countyOptions.map((county) => <option key={county} value={county}>{county}</option>)}</select></label>
            <label className="text-xs font-semibold text-hb-muted">Order<select className="mt-1 w-full rounded border border-hb-border px-2 py-2" onChange={(event) => setSortMode(event.target.value as typeof sortMode)} value={sortMode}><option value="name">Name</option><option value="type">Facility type</option><option value="source_date">Newest source date</option></select></label>
          </div>

          <details className="mt-3 rounded border border-hb-border p-3">
            <summary className="cursor-pointer text-sm font-semibold text-hb-deepNavy">Additional record filters</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {healthcareFacilityFilterGroups.map((group) => (
                <label className="text-xs font-semibold text-hb-muted" key={group.key}>{group.label}
                  <select className="mt-1 w-full rounded border border-hb-border px-2 py-2" onChange={(event) => onFacilityFiltersChange({ ...facilityFilters, [group.key]: event.target.value })} value={facilityFilters[group.key]}>
                    {group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </details>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-hb-muted">
            <span>{results.length} matching records across {coverageSummary?.loadedStates.length ?? stateOptions.length} loaded states</span>
            <button className="rounded border border-hb-border px-3 py-2" onClick={resetFilters} type="button">Clear filters</button>
          </div>

          {results.length === 0 ? (
            <p className="mt-4 rounded border border-hb-border bg-hb-background p-3 text-sm text-hb-muted">No loaded records match these filters. This does not mean the area has no healthcare.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {results.slice(0, 100).map(({ facility, qualityAudit }) => {
                const expanded = expandedIds.has(facility.id) || selectedFacilityId === facility.id;
                return (
                  <div className="rounded border border-hb-border p-3" key={facility.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><h3 className="font-semibold text-hb-deepNavy">{facility.name}</h3><p className="text-xs text-hb-muted">{facility.facilityType.replaceAll("_", " ")} · {[facility.city, facility.county, facility.state].filter(Boolean).join(", ")}</p></div>
                      <div className="flex gap-2"><button className="rounded border border-hb-border px-2 py-1 text-xs font-semibold" onClick={() => onFacilityZoom(facility.id)} type="button">Show on map</button><button className="rounded border border-hb-border px-2 py-1 text-xs font-semibold" onClick={() => { onFacilitySelect(facility.id); setExpandedIds((current) => { const next = new Set(current); next.has(facility.id) ? next.delete(facility.id) : next.add(facility.id); return next; }); }} type="button">{expanded ? "Hide record" : "View record"}</button></div>
                    </div>
                    {expanded && <div className="mt-3"><HealthcareFacilityReportCard dataQualityAudit={qualityAudit ?? auditSingleHealthcareFacility(facility)} facility={facility} mode="full" selected={selectedFacilityId === facility.id} /></div>}
                  </div>
                );
              })}
              {results.length > 100 && <p className="text-xs font-semibold text-hb-muted">Showing the first 100 matching records. Narrow the filters to see a specific facility.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default HealthcareFacilityExplorer;
