import { useEffect, useState } from "react";
import type {
  CountyTownGapFoundationArtifact,
  TownTractScreeningContext
} from "../types/townGapContext";

type TownGapContextState = {
  error: string | null;
  limitations: string[];
  loadState: "idle" | "loading" | "ready" | "error";
  record: TownTractScreeningContext | null;
  ruleVersion: string | null;
  tractGeoids: string[];
};

const countyRequests = new Map<
  string,
  Promise<CountyTownGapFoundationArtifact>
>();

function loadCountyTownContext(countyFips: string) {
  const existingRequest = countyRequests.get(countyFips);
  if (existingRequest) return existingRequest;

  const request = fetch(
    `/data/tracts/nj/town-foundation/by-county/${countyFips}.json`
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response.json() as Promise<CountyTownGapFoundationArtifact>;
    })
    .catch((error) => {
      countyRequests.delete(countyFips);
      throw error;
    });

  countyRequests.set(countyFips, request);
  return request;
}

export function useTownGapContext(
  countyFips: string | null,
  townGeoid: string | null
) {
  const [state, setState] = useState<TownGapContextState>({
    error: null,
    limitations: [],
    loadState: "idle",
    record: null,
    ruleVersion: null,
    tractGeoids: []
  });

  useEffect(() => {
    if (
      !countyFips ||
      !/^\d{3}$/.test(countyFips) ||
      !townGeoid ||
      !/^34\d{8}$/.test(townGeoid)
    ) {
      setState({
        error: null,
        limitations: [],
        loadState: "idle",
        record: null,
        ruleVersion: null,
        tractGeoids: []
      });
      return;
    }

    let active = true;
    setState({
      error: null,
      limitations: [],
      loadState: "loading",
      record: null,
      ruleVersion: null,
      tractGeoids: []
    });

    loadCountyTownContext(countyFips)
      .then((artifact) => {
        if (!active) return;
        const record =
          artifact.towns.find((town) => town.geography.geoid === townGeoid) ??
          null;
        const tractGeoids = record
          ? artifact.tracts
              .filter(
                (tract) =>
                  tract.screeningState === "potential_access_gap" &&
                  (record.dataQuality.hasPrimaryAssignedTracts
                    ? tract.primaryTown.geoid === townGeoid
                    : tract.overlaps.some(
                        (overlap) => overlap.townGeoid === townGeoid
                      ))
              )
              .map((tract) => tract.geography.geoid)
          : [];

        setState({
          error: record
            ? null
            : `No tract screening context was found for town ${townGeoid}.`,
          limitations: artifact.limitations,
          loadState: record ? "ready" : "error",
          record,
          ruleVersion: artifact.ruleVersion,
          tractGeoids
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          error:
            error instanceof Error
              ? error.message
              : "Unknown town screening context error",
          limitations: [],
          loadState: "error",
          record: null,
          ruleVersion: null,
          tractGeoids: []
        });
      });

    return () => {
      active = false;
    };
  }, [countyFips, townGeoid]);

  return state;
}
