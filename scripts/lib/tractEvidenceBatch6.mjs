import fs from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const NJ_TRACT_ROOT = path.join(PROJECT_ROOT, "public", "data", "tracts", "nj");
const TRACT_FOUNDATION_PATH = path.join(NJ_TRACT_ROOT, "tract-foundation.json");
const CHECKED_DATE = "2026-07-12";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function getTractGeographies(tractArtifact) {
  const records = Array.isArray(tractArtifact.records) ? tractArtifact.records : [];
  const geographies = records.map(({ geography }) => ({
    type: "census_tract",
    geoid: String(geography?.geoid ?? ""),
    stateFips: String(geography?.stateFips ?? "").padStart(2, "0"),
    countyFips: String(geography?.countyFips ?? "").padStart(3, "0"),
    tractCode: String(geography?.tractCode ?? "").padStart(6, "0")
  })).sort((first, second) => first.geoid.localeCompare(second.geoid));
  const seen = new Set();

  for (const geography of geographies) {
    assert(/^34\d{9}$/.test(geography.geoid), `Invalid New Jersey tract GEOID ${geography.geoid}.`);
    assert(
      geography.geoid === `${geography.stateFips}${geography.countyFips}${geography.tractCode}`,
      `Tract fields do not compose GEOID ${geography.geoid}.`
    );
    assert(!seen.has(geography.geoid), `Duplicate tract GEOID ${geography.geoid}.`);
    seen.add(geography.geoid);
  }
  assert(geographies.length > 0, "No New Jersey tract geographies were loaded.");
  return geographies;
}

function buildObservation({ geography, measure, source, value, estimateType, sourceRecordId, transformation, missingReason = null }) {
  const isMissing = value === null;
  return {
    schemaVersion: "1.0.0",
    geography,
    measure: { id: measure.id, label: measure.label, evidenceLayer: measure.evidenceLayer },
    source,
    value,
    unit: measure.unit,
    estimateType: isMissing ? "unavailable" : estimateType,
    missingness: { isMissing, reason: isMissing ? missingReason : null },
    provenance: { sourceRecordId, transformation, checkedDate: CHECKED_DATE }
  };
}

function summarizeCoverage({ geographies, measures, observations }) {
  const loadedEstimateCount = observations.filter(({ value }) => value !== null).length;
  const missingEstimateCount = observations.length - loadedEstimateCount;
  const observationCountsByCounty = Object.fromEntries(
    [...new Set(geographies.map(({ countyFips }) => countyFips))].sort().map((countyFips) => [
      countyFips,
      observations.filter(({ geography }) => geography.countyFips === countyFips).length
    ])
  );
  const measureCoverage = Object.fromEntries(measures.map(({ id }) => {
    const rows = observations.filter(({ measure }) => measure.id === id);
    return [id, {
      loadedEstimateCount: rows.filter(({ value }) => value !== null).length,
      missingEstimateCount: rows.filter(({ value }) => value === null).length
    }];
  }));
  return {
    tractCount: geographies.length,
    selectedMeasureCount: measures.length,
    countyShardCount: Object.keys(observationCountsByCounty).length,
    observationCountsByCounty,
    expectedObservationCount: geographies.length * measures.length,
    loadedEstimateCount,
    missingEstimateCount,
    measureCoverage
  };
}

async function writeCountyShards({ observations, outputRoot, sourceSlug }) {
  const countyRoot = path.join(outputRoot, "evidence", sourceSlug, "by-county");
  await fs.rm(countyRoot, { recursive: true, force: true });
  const countyFipsValues = [...new Set(observations.map(({ geography }) => geography.countyFips))].sort();
  await Promise.all(countyFipsValues.map((countyFips) =>
    writeJson(
      path.join(countyRoot, `${countyFips}.json`),
      observations.filter(({ geography }) => geography.countyFips === countyFips)
    )
  ));
}

export {
  CHECKED_DATE,
  NJ_TRACT_ROOT,
  PROJECT_ROOT,
  TRACT_FOUNDATION_PATH,
  assert,
  buildObservation,
  getArgument,
  getTractGeographies,
  readJson,
  summarizeCoverage,
  writeCountyShards,
  writeJson
};
