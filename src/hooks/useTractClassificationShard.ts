import { useEffect, useState } from "react";
import type { GeographyData } from "./useGeographyData";
import type { TractAccessGapClassification } from "../types/tractEvidence";

export type TractClassificationShardState = {
  classifications: TractAccessGapClassification[];
  error: string | null;
  geography: GeographyData | null;
  loadState: "idle" | "loading" | "ready" | "error";
};

const shardCache = new Map<
  string,
  Promise<{
    classifications: TractAccessGapClassification[];
    geography: GeographyData;
  }>
>();

async function fetchJson<T>(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

function loadShard(countyFips: string) {
  const cached = shardCache.get(countyFips);
  if (cached) return cached;
  const request = Promise.all([
    fetchJson<GeographyData>(`/data/tracts/nj/by-county/${countyFips}.geojson`),
    fetchJson<TractAccessGapClassification[]>(
      `/data/tracts/nj/classifications/access-gap-rule-v1/by-county/${countyFips}.json`
    )
  ])
    .then(([geography, classifications]) => ({ geography, classifications }))
    .catch((error) => {
      shardCache.delete(countyFips);
      throw error;
    });
  shardCache.set(countyFips, request);
  return request;
}

export function useTractClassificationShard(
  countyFips: string | null,
  enabled: boolean
) {
  const [state, setState] = useState<TractClassificationShardState>({
    classifications: [],
    error: null,
    geography: null,
    loadState: "idle"
  });

  useEffect(() => {
    if (!enabled || !countyFips || !/^\d{3}$/.test(countyFips)) {
      setState({ classifications: [], error: null, geography: null, loadState: "idle" });
      return;
    }
    let active = true;
    setState({ classifications: [], error: null, geography: null, loadState: "loading" });
    loadShard(countyFips)
      .then((result) => {
        if (active) setState({ ...result, error: null, loadState: "ready" });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            classifications: [],
            error: error instanceof Error ? error.message : "Unknown tract layer error",
            geography: null,
            loadState: "error"
          });
        }
      });
    return () => {
      active = false;
    };
  }, [countyFips, enabled]);

  return state;
}
