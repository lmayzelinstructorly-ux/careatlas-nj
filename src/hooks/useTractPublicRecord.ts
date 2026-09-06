import { useEffect, useState } from "react";
import type {
  TractPublicRecord,
  TractPublicRecordLoadState
} from "../types/tractPublicRecord";

type State = {
  error: string | null;
  loadState: TractPublicRecordLoadState;
  record: TractPublicRecord | null;
};

const countyRecordCache = new Map<string, Promise<TractPublicRecord[]>>();

export function loadCountyTractPublicRecords(countyFips: string) {
  const cached = countyRecordCache.get(countyFips);
  if (cached) return cached;
  const request = fetch(
    `/data/tracts/nj/public-records/tracts/by-county/${countyFips}.json`
  )
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json() as Promise<TractPublicRecord[]>;
    })
    .catch((error) => {
      countyRecordCache.delete(countyFips);
      throw error;
    });
  countyRecordCache.set(countyFips, request);
  return request;
}

export function useTractPublicRecord(geoid: string | null) {
  const [state, setState] = useState<State>({
    error: null,
    loadState: "idle",
    record: null
  });

  useEffect(() => {
    if (!geoid || !/^34\d{9}$/.test(geoid)) {
      setState({ error: null, loadState: "idle", record: null });
      return;
    }
    let active = true;
    const countyFips = geoid.slice(2, 5);
    setState({ error: null, loadState: "loading", record: null });
    loadCountyTractPublicRecords(countyFips)
      .then((records) => {
        if (!active) return;
        const record = records.find((candidate) => candidate.geography.geoid === geoid) ?? null;
        setState({
          error: record ? null : `No public record was found for tract ${geoid}.`,
          loadState: record ? "ready" : "error",
          record
        });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            error: error instanceof Error ? error.message : "Unknown tract evidence error",
            loadState: "error",
            record: null
          });
        }
      });
    return () => {
      active = false;
    };
  }, [geoid]);

  return state;
}
