import { readFile } from "node:fs/promises";
import path from "node:path";

const boundsCache = new Map();

function visitCoordinates(value, bounds) {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    const [longitude, latitude] = value;
    bounds.minLatitude = Math.min(bounds.minLatitude, latitude);
    bounds.maxLatitude = Math.max(bounds.maxLatitude, latitude);
    bounds.minLongitude = Math.min(bounds.minLongitude, longitude);
    bounds.maxLongitude = Math.max(bounds.maxLongitude, longitude);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child) => visitCoordinates(child, bounds));
  }
}

export function normalizeStateCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

export async function loadStateBounds(projectRoot, state) {
  const stateCode = normalizeStateCode(state);
  const geoJsonPath = path.join(projectRoot, "public", "data", "us-states.geojson");

  if (!boundsCache.has(geoJsonPath)) {
    boundsCache.set(
      geoJsonPath,
      readFile(geoJsonPath, "utf8").then((raw) => {
        const geoJson = JSON.parse(raw);
        const byState = new Map();

        for (const feature of geoJson.features ?? []) {
          const code = normalizeStateCode(feature?.properties?.STUSPS);
          if (!code || !feature?.geometry?.coordinates) continue;

          const bounds = {
            minLatitude: Number.POSITIVE_INFINITY,
            maxLatitude: Number.NEGATIVE_INFINITY,
            minLongitude: Number.POSITIVE_INFINITY,
            maxLongitude: Number.NEGATIVE_INFINITY
          };
          visitCoordinates(feature.geometry.coordinates, bounds);

          if (Object.values(bounds).every(Number.isFinite)) {
            byState.set(code, {
              ...bounds,
              name: feature.properties.NAME ?? code,
              stateCode: code,
              sourceFile: "public/data/us-states.geojson"
            });
          }
        }

        return byState;
      })
    );
  }

  const bounds = (await boundsCache.get(geoJsonPath)).get(stateCode);
  if (!bounds) {
    throw new Error(
      `State "${state}" is not present in public/data/us-states.geojson. Use a two-letter state abbreviation such as NJ, PA or NY.`
    );
  }

  return bounds;
}

export function isWithinStateBounds(latitude, longitude, bounds) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= bounds.minLatitude &&
    latitude <= bounds.maxLatitude &&
    longitude >= bounds.minLongitude &&
    longitude <= bounds.maxLongitude
  );
}
