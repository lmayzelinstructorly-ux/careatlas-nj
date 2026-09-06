import { startTransition, useCallback, useEffect, useState } from "react";
import type { HealthcareFacility } from "../types/healthcare";

export type HealthcareFacilitiesLoadState =
  | "idle"
  | "loading"
  | "ready"
  | "error";
export type HealthcareDataMode = "production" | "demo";
export type HealthcareDataScope = "all" | "new-jersey";

const facilitiesRequestCache = new Map<
  string,
  Promise<HealthcareFacility[]>
>();

function getHealthcareDataMode(): HealthcareDataMode {
  return import.meta.env.VITE_HEALTHCARE_DATA_MODE === "demo"
    ? "demo"
    : "production";
}

function requestHealthcareFacilities(dataPath: string) {
  const cachedRequest = facilitiesRequestCache.get(dataPath);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetch(dataPath)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data: unknown = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Healthcare facilities data must be an array.");
      }

      return data as HealthcareFacility[];
    })
    .catch((error) => {
      facilitiesRequestCache.delete(dataPath);
      throw error;
    });

  facilitiesRequestCache.set(dataPath, request);
  return request;
}

export function useHealthcareFacilities(
  enabled = false,
  scope: HealthcareDataScope = "all"
) {
  const dataMode = getHealthcareDataMode();
  const dataPath =
    dataMode === "demo"
      ? "/data/healthcare/facilities.demo.json"
      : scope === "new-jersey"
        ? "/data/healthcare/by-state/34.json"
        : "/data/healthcare/facilities.json";
  const [facilities, setFacilities] = useState<HealthcareFacility[]>([]);
  const [loadState, setLoadState] =
    useState<HealthcareFacilitiesLoadState>("idle");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    facilitiesRequestCache.delete(dataPath);
    setReloadKey((currentKey) => currentKey + 1);
  }, [dataPath]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isMounted = true;
    setLoadState("loading");
    setError("");

    async function loadFacilities() {
      try {
        const data = await requestHealthcareFacilities(dataPath);

        if (isMounted) {
          startTransition(() => {
            setFacilities(data);
            setLoadState("ready");
            setError("");
          });
        }
      } catch (loadError) {
        if (isMounted) {
          setFacilities([]);
          setLoadState("error");
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Healthcare facility data could not be loaded."
          );
        }
      }
    }

    loadFacilities();

    return () => {
      isMounted = false;
    };
  }, [dataPath, enabled, reloadKey]);

  return {
    dataMode,
    dataPath,
    error,
    facilities,
    isDemoMode: dataMode === "demo",
    loadState,
    reload
  };
}
