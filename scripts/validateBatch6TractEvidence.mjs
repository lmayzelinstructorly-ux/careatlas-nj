import fs from "node:fs/promises";
import path from "node:path";
import {
  CDC_SVI_DATASET_NAME,
  CDC_SVI_RELEASE_YEAR,
  CENSUS_ACS_DATASET_NAME,
  CENSUS_ACS_RELEASE_YEAR,
  HRSA_DATASET_NAME,
  cdcSviMeasures,
  censusAcsMeasures,
  hrsaSources
} from "./lib/batch6SourceConfig.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const tractRoot = path.join(projectRoot, "public", "data", "tracts", "nj");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function getFoundationGeoids(artifact) {
  const geoids = artifact.records.map(({ geography }) => geography.geoid);
  assert(geoids.length === 2181, `Expected 2,181 foundation tracts, found ${geoids.length}.`);
  assert(new Set(geoids).size === geoids.length, "Foundation tract GEOIDs are not unique.");
  assert(geoids.every((geoid) => /^34\d{9}$/.test(geoid)), "Foundation contains an invalid New Jersey tract GEOID.");
  return new Set(geoids);
}

async function readSourceArtifact(sourceSlug, summaryFile) {
  const countyRoot = path.join(tractRoot, "evidence", sourceSlug, "by-county");
  const countyFiles = (await fs.readdir(countyRoot)).filter((file) => /^\d{3}\.json$/.test(file)).sort();
  assert(countyFiles.length === 21, `${sourceSlug} must contain 21 county shards.`);
  const countyArrays = await Promise.all(countyFiles.map((file) => readJson(path.join(countyRoot, file))));
  for (const [index, observations] of countyArrays.entries()) {
    const countyFips = countyFiles[index].slice(0, 3);
    assert(observations.every(({ geography }) => geography.countyFips === countyFips),
      `${sourceSlug}/${countyFiles[index]} contains another county.`);
  }
  return {
    observations: countyArrays.flat(),
    coverage: await readJson(path.join(tractRoot, summaryFile)),
    countyFiles
  };
}

function validateCommon({ sourceSlug, observations, coverage, countyFiles, knownGeoids, measures }) {
  const measureById = new Map(measures.map((measure) => [measure.id, measure]));
  const seenPairs = new Set();
  assert(observations.length === knownGeoids.size * measures.length,
    `${sourceSlug} observation count is not tract count × measure count.`);

  for (const observation of observations) {
    const geoid = observation.geography?.geoid;
    const measure = measureById.get(observation.measure?.id);
    assert(observation.schemaVersion === "1.0.0", `${sourceSlug}/${geoid} has the wrong schema version.`);
    assert(knownGeoids.has(geoid), `${sourceSlug} references unknown tract ${geoid}.`);
    assert(observation.geography?.type === "census_tract", `${sourceSlug}/${geoid} has the wrong geography type.`);
    assert(geoid === `${observation.geography.stateFips}${observation.geography.countyFips}${observation.geography.tractCode}`,
      `${sourceSlug}/${geoid} geography fields do not compose its GEOID.`);
    assert(measure, `${sourceSlug}/${geoid} uses unapproved measure ${observation.measure?.id}.`);
    assert(observation.measure.evidenceLayer === measure.evidenceLayer, `${sourceSlug}/${geoid} has the wrong evidence layer.`);
    assert(observation.unit === measure.unit, `${sourceSlug}/${geoid}/${measure.id} has the wrong unit.`);
    assert(observation.missingness?.isMissing === (observation.value === null), `${sourceSlug}/${geoid}/${measure.id} has inconsistent missingness.`);
    assert(typeof observation.provenance?.sourceRecordId === "string", `${sourceSlug}/${geoid}/${measure.id} lacks row provenance.`);
    assert(observation.provenance?.checkedDate === "2026-07-12", `${sourceSlug}/${geoid}/${measure.id} has the wrong checked date.`);
    assert(typeof observation.provenance?.transformation === "string" && observation.provenance.transformation.length > 0,
      `${sourceSlug}/${geoid}/${measure.id} lacks a transformation note.`);
    assert(!("score" in observation) && !("classification" in observation), `${sourceSlug}/${geoid}/${measure.id} must not classify tracts.`);
    const pair = `${geoid}:${measure.id}`;
    assert(!seenPairs.has(pair), `${sourceSlug} has duplicate tract/measure pair ${pair}.`);
    seenPairs.add(pair);
  }

  const loaded = observations.filter(({ value }) => value !== null).length;
  assert(coverage.tractCount === knownGeoids.size, `${sourceSlug} coverage tract count is wrong.`);
  assert(coverage.selectedMeasureCount === measures.length, `${sourceSlug} coverage measure count is wrong.`);
  assert(coverage.countyShardCount === countyFiles.length, `${sourceSlug} coverage shard count is wrong.`);
  assert(coverage.expectedObservationCount === observations.length, `${sourceSlug} coverage observation count is wrong.`);
  assert(coverage.loadedEstimateCount === loaded, `${sourceSlug} loaded count is wrong.`);
  assert(coverage.missingEstimateCount === observations.length - loaded, `${sourceSlug} missing count is wrong.`);
  assert(coverage.classificationStatus === "not_evaluated", `${sourceSlug} must remain not_evaluated.`);
}

function validateSvi(artifact) {
  for (const observation of artifact.observations) {
    assert(observation.source.dataset === CDC_SVI_DATASET_NAME && observation.source.releaseYear === CDC_SVI_RELEASE_YEAR,
      `${observation.geography.geoid}/${observation.measure.id} has wrong SVI source metadata.`);
    if (observation.value === null) {
      assert(observation.estimateType === "unavailable" && observation.missingness.reason,
        `${observation.geography.geoid}/${observation.measure.id} must explain unavailable SVI data.`);
    } else {
      assert(Number.isFinite(observation.value) && observation.value >= 0 && observation.value <= 1,
        `${observation.geography.geoid}/${observation.measure.id} SVI rank is outside 0-1.`);
      assert(observation.estimateType === "derived", `${observation.measure.id} must be derived.`);
    }
  }
}

function validateAcs(artifact) {
  const byId = new Map(censusAcsMeasures.map((measure) => [measure.id, measure]));
  for (const observation of artifact.observations) {
    const measure = byId.get(observation.measure.id);
    assert(observation.source.dataset === CENSUS_ACS_DATASET_NAME && observation.source.releaseYear === CENSUS_ACS_RELEASE_YEAR,
      `${observation.geography.geoid}/${measure.id} has wrong ACS source metadata.`);
    if (observation.value === null) {
      assert(observation.estimateType === "unavailable" && observation.missingness.reason,
        `${observation.geography.geoid}/${measure.id} must explain unavailable ACS data.`);
    } else {
      assert(Number.isFinite(observation.value) && observation.value >= 0 && observation.value <= 100,
        `${observation.geography.geoid}/${measure.id} ACS percent is outside 0-100.`);
      assert(observation.estimateType === "derived", `${measure.id} has the wrong estimate type.`);
    }
  }
}

function validateHrsa(artifact) {
  const keyByMeasureId = new Map(hrsaSources.map(({ id, key }) => [id, key]));
  const referencedIds = new Map(hrsaSources.map(({ key }) => [key, new Set()]));
  for (const observation of artifact.observations) {
    const key = keyByMeasureId.get(observation.measure.id);
    assert(observation.source.dataset === HRSA_DATASET_NAME && observation.source.releaseYear === 2026,
      `${observation.geography.geoid}/${observation.measure.id} has wrong HRSA source metadata.`);
    assert(Number.isInteger(observation.value) && observation.value >= 0,
      `${observation.geography.geoid}/${observation.measure.id} designation count is invalid.`);
    assert(observation.estimateType === "designation" && !observation.missingness.isMissing,
      `${observation.geography.geoid}/${observation.measure.id} must be a reviewed designation count.`);
    const prefix = `hrsa:${key}:${observation.geography.geoid}:`;
    assert(observation.provenance.sourceRecordId.startsWith(prefix), `${observation.measure.id} has invalid HRSA provenance.`);
    const suffix = observation.provenance.sourceRecordId.slice(prefix.length);
    const ids = suffix === "none" ? [] : suffix.split("|");
    assert(ids.length === observation.value, `${observation.measure.id} count does not match provenance IDs.`);
    for (const id of ids) {
      assert(artifact.coverage.designationCatalog?.[key]?.[id], `${observation.measure.id} references uncatalogued designation ${id}.`);
      referencedIds.get(key).add(id);
    }
  }
  for (const { key } of hrsaSources) {
    const catalogIds = Object.keys(artifact.coverage.designationCatalog?.[key] ?? {});
    const sourceCoverage = artifact.coverage.sourceCoverage?.[key];
    assert(catalogIds.length === artifact.coverage.sourceCoverage?.[key]?.activeNewJerseyDesignationCount,
      `${key} catalog count does not match coverage.`);
    assert(sourceCoverage.activeNewJerseyComponentCount > 0, `${key} has no active New Jersey components.`);
    assert(sourceCoverage.activeNewJerseyComponentCount > sourceCoverage.unmatchedActiveComponentCount,
      `${key} did not assign any active components to the current foundation.`);
    assert(sourceCoverage.unmatchedActiveComponentCount === sourceCoverage.unmatchedActiveComponentKeys.length,
      `${key} unmatched component detail does not match its count.`);
  }
}

const foundation = await readJson(path.join(tractRoot, "tract-foundation.json"));
const knownGeoids = getFoundationGeoids(foundation);
const sources = [
  ["cdc-svi", "cdc-svi-coverage-summary.json", cdcSviMeasures, validateSvi],
  ["census-acs", "census-acs-coverage-summary.json", censusAcsMeasures, validateAcs],
  ["hrsa-shortage", "hrsa-shortage-coverage-summary.json", hrsaSources, validateHrsa]
];

for (const [sourceSlug, summaryFile, measures, validateSource] of sources) {
  const artifact = await readSourceArtifact(sourceSlug, summaryFile);
  validateCommon({ sourceSlug, ...artifact, knownGeoids, measures });
  validateSource(artifact);
  console.log(`${sourceSlug} production validation passed for ${artifact.observations.length} observations.`);
}

const combined = await readJson(path.join(tractRoot, "batch-6-coverage-summary.json"));
assert(combined.batch === 6 && combined.tractCount === knownGeoids.size, "Combined Batch 6 coverage has the wrong scope.");
assert(combined.totalSelectedMeasureCount === 13, "Combined Batch 6 coverage must report 13 reviewed measures.");
assert(combined.totalExpectedObservationCount === knownGeoids.size * 13,
  "Combined Batch 6 observation count is wrong.");
assert(combined.classificationStatus === "not_evaluated", "Combined Batch 6 coverage must not classify tracts.");
assert(Object.keys(combined.sourceCoverage ?? {}).sort().join(",") === "cdc_svi,census_acs,hrsa_shortage",
  "Combined Batch 6 coverage must name all three independent sources.");
console.log("Combined Batch 6 coverage validation passed.");
