import fs from "node:fs/promises";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(workspaceRoot, "public");
const dataDir = path.join(publicDir, "data");
const statesPath = path.join(dataDir, "us-states.geojson");
const countiesDir = path.join(dataDir, "counties", "by-state");
const localDir = path.join(dataDir, "cousubs", "by-state");
const njTractDir = path.join(dataDir, "tracts", "nj", "by-county");
const outputPath = path.join(dataDir, "boundary-search-index.json");
const searchDir = path.join(dataDir, "geography", "search");
const statesOutputPath = path.join(searchDir, "states.json");
const stateShardsDir = path.join(searchDir, "states");
const manifestOutputPath = path.join(searchDir, "search-manifest.json");

const numericNameLsadPrefixes = {
  "21": "Borough",
  "25": "City",
  "43": "Town",
  "44": "Township",
  "47": "Village"
};
const nonLower48StateFips = new Set(["02", "15", "60", "66", "69", "72", "78"]);

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

function firstPropertyText(properties, propertyNames) {
  for (const propertyName of propertyNames) {
    const value = getPropertyText(properties, propertyName);

    if (value) {
      return value;
    }
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
      : getNumericLegalName(properties);
  }

  return name ?? namelsad;
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

function getSourceDataPath(filePath) {
  return `/${path.relative(publicDir, filePath).replaceAll(path.sep, "/")}`;
}

async function readGeoJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readGeoJsonFiles(sourceDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".geojson"))
    .map((entry) => path.join(sourceDir, entry.name))
    .sort();
}

function createIndexEntry({ feature, level, sourceDataPath }) {
  const properties = feature.properties ?? {};
  const displayName = getDisplayName(properties);
  const normalizedName = normalizeSearchText(displayName);
  const bounds = getGeometryBounds(feature.geometry);
  const geoid = firstPropertyText(properties, ["GEOID", "GEOIDFQ"]);
  const stateFips =
    firstPropertyText(properties, ["STATEFP", "STATEFP20"]) ??
    (geoid && geoid.length >= 2 ? geoid.slice(0, 2) : null);
  const countyFips =
    firstPropertyText(properties, ["COUNTYFP", "COUNTYFP20"]) ??
    (level !== "state" && geoid && geoid.length >= 5 ? geoid.slice(2, 5) : null);

  if (!displayName || !normalizedName || !bounds || !stateFips) {
    return null;
  }

  if (level === "state" && nonLower48StateFips.has(stateFips.padStart(2, "0"))) {
    return null;
  }

  if (isNumericOnlyName(displayName)) {
    return null;
  }

  return {
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
    countyFips: countyFips ? countyFips.padStart(3, "0") : null,
    countyName:
      level === "local" || level === "tract"
        ? getPropertyText(properties, "NAMELSADCO")
        : level === "county"
          ? getPropertyText(properties, "NAMELSAD") ?? displayName
          : null,
    displayName,
    fullLegalName: getPropertyText(properties, "NAMELSAD"),
    geoid,
    id: `${level}:${geoid ?? sourceDataPath}:${displayName}`,
    level,
    normalizedName,
    sourceDataPath,
    stateAbbr: getPropertyText(properties, "STUSPS"),
    stateFips: stateFips.padStart(2, "0"),
    stateName:
      getPropertyText(properties, "STATE_NAME") ??
      (level === "state" ? displayName : null)
  };
}

async function addFeatures(index, filePath, level) {
  const geoJson = await readGeoJson(filePath);
  const sourceDataPath = getSourceDataPath(filePath);

  for (const feature of geoJson.features ?? []) {
    const entry = createIndexEntry({ feature, level, sourceDataPath });

    if (entry) {
      index.push(entry);
    }
  }
}

async function main() {
  const index = [];

  await addFeatures(index, statesPath, "state");

  for (const filePath of await readGeoJsonFiles(countiesDir)) {
    await addFeatures(index, filePath, "county");
  }

  for (const filePath of await readGeoJsonFiles(localDir)) {
    await addFeatures(index, filePath, "local");
  }

  for (const filePath of await readGeoJsonFiles(njTractDir)) {
    await addFeatures(index, filePath, "tract");
  }

  index.sort(
    (first, second) =>
      first.level.localeCompare(second.level) ||
      first.stateFips.localeCompare(second.stateFips) ||
      (first.countyFips ?? "").localeCompare(second.countyFips ?? "") ||
      first.normalizedName.localeCompare(second.normalizedName) ||
      first.id.localeCompare(second.id)
  );

  const stateIndex = index.filter((entry) => entry.level === "state");
  const stateShards = new Map();

  for (const entry of index) {
    if (entry.level === "state") {
      continue;
    }

    const shard = stateShards.get(entry.stateFips) ?? [];
    shard.push(entry);
    stateShards.set(entry.stateFips, shard);
  }

  await fs.mkdir(stateShardsDir, { recursive: true });
  const expectedShardNames = new Set();
  const manifestStates = [];

  for (const stateEntry of stateIndex) {
    const shardEntries = stateShards.get(stateEntry.stateFips) ?? [];
    const shardFileName = `${stateEntry.stateFips}.json`;
    const shardPath = path.join(stateShardsDir, shardFileName);
    const shardJson = `${JSON.stringify(shardEntries)}\n`;
    expectedShardNames.add(shardFileName);
    await fs.writeFile(shardPath, shardJson, "utf8");
    manifestStates.push({
      boundaryCount: shardEntries.length,
      byteLength: Buffer.byteLength(shardJson),
      stateAbbr: stateEntry.stateAbbr,
      stateFips: stateEntry.stateFips,
      stateName: stateEntry.stateName ?? stateEntry.displayName,
      url: `/data/geography/search/states/${shardFileName}`
    });
  }

  for (const entry of await fs.readdir(stateShardsDir, { withFileTypes: true })) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".json") &&
      !expectedShardNames.has(entry.name)
    ) {
      await fs.unlink(path.join(stateShardsDir, entry.name));
    }
  }

  const statesJson = `${JSON.stringify(stateIndex)}\n`;
  const manifest = {
    schemaVersion: 1,
    generatedFrom: [
      "/data/us-states.geojson",
      "/data/counties/by-state/*.geojson",
      "/data/cousubs/by-state/*.geojson",
      "/data/tracts/nj/by-county/*.geojson"
    ],
    statesUrl: "/data/geography/search/states.json",
    stateCount: stateIndex.length,
    boundaryCount: index.length,
    stateBoundaryCount: stateIndex.length,
    shardedBoundaryCount: index.length - stateIndex.length,
    states: manifestStates
  };

  await fs.mkdir(searchDir, { recursive: true });
  await fs.writeFile(statesOutputPath, statesJson, "utf8");
  await fs.writeFile(
    manifestOutputPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(outputPath, `${JSON.stringify(index)}\n`, "utf8");
  console.log(
    `Wrote ${path.relative(workspaceRoot, outputPath)} and ${stateIndex.length} state search shards with ${index.length} boundaries.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
