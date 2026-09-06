import { useEffect, useState } from "react";
import type { CountyGapCounts } from "./useCountyGapSummary";
import type {
  CountyTownGapFoundationArtifact,
  TownTractScreeningContext
} from "../types/townGapContext";

export type GapExplorerCounty = {
  countyFips: string;
  countyName: string;
  potentialGapTractCount: number;
  townDataUrl: string;
};

export type GapExplorerTown = {
  contextKind: "primary-assigned" | "intersecting";
  countyFips: string;
  geoid: string;
  name: string;
  potentialGapTractCount: number;
};

type GapExplorerSummaryArtifact = {
  stateCountsByCounty: Record<string, CountyGapCounts>;
};

type TownFoundationSummaryArtifact = {
  counties: Array<{
    countyFips: string;
    countyName: string;
    url: string;
  }>;
};

type LoadState = "idle" | "loading" | "ready" | "error";

let summaryRequest: Promise<{
  gapSummary: GapExplorerSummaryArtifact;
  townSummary: TownFoundationSummaryArtifact;
}> | null = null;
const townShardRequests = new Map<
  string,
  Promise<CountyTownGapFoundationArtifact>
>();

function fetchJson<T>(url: string) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json() as Promise<T>;
  });
}

function loadSummaries() {
  if (!summaryRequest) {
    summaryRequest = Promise.all([
      fetchJson<GapExplorerSummaryArtifact>(
        "/data/tracts/nj/access-gap-rule-v1-summary.json"
      ),
      fetchJson<TownFoundationSummaryArtifact>(
        "/data/tracts/nj/town-foundation/summary.json"
      )
    ])
      .then(([gapSummary, townSummary]) => ({ gapSummary, townSummary }))
      .catch((error) => {
        summaryRequest = null;
        throw error;
      });
  }

  return summaryRequest;
}

function loadTownShard(county: GapExplorerCounty) {
  const cached = townShardRequests.get(county.countyFips);
  if (cached) return cached;

  const request = fetchJson<CountyTownGapFoundationArtifact>(
    county.townDataUrl
  ).catch((error) => {
    townShardRequests.delete(county.countyFips);
    throw error;
  });
  townShardRequests.set(county.countyFips, request);
  return request;
}

function getTownGapCount(town: TownTractScreeningContext) {
  const counts = town.dataQuality.hasPrimaryAssignedTracts
    ? town.tractContext.screeningStateCountsForPrimaryAssignedTracts
    : town.tractContext.screeningStateCountsForIntersectingTracts;

  return counts.potential_access_gap;
}

export function useGapExplorer(selectedCountyFips: string | null) {
  const [counties, setCounties] = useState<GapExplorerCounty[]>([]);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoadState, setSummaryLoadState] =
    useState<LoadState>("loading");
  const [towns, setTowns] = useState<GapExplorerTown[]>([]);
  const [townError, setTownError] = useState<string | null>(null);
  const [townLoadState, setTownLoadState] = useState<LoadState>("idle");

  useEffect(() => {
    let active = true;
    setSummaryLoadState("loading");
    loadSummaries()
      .then(({ gapSummary, townSummary }) => {
        if (!active) return;
        const nextCounties = townSummary.counties
          .map((county) => ({
            countyFips: county.countyFips,
            countyName: county.countyName,
            potentialGapTractCount:
              gapSummary.stateCountsByCounty[county.countyFips]
                ?.potential_access_gap ?? 0,
            townDataUrl: county.url
          }))
          .filter((county) => county.potentialGapTractCount > 0)
          .sort((first, second) =>
            first.countyName.localeCompare(second.countyName)
          );
        setCounties(nextCounties);
        setSummaryError(null);
        setSummaryLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCounties([]);
        setSummaryError(
          error instanceof Error ? error.message : "Unknown gap summary error"
        );
        setSummaryLoadState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCountyFips) {
      setTowns([]);
      setTownError(null);
      setTownLoadState("idle");
      return;
    }

    const county = counties.find(
      (candidate) => candidate.countyFips === selectedCountyFips
    );
    if (!county) {
      if (summaryLoadState === "ready") {
        setTowns([]);
        setTownError("This county has no currently flagged tract areas.");
        setTownLoadState("error");
      }
      return;
    }

    let active = true;
    setTowns([]);
    setTownError(null);
    setTownLoadState("loading");
    loadTownShard(county)
      .then((artifact) => {
        if (!active) return;
        const nextTowns = artifact.towns
          .map((town) => ({
            contextKind: town.dataQuality.hasPrimaryAssignedTracts
              ? ("primary-assigned" as const)
              : ("intersecting" as const),
            countyFips: town.geography.countyFips,
            geoid: town.geography.geoid,
            name: town.geography.name,
            potentialGapTractCount: getTownGapCount(town)
          }))
          .filter((town) => town.potentialGapTractCount > 0)
          .sort((first, second) => first.name.localeCompare(second.name));
        setTowns(nextTowns);
        setTownLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setTowns([]);
        setTownError(
          error instanceof Error ? error.message : "Unknown town gap error"
        );
        setTownLoadState("error");
      });

    return () => {
      active = false;
    };
  }, [counties, selectedCountyFips, summaryLoadState]);

  return {
    counties,
    summaryError,
    summaryLoadState,
    townError,
    townLoadState,
    towns
  };
}
