import fs from "node:fs/promises";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(workspaceRoot, "public", "data", "cousubs", "by-state");
const outputPath = path.join(
  workspaceRoot,
  "public",
  "data",
  "local-jurisdiction-search-index.json"
);

const numericNameLsadPrefixes = {
  "21": "Borough",
  "25": "City",
  "43": "Town",
  "44": "Township",
  "47": "Village"
};

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPropertyText(properties, propertyName) {
  const value = properties?.[propertyName];

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function isNumericOnlyName(value) {
  return /^\d+$/.test(value.trim());
}

function getNumericLegalName(properties) {
  const numericName = getPropertyText(properties, "NAME");

  if (!numericName || !isNumericOnlyName(numericName)) {
    return null;
  }

  const lsadCode = getPropertyText(properties, "LSAD");
  const legalPrefix = lsadCode ? numericNameLsadPrefixes[lsadCode] : null;

  return legalPrefix ? `${legalPrefix} ${numericName}` : null;
}

function getDisplayName(properties) {
  const name = getPropertyText(properties, "NAME");
  const namelsad = getPropertyText(properties, "NAMELSAD");

  if (name && isNumericOnlyName(name)) {
    return namelsad && !isNumericOnlyName(namelsad)
      ? namelsad
      : getNumericLegalName(properties) ?? name;
  }

  return name ?? namelsad ?? getPropertyText(properties, "GEOID") ?? null;
}

function visitCoordinates(coordinates, visitor) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    visitor(coordinates[0], coordinates[1]);
    return;
  }

  for (const child of coordinates) {
    visitCoordinates(child, visitor);
  }
}

function getGeometryBounds(geometry) {
  if (
    !geometry ||
    (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
  ) {
    return null;
  }

  const bounds = {
    maxLatitude: Number.NEGATIVE_INFINITY,
    maxLongitude: Number.NEGATIVE_INFINITY,
    minLatitude: Number.POSITIVE_INFINITY,
    minLongitude: Number.POSITIVE_INFINITY
  };
  let coordinateCount = 0;

  visitCoordinates(geometry.coordinates, (longitude, latitude) => {
    coordinateCount += 1;
    bounds.maxLatitude = Math.max(bounds.maxLatitude, latitude);
    bounds.maxLongitude = Math.max(bounds.maxLongitude, longitude);
    bounds.minLatitude = Math.min(bounds.minLatitude, latitude);
    bounds.minLongitude = Math.min(bounds.minLongitude, longitude);
  });

  if (coordinateCount === 0) {
    return null;
  }

  return bounds;
}

async function readCountySubdivisionFiles() {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".geojson"))
    .map((entry) => path.join(sourceDir, entry.name))
    .sort();
}

async function main() {
  const files = await readCountySubdivisionFiles();
  const index = [];

  for (const filePath of files) {
    const sourcePath = path
      .relative(path.join(workspaceRoot, "public"), filePath)
      .replaceAll(path.sep, "/");
    const geoJson = JSON.parse(await fs.readFile(filePath, "utf8"));

    for (const feature of geoJson.features ?? []) {
      const properties = feature.properties ?? {};
      const displayName = getDisplayName(properties);
      const geoid =
        getPropertyText(properties, "GEOID") ??
        getPropertyText(properties, "GEOIDFQ") ??
        getPropertyText(properties, "COUSUBNS");
      const stateFips =
        getPropertyText(properties, "STATEFP") ??
        (geoid && geoid.length >= 2 ? geoid.slice(0, 2) : null);
      const bounds = getGeometryBounds(feature.geometry);

      if (!displayName || !geoid || !stateFips || !bounds) {
        continue;
      }

      index.push({
        bbox: [
          bounds.minLongitude,
          bounds.minLatitude,
          bounds.maxLongitude,
          bounds.maxLatitude
        ],
        center: [
          (bounds.minLongitude + bounds.maxLongitude) / 2,
          (bounds.minLatitude + bounds.maxLatitude) / 2
        ],
        countyName: getPropertyText(properties, "NAMELSADCO"),
        displayName,
        fullLegalName: getPropertyText(properties, "NAMELSAD"),
        geoid,
        normalizedName: normalizeSearchText(displayName),
        sourcePath: `/${sourcePath}`,
        stateAbbreviation: getPropertyText(properties, "STUSPS"),
        stateFips: stateFips.padStart(2, "0"),
        stateName: getPropertyText(properties, "STATE_NAME")
      });
    }
  }

  index.sort((first, second) =>
    first.normalizedName.localeCompare(second.normalizedName) ||
    first.stateFips.localeCompare(second.stateFips) ||
    first.geoid.localeCompare(second.geoid)
  );

  await fs.writeFile(outputPath, `${JSON.stringify(index)}\n`, "utf8");
  console.log(
    `Wrote ${path.relative(workspaceRoot, outputPath)} with ${index.length} local jurisdictions.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
