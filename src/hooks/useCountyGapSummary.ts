import { useEffect, useState } from "react";

export type CountyGapCounts = {
  elevated_need_without_documented_shortage: number;
  insufficient_evidence: number;
  no_current_gap_flag: number;
  potential_access_gap: number;
};

type AccessGapSummaryArtifact = {
  ruleVersion: string;
  stateCountsByCounty: Record<string, CountyGapCounts>;
};

type CountyGapSummaryState = {
  counts: CountyGapCounts | null;
  error: string | null;
  loadState: "idle" | "loading" | "ready" | "error";
  ruleVersion: string | null;
};

let summaryRequest: Promise<AccessGapSummaryArtifact> | null = null;

function loadSummary() {
  if (!summaryRequest) {
    summaryRequest = fetch("/data/tracts/nj/access-gap-rule-v1-summary.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.json() as Promise<AccessGapSummaryArtifact>;
      })
      .catch((error) => {
        summaryRequest = null;
        throw error;
      });
  }

  return summaryRequest;
}

export function useCountyGapSummary(countyFips: string | null) {
  const [state, setState] = useState<CountyGapSummaryState>({
    counts: null,
    error: null,
    loadState: "idle",
    ruleVersion: null
  });

  useEffect(() => {
    if (!countyFips || !/^\d{3}$/.test(countyFips)) {
      setState({ counts: null, error: null, loadState: "idle", ruleVersion: null });
      return;
    }

    let active = true;
    setState({ counts: null, error: null, loadState: "loading", ruleVersion: null });
    loadSummary()
      .then((artifact) => {
        if (!active) return;
        const counts = artifact.stateCountsByCounty[countyFips] ?? null;
        setState({
          counts,
          error: counts ? null : `No gap summary was found for county ${countyFips}.`,
          loadState: counts ? "ready" : "error",
          ruleVersion: artifact.ruleVersion
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          counts: null,
          error: error instanceof Error ? error.message : "Unknown county summary error",
          loadState: "error",
          ruleVersion: null
        });
      });

    return () => {
      active = false;
    };
  }, [countyFips]);

  return state;
}
