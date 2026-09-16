import fs from "node:fs/promises";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(workspaceRoot, "public");
const distDir = path.join(workspaceRoot, "dist");
const searchDir = path.join(publicDir, "data", "geography", "search");
const manifestPath = path.join(searchDir, "search-manifest.json");
const statesPath = path.join(searchDir, "states.json");
const legacyIndexPath = path.join(publicDir, "data", "boundary-search-index.json");
const legacyDistPaths = [
  path.join(distDir, "data", "boundary-search-index.json"),
  path.join(distDir, "data", "local-jurisdiction-search-index.json")
];

function fail(message) {
  throw new Error(`Map search performance check failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function isSearchTarget(entry) {
  return (
    entry &&
    typeof entry.displayName === "string" &&
    typeof entry.id === "string" &&
    typeof entry.level === "string" &&
    typeof entry.normalizedName === "string" &&
    typeof entry.sourceDataPath === "string" &&
    typeof entry.stateFips === "string" &&
    Array.isArray(entry.bbox) &&
    entry.bbox.length === 4 &&
    Array.isArray(entry.center) &&
    entry.center.length === 2 &&
    !("geometry" in entry)
  );
}

const mapSearchSource = await fs.readFile(
  path.join(workspaceRoot, "src", "components", "MapSearchBar.tsx"),
  "utf8"
);
const publicMapSource = await fs.readFile(
  path.join(workspaceRoot, "src", "components", "CareAtlasMap.tsx"),
  "utf8"
);
const mapPageSource = await fs.readFile(
  path.join(workspaceRoot, "src", "pages", "MapPage.tsx"),
  "utf8"
);
const boundaryAutocompleteSource = await fs.readFile(
  path.join(workspaceRoot, "src", "components", "map", "BoundaryAutocomplete.tsx"),
  "utf8"
);
assert(
  !publicMapSource.includes("BoundarySearchController") &&
    !mapPageSource.includes("MapSearchBar"),
  "The retired national search runtime must stay disconnected from the New Jersey map."
);
assert(
  publicMapSource.includes("BoundaryAutocomplete") &&
    publicMapSource.includes("countyData={counties.data}") &&
    publicMapSource.includes("townData={displayTowns}") &&
    publicMapSource.includes("clipGeographyToCountyBoundaries(towns.data, counties.data)"),
  "The public map must search its already-loaded, county-clipped New Jersey boundary shards."
);
assert(
  !boundaryAutocompleteSource.includes("/data/") &&
    boundaryAutocompleteSource.includes("maximumSuggestions = 16") &&
    boundaryAutocompleteSource.includes("rankPlaceMatch") &&
    (await fs.readFile(path.join(workspaceRoot, "src", "utils", "placeSearch.ts"), "utf8")).includes("name.startsWith(query)"),
  "New Jersey autocomplete must remain local, bounded, and prefix-ranked."
);
assert(
  !mapSearchSource.includes("/data/boundary-search-index.json"),
  "MapSearchBar still references the monolithic boundary search index."
);
assert(
  mapSearchSource.includes("/data/geography/search/search-manifest.json"),
  "MapSearchBar does not load the lightweight search manifest."
);
assert(
  mapSearchSource.includes("normalizedQuery.length >= minimumQueryLength"),
  "state shard loading is not guarded by clear search intent."
);

const manifest = await readJson(manifestPath);
const stateEntries = await readJson(statesPath);
assert(manifest.schemaVersion === 1, "unexpected search manifest schema.");
assert(Array.isArray(manifest.states), "manifest states must be an array.");
assert(Array.isArray(stateEntries), "states.json must be an array.");
assert(
  manifest.stateCount === stateEntries.length && manifest.states.length === stateEntries.length,
  "manifest and state index counts do not match."
);
assert(stateEntries.every(isSearchTarget), "states.json contains an invalid search target.");
assert(
  stateEntries.every((entry) => entry.level === "state"),
  "states.json must contain only state search targets."
);

let shardedBoundaryCount = 0;
let shardBytes = 0;
const shardEntriesByState = new Map();

for (const state of manifest.states) {
  assert(/^\d{2}$/.test(state.stateFips), `invalid state FIPS ${state.stateFips}.`);
  assert(
    state.url === `/data/geography/search/states/${state.stateFips}.json`,
    `unexpected shard URL for state ${state.stateFips}.`
  );
  const shardPath = path.join(publicDir, state.url.replace(/^\//, ""));
  const shardText = await fs.readFile(shardPath, "utf8");
  const shardEntries = JSON.parse(shardText);
  assert(Array.isArray(shardEntries), `${state.url} must contain an array.`);
  assert(
    shardEntries.length === state.boundaryCount,
    `${state.url} count does not match the manifest.`
  );
  assert(
    Buffer.byteLength(shardText) === state.byteLength,
    `${state.url} byte length does not match the manifest.`
  );
  assert(
    shardEntries.every(
      (entry) =>
        isSearchTarget(entry) &&
        entry.stateFips === state.stateFips &&
        (entry.level === "county" ||
          entry.level === "local" ||
          entry.level === "tract")
    ),
    `${state.url} contains an invalid or cross-state search target.`
  );
  shardEntriesByState.set(state.stateFips, shardEntries);
  shardedBoundaryCount += shardEntries.length;
  shardBytes += Buffer.byteLength(shardText);
}

assert(
  stateEntries.length + shardedBoundaryCount === manifest.boundaryCount,
  "generated shard totals do not match the manifest boundary count."
);

const coverageSummary = await readJson(
  path.join(publicDir, "data", "healthcare", "coverage-summary.json")
);
const coveredState = coverageSummary.loadedStates?.[0];
assert(coveredState, "healthcare coverage summary has no covered state to verify.");
const coveredStateTarget = stateEntries.find(
  (entry) => entry.stateFips === coveredState.stateFips
);
const coveredStateShard = shardEntriesByState.get(coveredState.stateFips);
assert(coveredStateTarget, `covered state ${coveredState.stateFips} is not searchable.`);
assert(
  coveredStateShard?.some((entry) => entry.level === "county") &&
    coveredStateShard.some((entry) => entry.level === "local"),
  `covered state ${coveredState.stateFips} does not have county and local search targets.`
);
const newJerseyShard = shardEntriesByState.get("34");
assert(
  newJerseyShard?.filter((entry) => entry.level === "tract").length === 2181,
  "New Jersey search shard must contain all 2,181 pinned 2024 census tracts."
);
assert(
  ![...shardEntriesByState.entries()].some(
    ([stateFips, entries]) =>
      stateFips !== "34" && entries.some((entry) => entry.level === "tract")
  ),
  "Batch 4 must not expand tract search outside New Jersey."
);

const initialBytes =
  (await fs.stat(manifestPath)).size + (await fs.stat(statesPath)).size;
const legacyBytes = (await fs.stat(legacyIndexPath)).size;
assert(
  initialBytes < legacyBytes * 0.05,
  "initial manifest and state index are not at least 95% smaller than the legacy index."
);

if (await fileExists(distDir)) {
  for (const legacyDistPath of legacyDistPaths) {
    assert(
      !(await fileExists(legacyDistPath)),
      `${path.relative(workspaceRoot, legacyDistPath)} must not be deployed.`
    );
  }
}

const reductionPercent = (100 * (1 - initialBytes / legacyBytes)).toFixed(2);
console.log(
  `Search performance check passed: public autocomplete reuses the two loaded New Jersey boundary shards; ${manifest.stateCount} retained national shards cover ${manifest.boundaryCount} boundaries without joining the public runtime.`
);
console.log(
  `Initial search data is ${initialBytes.toLocaleString()} bytes versus ${legacyBytes.toLocaleString()} bytes (${reductionPercent}% smaller); state shards total ${shardBytes.toLocaleString()} bytes and load only after intent.`
);
