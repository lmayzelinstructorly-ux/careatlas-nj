import { useEffect, useState } from "react";
import type { HealthcareCoverageSummary } from "../types/healthcareCoverage";

export type HealthcareCoverageSummaryLoadState = "loading" | "ready" | "error";

function isCoverageSummary(value: unknown): value is HealthcareCoverageSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const summary = value as Partial<HealthcareCoverageSummary>;

  return (
    summary.schemaVersion === 1 &&
    summary.coverageStatus === "limited_production_coverage" &&
    Number.isInteger(summary.totalFacilities) &&
    Array.isArray(summary.loadedStates) &&
    Array.isArray(summary.sources) &&
    Array.isArray(summary.facilityTypes) &&
    Array.isArray(summary.caveats)
  );
}

export function useHealthcareCoverageSummary() {
  const [summary, setSummary] = useState<HealthcareCoverageSummary | null>(null);
  const [loadState, setLoadState] =
    useState<HealthcareCoverageSummaryLoadState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        const response = await fetch("/data/healthcare/coverage-summary.json");

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data: unknown = await response.json();

        if (!isCoverageSummary(data)) {
          throw new Error("Healthcare coverage summary has an invalid format.");
        }

        if (isMounted) {
          setSummary(data);
          setLoadState("ready");
          setError("");
        }
      } catch (loadError) {
        if (isMounted) {
          setSummary(null);
          setLoadState("error");
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Healthcare coverage summary could not be loaded."
          );
        }
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  return { error, loadState, summary };
}
