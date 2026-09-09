import fs from "node:fs/promises";
import path from "node:path";
import {
  CDC_PLACES_CHECKED_DATE,
  CDC_PLACES_DATASET_ID,
  CDC_PLACES_DATASET_NAME,
  CDC_PLACES_RELEASE_YEAR,
  selectedCdcPlacesMeasures
} from "./lib/cdcPlacesConfig.mjs";
import { getTractGeographies } from "./importCdcPlacesTractEvidence.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const tractRoot = path.join(projectRoot, "public", "data", "tracts", "nj");

function getArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function validateObservation(observation, knownGeoids, knownMeasureById) {
  const geoid = observation.geography?.geoid;
  const measureId = observation.measure?.id;
  assert(observation.schemaVersion === "1.0.0", `${geoid}/${measureId} has an invalid schema version.`);
  assert(observation.geography?.type === "census_tract", `${geoid}/${measureId} has an invalid geography type.`);
  assert(/^34\d{9}$/.test(geoid), `${geoid}/${measureId} has an invalid New Jersey tract GEOID.`);
  assert(knownGeoids.has(geoid), `${geoid}/${measureId} references an unknown tract.`);
  assert(
    geoid ===
      `${observation.geography.stateFips}${observation.geography.countyFips}${observation.geography.tractCode}`,
    `${geoid}/${measureId} geography fields do not compose its GEOID.`
  );
  const measure = knownMeasureById.get(measureId);
  assert(measure, `${geoid}/${measureId} uses an unapproved measure.`);
  assert(
    observation.measure.evidenceLayer === measure.evidenceLayer,
    `${geoid}/${measureId} is assigned to the wrong evidence layer.`
  );
  assert(
    observation.source?.dataset === CDC_PLACES_DATASET_NAME &&
      observation.source?.releaseYear === CDC_PLACES_RELEASE_YEAR,
    `${geoid}/${measureId} has incorrect source release metadata.`
  );
  assert(observation.unit === "percent", `${geoid}/${measureId} has an invalid unit.`);
  assert(
    observation.missingness?.isMissing === (observation.value === null),
    `${geoid}/${measureId} has inconsistent missingness.`
  );
  assert(
    observation.missingness.isMissing === (observation.estimateType === "unavailable"),
    `${geoid}/${measureId} has inconsistent estimate type.`
  );

  if (observation.value !== null) {
    assert(
      Number.isFinite(observation.value) && observation.value >= 0 && observation.value <= 100,
      `${geoid}/${measureId} is outside the 0-100 percent range.`
    );
    assert(observation.estimateType === "modeled", `${geoid}/${measureId} must be labeled modeled.`);
  } else {
    assert(
      typeof observation.missingness.reason === "string" &&
        observation.missingness.reason.length > 0,
      `${geoid}/${measureId} must explain missingness.`
    );
  }

  assert(
    observation.provenance?.sourceRecordId.startsWith(`${CDC_PLACES_DATASET_ID}:`),
    `${geoid}/${measureId} has invalid row-level provenance.`
  );
  assert(
    observation.provenance?.checkedDate === CDC_PLACES_CHECKED_DATE,
    `${geoid}/${measureId} has an unexpected checked date.`
  );
  assert(
    typeof observation.provenance?.transformation === "string" &&
      observation.provenance.transformation.length > 0,
    `${geoid}/${measureId} does not document its transformation.`
  );
  assert(!("score" in observation), `${geoid}/${measureId} must not publish a score.`);
  assert(!("classification" in observation), `${geoid}/${measureId} must not publish a classification.`);
}

async function main() {
  const tractFile = path.resolve(
    projectRoot,
    getArgument("tract-file") ?? path.join(tractRoot, "tract-foundation.json")
  );
  const countyRoot = path.join(
    tractRoot,
    "evidence",
    "cdc-places",
    "by-county"
  );
  const countyFiles = (await fs.readdir(countyRoot))
    .filter((fileName) => /^\d{3}\.json$/.test(fileName))
    .sort();
  const [tractArtifact, countyObservationArrays, coverage] = await Promise.all([
    readJson(tractFile),
    Promise.all(
      countyFiles.map((fileName) => readJson(path.join(countyRoot, fileName)))
    ),
    readJson(path.join(tractRoot, "cdc-places-coverage-summary.json"))
  ]);
  const observations = countyObservationArrays.flat();
  const knownGeoids = new Set(
    getTractGeographies(tractArtifact).map(({ geoid }) => geoid)
  );
  const knownMeasureById = new Map(selectedCdcPlacesMeasures.map((measure) => [measure.id, measure]));
  const seenPairs = new Set();

  assert(knownGeoids.size === 2181, `Expected 2,181 foundation tracts, found ${knownGeoids.size}.`);
  assert(countyFiles.length === 21, `Expected 21 CDC PLACES county shards, found ${countyFiles.length}.`);
  assert(Array.isArray(observations), "CDC PLACES observations must be an array.");
  assert(
    observations.length === knownGeoids.size * knownMeasureById.size,
    "Observation count does not equal tract count times selected measure count."
  );

  for (const observation of observations) {
    validateObservation(observation, knownGeoids, knownMeasureById);
    assert(
      countyFiles.includes(`${observation.geography.countyFips}.json`),
      `${observation.geography.geoid} is in an unknown county shard.`
    );
    const pair = `${observation.geography.geoid}:${observation.measure.id}`;
    assert(!seenPairs.has(pair), `Duplicate measure/GEOID pair ${pair}.`);
    seenPairs.add(pair);
  }

  const loadedEstimateCount = observations.filter(({ value }) => value !== null).length;
  const missingEstimateCount = observations.length - loadedEstimateCount;
  const missingGeoids = new Set(
    observations
      .filter(({ value }) => value === null)
      .map(({ geography }) => geography.geoid)
  );

  assert(coverage.schemaVersion === "1.0.0", "Unexpected CDC PLACES coverage schema version.");
  assert(coverage.source?.datasetId === CDC_PLACES_DATASET_ID, "Coverage has the wrong CDC dataset identifier.");
  assert(coverage.source?.releaseYear === CDC_PLACES_RELEASE_YEAR, "Coverage has the wrong release year.");
  assert(coverage.source?.geographyIdentifierField === "LocationID", "Coverage must name the source GEOID field.");
  assert(coverage.source?.estimateType === "modeled crude prevalence", "Coverage must label the estimate type.");
  assert(coverage.tractCount === knownGeoids.size, "Coverage tract count does not match the foundation.");
  assert(coverage.countyShardCount === countyFiles.length, "Coverage county-shard count is incorrect.");
  assert(coverage.selectedMeasureCount === knownMeasureById.size, "Coverage selected-measure count is incorrect.");
  assert(coverage.expectedObservationCount === observations.length, "Coverage observation count is incorrect.");
  assert(coverage.sourceRecordCount === loadedEstimateCount, "Coverage source-row count must equal loaded estimates.");
  assert(coverage.loadedEstimateCount === loadedEstimateCount, "Coverage loaded-estimate count is incorrect.");
  assert(coverage.missingEstimateCount === missingEstimateCount, "Coverage missing-estimate count is incorrect.");
  assert(coverage.tractsWithAnyMissingEstimate === missingGeoids.size, "Coverage missing-tract count is incorrect.");
  assert(coverage.tractsWithPartialSourceCoverage === 0, "Partial measure coverage requires source review.");
  assert(coverage.classificationStatus === "not_evaluated", "Batch 5 must not classify tracts.");
  assert(
    coverage.outsideSourceCoverageGeoids.every((geoid) => knownGeoids.has(geoid)),
    "Coverage names an unknown tract outside source coverage."
  );

  for (const measure of selectedCdcPlacesMeasures) {
    const measureObservations = observations.filter(
      (observation) => observation.measure.id === measure.id
    );
    const measureCoverage = coverage.measureCoverage?.[measure.id];
    assert(measureObservations.length === knownGeoids.size, `${measure.id} does not cover every foundation tract.`);
    assert(measureCoverage?.dataYear === measure.dataYear, `${measure.id} has the wrong data year.`);
    assert(
      measureCoverage.loadedEstimateCount + measureCoverage.missingEstimateCount === knownGeoids.size,
      `${measure.id} coverage counts do not add up.`
    );
  }

  for (const [index, fileName] of countyFiles.entries()) {
    const countyFips = fileName.slice(0, 3);
    const countyObservations = countyObservationArrays[index];
    assert(
      countyObservations.every(
        ({ geography }) => geography.countyFips === countyFips
      ),
      `${fileName} contains an observation from another county.`
    );
    assert(
      coverage.observationCountsByCounty?.[countyFips] ===
        countyObservations.length,
      `${fileName} does not match its coverage count.`
    );
  }

  console.log(
    `CDC PLACES production validation passed for ${observations.length} observations: ${loadedEstimateCount} loaded and ${missingEstimateCount} explicitly missing.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
