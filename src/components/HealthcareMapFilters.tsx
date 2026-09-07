import type { HealthcareFacilityFilters } from "../types/healthcare";
import {
  defaultHealthcareFacilityFilters,
  getActiveHealthcareFacilityFilterSummaries,
  hasActiveHealthcareFacilityFilters,
  healthcareFacilityFilterGroups
} from "../utils/healthcareFacilityFilters";

type HealthcareMapFiltersProps = {
  filteredCount: number;
  filteredFacilityCount: number;
  filters: HealthcareFacilityFilters;
  totalCount: number;
  totalFacilityCount: number;
  onFiltersChange: (filters: HealthcareFacilityFilters) => void;
};

function HealthcareMapFilters({
  filteredCount,
  filteredFacilityCount,
  filters,
  totalCount,
  totalFacilityCount,
  onFiltersChange
}: HealthcareMapFiltersProps) {
  const hasActiveFilters = hasActiveHealthcareFacilityFilters(filters);
  const hasFacilities = totalFacilityCount > 0;
  const activeFilterSummaries =
    getActiveHealthcareFacilityFilterSummaries(filters);

  function updateFilter(key: keyof HealthcareFacilityFilters, value: string) {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }

  function clearFilter(key: keyof HealthcareFacilityFilters) {
    updateFilter(key, defaultHealthcareFacilityFilters[key]);
  }

  return (
    <section
      aria-label="Healthcare marker filters"
      className="rounded-lg border border-hb-aqua/25 bg-white/88 p-3 shadow-[0_10px_24px_rgb(0_43_77_/_0.06)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
            Marker filters
          </p>
          <p className="mt-1 text-sm font-black text-hb-deepNavy">
            {filteredCount} of {totalCount} mappable records
          </p>
        </div>
        <button
          className="rounded-md border border-hb-aqua/25 bg-hb-background px-2 py-1 text-[10px] font-black uppercase leading-none tracking-[0.06em] text-hb-navy transition hover:border-hb-aqua/45 hover:bg-hb-aqua/10 focus:outline-none focus:ring-2 focus:ring-hb-aqua/35 disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!hasActiveFilters}
          onClick={() => onFiltersChange(defaultHealthcareFacilityFilters)}
          type="button"
        >
          Reset filters
        </button>
      </div>

      <p className="mt-2 text-xs font-semibold leading-5 text-hb-muted">
        {hasFacilities
          ? `${filteredFacilityCount} of ${totalFacilityCount} loaded records match these filters. Markers require valid latitude and longitude.`
          : "Facility records are not loaded in this panel yet. This is not evidence that an area has no healthcare."}
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-hb-muted">
        Unknown price or insurance means missing or unverified data.
      </p>

      <section
        aria-label="Active marker filters"
        className="mt-3 rounded-lg border border-hb-aqua/20 bg-hb-background px-3 py-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal">
            Active filters
          </p>
          <span className="text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-muted">
            {activeFilterSummaries.length} active
          </span>
        </div>
        {activeFilterSummaries.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {activeFilterSummaries.map((summary) => (
              <button
                aria-label={`Clear ${summary.label} filter`}
                className="max-w-full rounded-md border border-hb-aqua/30 bg-white px-2 py-1 text-left text-[11px] font-black leading-4 text-hb-navy transition hover:border-hb-aqua/50 hover:bg-hb-aqua/10 focus:outline-none focus:ring-2 focus:ring-hb-aqua/35"
                key={summary.key}
                onClick={() => clearFilter(summary.key)}
                type="button"
              >
                <span className="font-semibold text-hb-muted">
                  {summary.label}:
                </span>{" "}
                {summary.valueLabel} <span aria-hidden="true">x</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs font-semibold leading-5 text-hb-muted">
            No marker filters are active.
          </p>
        )}
      </section>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {healthcareFacilityFilterGroups.map((group) => (
          <label
            className="grid gap-1 text-[10px] font-black uppercase leading-none tracking-[0.08em] text-hb-teal"
            key={group.key}
          >
            <span>{group.label}</span>
            <select
              className="h-9 rounded-lg border border-hb-aqua/30 bg-hb-background px-2 text-xs font-black normal-case tracking-normal text-hb-deepNavy outline-none transition focus:border-hb-aqua focus:ring-2 focus:ring-hb-aqua/25"
              onChange={(event) => updateFilter(group.key, event.target.value)}
              value={filters[group.key]}
            >
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {hasFacilities && totalCount === 0 && (
        <section className="mt-3 rounded-lg border border-hb-border bg-hb-background px-3 py-3">
          <p className="text-xs font-black text-hb-deepNavy">
            No loaded records can be mapped yet.
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-hb-muted">
            Loaded facility records currently lack valid coordinates for marker
            display. Use the facility explorer for source details and coverage notes.
          </p>
        </section>
      )}

      {hasFacilities && totalCount > 0 && filteredCount === 0 && (
        <section className="mt-3 rounded-lg border border-hb-border bg-hb-background px-3 py-3">
          <p className="text-xs font-black text-hb-deepNavy">
            No loaded map markers match these filters.
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-hb-muted">
            Try Reset filters or broaden individual filter selections. Missing
            price, insurance or service fields remain unknown and are not
            treated as negative evidence.
          </p>
        </section>
      )}
    </section>
  );
}

export default HealthcareMapFilters;
