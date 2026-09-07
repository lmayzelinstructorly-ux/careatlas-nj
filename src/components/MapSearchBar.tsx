import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { BoundarySearchLevel, BoundarySearchTarget } from "../types";

type SearchLevelFilter = "all" | BoundarySearchLevel;

type MapSearchBarProps = {
  onSearchTargetSelect: (target: BoundarySearchTarget) => void;
};

const searchManifestUrl = "/data/geography/search/search-manifest.json";
const minimumQueryLength = 2;
const maximumSuggestions = 9;
const newJerseyStateFips = "34";

type StateSearchShard = {
  boundaryCount: number;
  byteLength: number;
  stateAbbr: string | null;
  stateFips: string;
  stateName: string;
  url: string;
};

type SearchManifest = {
  boundaryCount: number;
  schemaVersion: number;
  stateCount: number;
  states: StateSearchShard[];
  statesUrl: string;
};

const stateShardCache = new Map<
  string,
  Promise<BoundarySearchTarget[]>
>();

async function fetchJson<T>(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load ${url}`);
  }

  return response.json() as Promise<T>;
}

function loadStateShard(shard: StateSearchShard) {
  const cachedRequest = stateShardCache.get(shard.stateFips);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetchJson<BoundarySearchTarget[]>(shard.url).catch((error) => {
    stateShardCache.delete(shard.stateFips);
    throw error;
  });
  stateShardCache.set(shard.stateFips, request);
  return request;
}

const levelOptions: { label: string; value: SearchLevelFilter }[] = [
  { label: "All", value: "all" },
  { label: "County", value: "county" },
  { label: "Town", value: "local" },
  { label: "Tract", value: "tract" }
];

const levelBadgeLabels: Record<BoundarySearchLevel, string> = {
  county: "County",
  local: "Local",
  state: "State",
  tract: "Tract"
};

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatBoundaryNameForDisplay(value: string) {
  const minorWords = new Set(["and", "at", "by", "for", "in", "of", "on", "the"]);

  return value
    .split(/(\s+)/)
    .map((part, index) => {
      if (/^\s+$/.test(part) || part.length === 0) {
        return part;
      }

      return part
        .split("-")
        .map((segment, segmentIndex) => {
          if (!segment) {
            return segment;
          }

          if (/^[A-Z]{2,}$/.test(segment) || /\d/.test(segment)) {
            return segment;
          }

          const lowerSegment = segment.toLowerCase();
          const isMinorWord =
            minorWords.has(lowerSegment) && (index > 0 || segmentIndex > 0);

          if (isMinorWord) {
            return lowerSegment;
          }

          return `${lowerSegment.charAt(0).toUpperCase()}${lowerSegment.slice(1)}`;
        })
        .join("-");
    })
    .join("");
}

function getSuggestionDisplayName(suggestion: BoundarySearchTarget) {
  return formatBoundaryNameForDisplay(
    suggestion.fullLegalName ?? suggestion.displayName
  );
}

function getSelectedQueryText(result: BoundarySearchTarget) {
  return formatBoundaryNameForDisplay(result.displayName);
}

function getContextText(result: BoundarySearchTarget) {
  if (result.level === "state") {
    return "";
  }

  const stateText = result.stateAbbr ?? result.stateName;

  if (result.level === "county") {
    return stateText ? formatBoundaryNameForDisplay(stateText) : "";
  }

  return [result.countyName, stateText]
    .filter((part): part is string => Boolean(part))
    .map((part) => formatBoundaryNameForDisplay(part))
    .join(", ");
}

function getSearchRank(result: BoundarySearchTarget, normalizedQuery: string) {
  const normalizedName = result.normalizedName;
  const normalizedGeoid = normalizeSearchText(result.geoid ?? "");
  const normalizedLegalName = result.fullLegalName
    ? normalizeSearchText(result.fullLegalName)
    : "";
  const nameText = `${normalizedName} ${normalizedLegalName} ${normalizedGeoid}`.trim();
  const contextText = normalizeSearchText(
    [result.countyName, result.stateAbbr, result.stateName]
      .filter(Boolean)
      .join(" ")
  );

  if (
    normalizedName === normalizedQuery ||
    normalizedLegalName === normalizedQuery ||
    normalizedGeoid === normalizedQuery
  ) {
    return 0;
  }

  if (
    normalizedName.startsWith(normalizedQuery) ||
    normalizedLegalName.startsWith(normalizedQuery)
  ) {
    return 1;
  }

  if (nameText.split(" ").some((word) => word.startsWith(normalizedQuery))) {
    return 2;
  }

  if (
    normalizedName.includes(normalizedQuery) ||
    normalizedLegalName.includes(normalizedQuery)
  ) {
    return 3;
  }

  if (
    normalizedQuery.length >= 3 &&
    contextText.split(" ").some((word) => word.startsWith(normalizedQuery))
  ) {
    return 4;
  }

  return null;
}

function getSuggestionSortKey(result: BoundarySearchTarget) {
  const levelOrder = result.level === "state" ? "0" : result.level === "county" ? "1" : "2";

  return [
    levelOrder,
    result.normalizedName,
    result.stateAbbr ?? result.stateName ?? "",
    result.countyName ?? "",
    result.geoid ?? result.id
  ].join("|");
}

function shouldIncludeForFilters(
  result: BoundarySearchTarget,
  levelFilter: SearchLevelFilter,
  selectedStateFips: string,
  selectedCountyFips: string
) {
  if (levelFilter !== "all" && result.level !== levelFilter) {
    return false;
  }

  if (!selectedStateFips) {
    return true;
  }

  if (result.level === "state") {
    return result.stateFips === selectedStateFips;
  }

  if (result.stateFips !== selectedStateFips) {
    return false;
  }

  if (
    !selectedCountyFips ||
    (result.level !== "local" && result.level !== "tract")
  ) {
    return true;
  }

  return result.countyFips === selectedCountyFips;
}

function MapSearchBar({ onSearchTargetSelect }: MapSearchBarProps) {
  const inputId = useId();
  const countyFilterId = useId();
  const listboxId = useId();
  const optionIdPrefix = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<SearchLevelFilter>("all");
  const selectedStateFips = newJerseyStateFips;
  const [selectedCountyFips, setSelectedCountyFips] = useState("");
  const [manifest, setManifest] = useState<SearchManifest | null>(null);
  const [loadedShards, setLoadedShards] = useState<
    Record<string, BoundarySearchTarget[]>
  >({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isShardLoading, setIsShardLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [shardLoadError, setShardLoadError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const normalizedQuery = normalizeSearchText(query);
  const countyFilterEnabled =
    (levelFilter === "all" || levelFilter === "local" || levelFilter === "tract");
  const searchIndex = useMemo(
    () => Object.values(loadedShards).flat(),
    [loadedShards]
  );
  const isLoading = isInitialLoading || isShardLoading;

  useEffect(() => {
    let isActive = true;

    fetchJson<SearchManifest>(searchManifestUrl)
      .then((nextManifest) => {
        if (!isActive) {
          return;
        }

        setManifest(nextManifest);
        setLoadError(false);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        console.error(error);
        setLoadError(true);
      })
      .finally(() => {
        if (isActive) {
          setIsInitialLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!manifest) {
      setIsShardLoading(false);
      return;
    }

    const requiredShards = manifest.states.filter(
      (state) => state.stateFips === newJerseyStateFips
    );
    const missingShards = requiredShards.filter(
      (state) => !loadedShards[state.stateFips]
    );

    if (missingShards.length === 0) {
      setIsShardLoading(false);
      return;
    }

    let isActive = true;
    setIsShardLoading(true);
    setShardLoadError(false);

    Promise.allSettled(
      missingShards.map(async (shard) => ({
        entries: await loadStateShard(shard),
        stateFips: shard.stateFips
      }))
    ).then((results) => {
      if (!isActive) {
        return;
      }

      const successfulShards = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );
      const failedResults = results.filter(
        (result) => result.status === "rejected"
      );

      if (successfulShards.length > 0) {
        setLoadedShards((currentShards) => {
          const nextShards = { ...currentShards };

          for (const shard of successfulShards) {
            nextShards[shard.stateFips] = shard.entries;
          }

          return nextShards;
        });
      }

      if (failedResults.length > 0) {
        console.error("Some boundary search data could not be loaded.");
        setShardLoadError(true);
      }

      setIsShardLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [
    levelFilter,
    loadedShards,
    manifest,
    normalizedQuery,
    selectedStateFips
  ]);

  const countyOptions = useMemo(
    () =>
      Array.from(
        new Map(
          searchIndex
            .filter(
              (entry) =>
                entry.level === "county" && entry.stateFips === selectedStateFips
            )
            .map((entry) => [
              entry.countyFips ?? entry.geoid ?? entry.id,
              {
                countyFips: entry.countyFips ?? "",
                label: entry.fullLegalName ?? entry.displayName
              }
            ])
        ).values()
      ).sort((first, second) => first.label.localeCompare(second.label)),
    [searchIndex, selectedStateFips]
  );

  const suggestions = useMemo(() => {
    if (normalizedQuery.length < minimumQueryLength || loadError) {
      return [];
    }

    return searchIndex
      .filter((result) =>
        shouldIncludeForFilters(
          result,
          levelFilter,
          selectedStateFips,
          countyFilterEnabled ? selectedCountyFips : ""
        )
      )
      .map((result) => ({
        result,
        rank: getSearchRank(result, normalizedQuery)
      }))
      .filter(
        (entry): entry is { result: BoundarySearchTarget; rank: number } =>
          entry.rank !== null
      )
      .sort(
        (first, second) =>
          first.rank - second.rank ||
          getSuggestionSortKey(first.result).localeCompare(
            getSuggestionSortKey(second.result)
          )
      )
      .slice(0, maximumSuggestions)
      .map(({ result }) => result);
  }, [
    countyFilterEnabled,
    levelFilter,
    loadError,
    normalizedQuery,
    searchIndex,
    selectedCountyFips,
    selectedStateFips,
  ]);

  useEffect(() => {
    if (!countyFilterEnabled) {
      setSelectedCountyFips("");
    }
  }, [countyFilterEnabled]);

  useEffect(() => {
    setHighlightedIndex(0);
    setIsOpen(normalizedQuery.length >= minimumQueryLength);
  }, [levelFilter, normalizedQuery, selectedCountyFips, selectedStateFips]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function selectSuggestion(result: BoundarySearchTarget) {
    setQuery(getSelectedQueryText(result));
    setIsOpen(false);
    onSearchTargetSelect(result);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && event.key !== "Escape") {
      setIsOpen(normalizedQuery.length >= minimumQueryLength);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        suggestions.length === 0
          ? 0
          : Math.min(currentIndex + 1, suggestions.length - 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (!isOpen) {
        return;
      }

      const highlightedSuggestion = suggestions[highlightedIndex];

      if (highlightedSuggestion) {
        event.preventDefault();
        selectSuggestion(highlightedSuggestion);
      }
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showMenu = isOpen && normalizedQuery.length >= minimumQueryLength;
  const activeOptionId =
    showMenu && suggestions[highlightedIndex]
      ? `${optionIdPrefix}-${highlightedIndex}`
      : undefined;

  return (
    <div className="hb-map-search" ref={containerRef}>
      <label className="hb-map-search__label" htmlFor={inputId}>
        Boundary search
      </label>
      <div className="hb-map-search__module">
        <div className="hb-map-search__input-wrap">
          <span aria-hidden="true" className="hb-map-search__input-icon" />
          <input
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={showMenu}
            aria-label="Search New Jersey counties, towns, local jurisdictions, or census tracts"
            className="hb-map-search__input"
            disabled={loadError}
            id={inputId}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsOpen(normalizedQuery.length >= minimumQueryLength)}
            onKeyDown={handleKeyDown}
            placeholder="Search New Jersey..."
            role="combobox"
            type="search"
            value={query}
          />
        </div>
        <div className="hb-map-search__filters">
          <fieldset className="hb-map-search__filter hb-map-search__filter--wide">
            <legend className="hb-map-search__filter-label">Level</legend>
            <div
              aria-label="Boundary level filter"
              className="hb-map-search__segments"
              role="radiogroup"
            >
              {levelOptions.map((option) => (
                <button
                  aria-checked={levelFilter === option.value}
                  className="hb-map-search__segment"
                  key={option.value}
                  onClick={() => setLevelFilter(option.value)}
                  role="radio"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="hb-map-search__filter hb-map-search__filter--wide">
            <span className="hb-map-search__filter-label">County</span>
            <select
              className="hb-map-search__select"
              disabled={!countyFilterEnabled || countyOptions.length === 0}
              id={countyFilterId}
              onChange={(event) => setSelectedCountyFips(event.target.value)}
              value={countyFilterEnabled ? selectedCountyFips : ""}
            >
              <option value="">All counties</option>
              {countyOptions.map((county) => (
                <option key={county.countyFips} value={county.countyFips}>
                  {county.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {loadError && (
        <p className="hb-map-search__message">Search is temporarily unavailable.</p>
      )}
      {showMenu && (
        <div className="hb-map-search__menu" id={listboxId} role="listbox">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => {
              const contextText = getContextText(suggestion);

              return (
                <button
                  aria-selected={highlightedIndex === index}
                  className="hb-map-search__option"
                  id={`${optionIdPrefix}-${index}`}
                  key={suggestion.id}
                  onClick={() => selectSuggestion(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  role="option"
                  type="button"
                >
                  <span className="hb-map-search__option-topline">
                    <span className="hb-map-search__option-name">
                      {getSuggestionDisplayName(suggestion)}
                    </span>
                    <span
                      className={`hb-map-search__badge hb-map-search__badge--${suggestion.level}`}
                    >
                      {levelBadgeLabels[suggestion.level]}
                    </span>
                  </span>
                  {contextText && (
                    <span className="hb-map-search__option-context">
                      {contextText}
                    </span>
                  )}
                </button>
              );
            })
          ) : isLoading ? (
            <p className="hb-map-search__message">Loading search...</p>
          ) : (
            <p className="hb-map-search__message">
              No matching boundaries found.
            </p>
          )}
          {suggestions.length > 0 && isShardLoading && (
            <p className="hb-map-search__message">Loading more places...</p>
          )}
          {shardLoadError && (
            <p className="hb-map-search__message">
              Some New Jersey places are temporarily unavailable. Try again.
            </p>
          )}
        </div>
      )}
      {!showMenu && !loadError && !countyFilterEnabled && (
        <p className="hb-map-search__message hb-map-search__message--inline">
          {isInitialLoading
            ? "Preparing New Jersey search..."
            : "Start typing to search New Jersey."}
        </p>
      )}
      {!showMenu &&
        !loadError &&
        countyFilterEnabled &&
        isShardLoading && (
          <p className="hb-map-search__message hb-map-search__message--inline">
            Loading New Jersey places...
          </p>
        )}
      {!showMenu &&
        !loadError &&
        countyFilterEnabled &&
        !isShardLoading &&
        countyOptions.length === 0 && (
          <p className="hb-map-search__message hb-map-search__message--inline">
            {shardLoadError
              ? "Some places are temporarily unavailable. Try again shortly."
              : "No New Jersey counties are available yet."}
          </p>
        )}
    </div>
  );
}

export default MapSearchBar;
