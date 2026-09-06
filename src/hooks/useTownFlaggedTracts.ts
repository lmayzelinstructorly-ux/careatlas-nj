import { useEffect, useState } from "react";
import type { TractPublicRecord } from "../types/tractPublicRecord";
import { loadCountyTractPublicRecords } from "./useTractPublicRecord";

export type TownFlaggedTract = {
  geoid: string;
  name: string;
  reason: string;
};

type State = {
  error: string | null;
  loadState: "idle" | "loading" | "ready" | "error";
  records: TownFlaggedTract[];
};

function isValidatedPotentialGapRecord(
  record: TractPublicRecord | undefined
): record is TractPublicRecord {
  const findings = record?.screening.findings;
  return Boolean(
    record?.screening.state === "potential_access_gap" &&
      findings?.documentedShortage === true &&
      (findings.elevatedCommunityHealthNeed === true ||
        findings.elevatedSocialBarriers === true)
  );
}

export function getPotentialGapReason(record: TractPublicRecord) {
  const findings = record.screening.findings;

  if (
    findings.elevatedCommunityHealthNeed &&
    findings.elevatedSocialBarriers
  ) {
    return "Elevated community health need and social barriers, with a documented primary-care shortage.";
  }
  if (findings.elevatedCommunityHealthNeed) {
    return "Elevated community health need, with a documented primary-care shortage.";
  }
  return "Elevated social barriers, with a documented primary-care shortage.";
}

export function useTownFlaggedTracts(
  countyFips: string | null,
  tractGeoids: string[]
) {
  const [state, setState] = useState<State>({
    error: null,
    loadState: "idle",
    records: []
  });

  useEffect(() => {
    if (
      !countyFips ||
      !/^\d{3}$/.test(countyFips) ||
      tractGeoids.length === 0
    ) {
      setState({ error: null, loadState: "idle", records: [] });
      return;
    }

    let active = true;
    setState({ error: null, loadState: "loading", records: [] });

    loadCountyTractPublicRecords(countyFips)
      .then((countyRecords) => {
        if (!active) return;

        const recordsByGeoid = new Map(
          countyRecords.map((record) => [record.geography.geoid, record])
        );
        const records = [...new Set(tractGeoids)]
          .sort()
          .map((geoid) => recordsByGeoid.get(geoid))
          .filter(isValidatedPotentialGapRecord)
          .map((record) => ({
            geoid: record.geography.geoid,
            name: record.geography.name,
            reason: getPotentialGapReason(record)
          }));

        if (records.length !== new Set(tractGeoids).size) {
          setState({
            error:
              "One or more flagged tract records could not be validated for this town.",
            loadState: "error",
            records: []
          });
          return;
        }

        setState({ error: null, loadState: "ready", records });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          error:
            error instanceof Error
              ? error.message
              : "Unknown flagged tract record error",
          loadState: "error",
          records: []
        });
      });

    return () => {
      active = false;
    };
  }, [countyFips, tractGeoids]);

  return state;
}
