import { useEffect, useState } from "react";
import type { GeographyLevel } from "../geographyLayers";
import {
  getCountyDataUrl,
  getCountySubdivisionDataUrl
} from "../utils/stateFips";

export type GeographyDataManifest = {
  countiesByState: string[];
  countySubdivisionsByState: string[];
  tractCountyShardsByState: Record<string, string[]>;
  tractsByState: string[];
  states: string[];
};

type GeographyDataManifestState = {
  error: string | null;
  isLoading: boolean;
  manifest: GeographyDataManifest | null;
};

const geographyDataManifestUrl = "/data/geography-data-manifest.json";
let cachedManifest: GeographyDataManifest | null = null;
let cachedManifestPromise: Promise<GeographyDataManifest> | null = null;

function normalizeStateFips(stateFips: string | null) {
  return stateFips?.padStart(2, "0") ?? null;
}

function getManifestStateList(
  level: GeographyLevel,
  manifest: GeographyDataManifest
) {
  if (level === "counties") {
    return manifest.countiesByState;
  }

  if (level === "towns") {
    return manifest.countySubdivisionsByState;
  }

  if (level === "tracts") {
    return manifest.tractsByState;
  }

  return [];
}

async function loadGeographyDataManifest() {
  if (cachedManifest) {
    return cachedManifest;
  }

  if (cachedManifestPromise) {
    return cachedManifestPromise;
  }

  cachedManifestPromise = fetch(geographyDataManifestUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load ${geographyDataManifestUrl}`);
      }

      return response.json() as Promise<GeographyDataManifest>;
    })
    .then((manifest) => {
      cachedManifest = manifest;
      return manifest;
    })
    .catch((error: unknown) => {
      cachedManifestPromise = null;
      throw error;
    });

  return cachedManifestPromise;
}

export function isBoundaryDataAvailable(
  level: GeographyLevel,
  stateFips: string | null,
  manifest: GeographyDataManifest | null
) {
  if (level === "states") {
    return Boolean(manifest?.states.includes("/data/us-states.geojson"));
  }

  const normalizedStateFips = normalizeStateFips(stateFips);

  if (!manifest || !normalizedStateFips) {
    return false;
  }

  return getManifestStateList(level, manifest).includes(normalizedStateFips);
}

export function getAvailableBoundaryDataUrl(
  level: GeographyLevel,
  stateFips: string | null,
  manifest: GeographyDataManifest | null
) {
  if (level === "states") {
    return "/data/us-states.geojson";
  }

  if (!isBoundaryDataAvailable(level, stateFips, manifest)) {
    return null;
  }

  if (level === "counties") {
    return getCountyDataUrl(stateFips);
  }

  return level === "towns" ? getCountySubdivisionDataUrl(stateFips) : null;
}

export function useGeographyDataManifest(): GeographyDataManifestState {
  const [state, setState] = useState<GeographyDataManifestState>({
    error: null,
    isLoading: !cachedManifest,
    manifest: cachedManifest
  });

  useEffect(() => {
    if (cachedManifest) {
      setState({
        error: null,
        isLoading: false,
        manifest: cachedManifest
      });
      return;
    }

    let isMounted = true;

    loadGeographyDataManifest()
      .then((manifest) => {
        if (!isMounted) {
          return;
        }

        setState({
          error: null,
          isLoading: false,
          manifest
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setState({
          error: error instanceof Error ? error.message : "Unable to load data manifest.",
          isLoading: false,
          manifest: null
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
