import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { GeographyLevel } from "../../geographyLayers";
import type { GeographyData } from "../../hooks/useGeographyData";
import { getGeographyFeatureColorKey } from "../../utils/geographyColors";
import {
  getBoundaryLegalName,
  getBoundaryLegalType
} from "./boundaryNames";
import { careAtlasMapResetEvent } from "./mapReset";
import { normalizePlaceQuery, rankPlaceMatch } from "../../utils/placeSearch";

const maximumSuggestions = 16;

export type BoundaryAutocompleteCandidate = {
  displayName: string;
  feature: Feature<Geometry, GeoJsonProperties>;
  key: string;
  level: Extract<GeographyLevel, "counties" | "towns">;
  normalizedName: string;
  typeLabel: string;
};

type BoundaryAutocompleteProps = {
  embedded?: boolean;
  countyData: GeographyData | null;
  onSelect: (candidate: BoundaryAutocompleteCandidate) => void;
  townData: GeographyData | null;
};

function getDisplayName(
  feature: Feature<Geometry, GeoJsonProperties>,
  level: BoundaryAutocompleteCandidate["level"]
) {
  return getBoundaryLegalName(
    feature,
    level === "counties" ? "Unnamed County" : "Unnamed Municipality"
  );
}

export function buildCandidates(
  data: GeographyData | null,
  level: BoundaryAutocompleteCandidate["level"]
) {
  return (data?.features ?? []).map((feature) => {
    const displayName = getDisplayName(feature, level);

    return {
      displayName,
      feature,
      key: getGeographyFeatureColorKey(feature, level),
      level,
      normalizedName: normalizePlaceQuery(displayName),
      typeLabel:
        level === "counties"
          ? "County"
          : getBoundaryLegalType(feature) ?? "Municipality"
    };
  });
}

export function BoundaryAutocomplete({
  embedded = false,
  countyData,
  onSelect,
  townData
}: BoundaryAutocompleteProps) {
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState("");
  const candidates = useMemo(
    () => [
      ...buildCandidates(countyData, "counties"),
      ...buildCandidates(townData, "towns")
    ],
    [countyData, townData]
  );
  const normalizedQuery = normalizePlaceQuery(query);
  const suggestions = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return candidates
      .map((candidate) => ({
        candidate,
        rank: rankPlaceMatch(candidate.normalizedName, normalizedQuery)
      }))
      .filter(({ rank }) => Number.isFinite(rank))
      .sort(
        (first, second) =>
          first.rank - second.rank ||
          first.candidate.displayName.localeCompare(
            second.candidate.displayName
          ) ||
          first.candidate.level.localeCompare(second.candidate.level)
      )
      .slice(0, maximumSuggestions)
      .map(({ candidate }) => candidate);
  }, [candidates, normalizedQuery]);
  const isOpen = isFocused && normalizedQuery.length > 0;

  useEffect(() => {
    setActiveIndex(suggestions.length > 0 ? 0 : -1);
  }, [normalizedQuery, suggestions.length]);

  useEffect(() => {
    const reset = () => {
      setActiveIndex(-1);
      setIsFocused(false);
      setQuery("");
    };
    window.addEventListener(careAtlasMapResetEvent, reset);
    return () => window.removeEventListener(careAtlasMapResetEvent, reset);
  }, []);

  function chooseSuggestion(candidate: BoundaryAutocompleteCandidate) {
    setQuery(candidate.displayName);
    setIsFocused(false);
    onSelect(candidate);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsFocused(false);
      return;
    }
    if (!isOpen || suggestions.length === 0) {
      if (event.key === "ArrowDown" && normalizedQuery) {
        setIsFocused(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeIndex]);
      return;
    }

  }

  return (
    <div
      className={embedded ? "relative w-full" : "absolute left-14 right-3 top-3 z-[1000] sm:left-auto sm:w-[22rem]"}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocused(false);
        }
      }}
    >
      <label className={embedded ? "mb-1 block text-xs font-semibold text-hb-muted" : "sr-only"} htmlFor="boundary-autocomplete">
        Search New Jersey counties, towns, and townships
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hb-teal"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
        <input
          aria-activedescendant={
            isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 bg-white/95 py-2.5 pl-9 pr-9 text-sm font-semibold text-hb-deepNavy shadow-[0_10px_24px_rgb(0_43_77_/_0.16)] outline-none backdrop-blur placeholder:font-medium placeholder:text-hb-muted focus:border-hb-aqua focus:ring-2 focus:ring-cyan-100"
          id="boundary-autocomplete"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsFocused(true);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search a county or town..."
          role="combobox"
          value={query}
        />
        {query && (
          <button
            aria-label="Clear boundary search"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg text-hb-muted hover:bg-slate-100 hover:text-hb-deepNavy focus:outline-none focus:ring-2 focus:ring-hb-aqua"
            onClick={() => {
              setQuery("");
              setIsFocused(true);
            }}
            type="button"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_16px_34px_rgb(0_43_77_/_0.2)]">
          {suggestions.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto py-1" id={listboxId} role="listbox">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.key}>
                  <button
                    aria-selected={index === activeIndex}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                      index === activeIndex
                        ? "bg-cyan-50 text-hb-deepNavy"
                        : "text-hb-text hover:bg-slate-50"
                    }`}
                    id={`${listboxId}-option-${index}`}
                    onClick={() => chooseSuggestion(suggestion)}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                    type="button"
                  >
                    <span className="min-w-0 truncate font-bold">
                      {suggestion.displayName}
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold tracking-wide text-hb-muted">
                      {suggestion.typeLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-hb-muted">
              {!townData ? "Town suggestions are still loading. Please try again in a moment." : `No New Jersey county or town matches “${query.trim()}”. Try a shorter name or check the spelling.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
