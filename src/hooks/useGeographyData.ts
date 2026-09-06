import { useEffect, useState } from "react";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import { geographyLayerConfigs, getPublicDataPath } from "../geographyLayers";
import type { GeographyLevel } from "../geographyLayers";

export type GeographyData = FeatureCollection<Geometry, GeoJsonProperties>;

type GeographyDataState = {
  data: GeographyData | null;
  error: string | null;
  isLoading: boolean;
  loadedUrl: string | null;
};

type GeographyCacheEntry = {
  data?: GeographyData;
  promise?: Promise<GeographyData>;
};

const geographyDataCache = new Map<string, GeographyCacheEntry>();

const countySubdivisionMissingMessage =
  "County subdivision data is not available for this state yet.";

function isBoundaryGeometry(geometry: unknown): geometry is Geometry {
  return (
    typeof geometry === "object" &&
    geometry !== null &&
    "type" in geometry &&
    (geometry.type === "Polygon" || geometry.type === "MultiPolygon")
  );
}

function hasOnlyBoundaryFeatures(data: GeographyData) {
  // Boundary files are generated and validated by the build pipeline, so
  // spot-check the first feature instead of re-scanning every geometry on
  // the main thread (national files stall the map for hundreds of ms).
  const firstFeature = data.features[0];

  return (
    firstFeature?.type === "Feature" && isBoundaryGeometry(firstFeature.geometry)
  );
}

function isFeatureCollection(value: unknown): value is GeographyData {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "FeatureCollection" &&
    "features" in value &&
    Array.isArray(value.features)
  );
}

async function fetchGeographyData(url: string) {
  const response = await fetch(url);
  const requiredFileMessage = `Missing required file: ${getPublicDataPath(url)}`;

  if (response.status === 404) {
    throw new Error(requiredFileMessage);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  const responseText = await response.text();
  const firstCharacter = responseText.trimStart().at(0);
  const contentType = response.headers.get("content-type") ?? "";

  if (firstCharacter !== "{" && firstCharacter !== "[") {
    if (contentType.includes("text/html")) {
      throw new Error(requiredFileMessage);
    }

    throw new Error("Boundary file did not contain JSON.");
  }

  let data: unknown;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("Boundary file is not valid JSON.");
  }

  if (!isFeatureCollection(data)) {
    throw new Error("GeoJSON must be a FeatureCollection.");
  }

  if (data.features.length === 0) {
    throw new Error("Boundary file does not contain any boundary features.");
  }

  if (!hasOnlyBoundaryFeatures(data)) {
    throw new Error(
      "Boundary file must contain only Polygon or MultiPolygon legal boundary features."
    );
  }

  return data;
}

function getCachedGeographyData(url: string) {
  const cachedEntry = geographyDataCache.get(url);

  if (cachedEntry?.data) {
    return Promise.resolve(cachedEntry.data);
  }

  if (cachedEntry?.promise) {
    return cachedEntry.promise;
  }

  const promise = fetchGeographyData(url)
    .then((data) => {
      geographyDataCache.set(url, { data });
      return data;
    })
    .catch((error: unknown) => {
      geographyDataCache.delete(url);
      throw error;
    });

  geographyDataCache.set(url, { promise });
  return promise;
}

export function useGeographyData(
  level: GeographyLevel,
  dataUrlOverride?: string | null
): GeographyDataState {
  const [state, setState] = useState<GeographyDataState>({
    data: null,
    error: null,
    isLoading: false,
    loadedUrl: null
  });

  useEffect(() => {
    let isMounted = true;
    const config = geographyLayerConfigs[level];
    const dataUrl = dataUrlOverride ?? config.dataUrl;

    if (!dataUrl) {
      setState({
        data: null,
        error: null,
        isLoading: false,
        loadedUrl: null
      });
      return () => {
        isMounted = false;
      };
    }

    const requestDataUrl = dataUrl;
    const cachedData = geographyDataCache.get(requestDataUrl)?.data;

    if (cachedData) {
      setState({
        data: cachedData,
        error: null,
        isLoading: false,
        loadedUrl: requestDataUrl
      });
      return () => {
        isMounted = false;
      };
    }

    setState((currentState) => ({
      data:
        currentState.loadedUrl === requestDataUrl ? currentState.data : null,
      error: null,
      isLoading: true,
      loadedUrl:
        currentState.loadedUrl === requestDataUrl
          ? currentState.loadedUrl
          : null
    }));

    async function loadData() {
      try {
        const data = await getCachedGeographyData(requestDataUrl);

        if (!isMounted) {
          return;
        }

        setState({
          data,
          error: null,
          isLoading: false,
          loadedUrl: requestDataUrl
        });
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        const details =
          error instanceof Error && error.message.length > 0
            ? ` (${error.message})`
            : "";

        setState((currentState) => ({
          data:
            currentState.loadedUrl === requestDataUrl
              ? currentState.data
              : null,
          error:
            error instanceof Error &&
            error.message === `Missing required file: ${getPublicDataPath(requestDataUrl)}`
              ? level === "towns"
                ? countySubdivisionMissingMessage
                : error.message
              : `Could not load ${config.boundaryLabel.toLowerCase()} from ${getPublicDataPath(
                  requestDataUrl
                )}${details}.`,
          isLoading: false,
          loadedUrl:
            currentState.loadedUrl === requestDataUrl
              ? currentState.loadedUrl
              : null
        }));
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [dataUrlOverride, level]);

  return state;
}
