import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CDC_PLACES_CHECKED_DATE,
  CDC_PLACES_DATASET_ID,
  CDC_PLACES_DATASET_NAME,
  CDC_PLACES_RELEASE_YEAR,
  CDC_PLACES_SOURCE_URL,
  buildCdcPlacesApiUrl,
  selectedCdcPlacesMeasures
} from "./lib/cdcPlacesConfig.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const defaultTractFile = path.join(
  projectRoot,
  "public",
  "data",
  "tracts",
  "nj",
  "tract-foundation.json"
);
const defaultOutputRoot = path.join(
  projectRoot,
  "public",
  "data",
  "tracts",
  "nj"
);

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
  const rawGeographies = Array.isArray(tractArtifact.records)
    ? tractArtifact.records.map((record) => record.geography)
    : Array.isArray(tractArtifact.features)
      ? tractArtifact.features.map((feature) => ({
          type: "census_tract",
          geoid: String(feature.properties?.GEOID ?? ""),
          stateFips: String(feature.properties?.STATE ?? feature.properties?.STATEFP ?? ""),
          countyFips: String(feature.properties?.COUNTY ?? feature.properties?.COUNTYFP ?? ""),
          tractCode: String(feature.properties?.TRACT ?? feature.properties?.TRACTCE ?? "")
        }))
      : [];

  const geographies = rawGeographies
    .map((geography) => ({
      type: "census_tract",
      geoid: String(geography?.geoid ?? ""),
      stateFips: String(geography?.stateFips ?? "").padStart(2, "0"),
      countyFips: String(geography?.countyFips ?? "").padStart(3, "0"),
      tractCode: String(geography?.tractCode ?? "").padStart(6, "0")
    }))
    .sort((first, second) => first.geoid.localeCompare(second.geoid));

  const geoids = new Set();
  for (const geography of geographies) {
    assert(/^34\d{9}$/.test(geography.geoid), `Invalid New Jersey tract GEOID ${geography.geoid}.`);
    assert(
      geography.geoid ===
        `${geography.stateFips}${geography.countyFips}${geography.tractCode}`,
      `Tract geography fields do not compose GEOID ${geography.geoid}.`
    );
    assert(!geoids.has(geography.geoid), `Duplicate tract GEOID ${geography.geoid}.`);
    geoids.add(geography.geoid);
  }

  assert(geographies.length > 0, "No New Jersey tract geographies were loaded.");
  return geographies;
}

function parseNumber(value, fieldName, sourceRecordId) {
  const parsed = Number(value);
  assert(Number.isFinite(parsed), `${sourceRecordId} has an invalid ${fieldName}.`);
  return parsed;
}

function validateSourceRow(row, measure) {
  const sourceRecordId = `${CDC_PLACES_DATASET_ID}:${row.locationid}:${row.measureid}:${row.datavaluetypeid}`;
  assert(/^34\d{9}$/.test(row.locationid), `${sourceRecordId} has an invalid tract GEOID.`);
  assert(row.stateabbr === "NJ", `${sourceRecordId} is not a New Jersey record.`);
  assert(row.countyfips === row.locationid.slice(0, 5), `${sourceRecordId} has a mismatched county FIPS.`);
  assert(row.measureid === measure.sourceMeasureId, `${sourceRecordId} has the wrong measure identifier.`);
  assert(row.category === measure.category, `${sourceRecordId} has the wrong category.`);
  assert(row.datavaluetypeid === measure.dataValueTypeId, `${sourceRecordId} has the wrong value-type identifier.`);
  assert(row.data_value_type === measure.dataValueType, `${sourceRecordId} has the wrong value type.`);
  assert(row.data_value_unit === measure.sourceUnit, `${sourceRecordId} has the wrong unit.`);
  assert(Number(row.year) === measure.dataYear, `${sourceRecordId} has an unexpected data year.`);
  assert(row.datasource === "BRFSS", `${sourceRecordId} has an unexpected data source.`);

  const value = parseNumber(row.data_value, "data value", sourceRecordId);
  const low = parseNumber(row.low_confidence_limit, "low confidence limit", sourceRecordId);
  const high = parseNumber(row.high_confidence_limit, "high confidence limit", sourceRecordId);
  assert(value >= 0 && value <= 100, `${sourceRecordId} is outside the 0-100 percent range.`);
  assert(low >= 0 && low <= value, `${sourceRecordId} has an invalid low confidence limit.`);
  assert(high >= value && high <= 100, `${sourceRecordId} has an invalid high confidence limit.`);

  return { sourceRecordId, value };
}

function buildArtifacts(sourceRows, tractArtifact) {
  assert(Array.isArray(sourceRows), "CDC PLACES source must be a JSON array.");
  const geographies = getTractGeographies(tractArtifact);
  const geoidSet = new Set(geographies.map(({ geoid }) => geoid));
  const measureBySourceId = new Map(
    selectedCdcPlacesMeasures.map((measure) => [measure.sourceMeasureId, measure])
  );
  const sourceRowsByKey = new Map();

  for (const row of sourceRows) {
    const measure = measureBySourceId.get(row.measureid);
    assert(measure, `Unexpected CDC PLACES measure ${row.measureid ?? "(missing)"}.`);
    const normalized = validateSourceRow(row, measure);
    assert(geoidSet.has(row.locationid), `CDC PLACES row references unknown tract ${row.locationid}.`);
    const key = `${row.locationid}:${row.measureid}`;
    assert(!sourceRowsByKey.has(key), `Duplicate CDC PLACES measure/GEOID pair ${key}.`);
    sourceRowsByKey.set(key, { row, ...normalized });
  }

  const observations = [];
  const measureCoverage = Object.fromEntries(
    selectedCdcPlacesMeasures.map(({ id }) => [
      id,
      { loadedEstimateCount: 0, missingEstimateCount: 0, dataYear: null }
    ])
  );
  const missingMeasureCountByGeoid = new Map();

  for (const geography of geographies) {
    for (const measure of selectedCdcPlacesMeasures) {
      const sourceMatch = sourceRowsByKey.get(`${geography.geoid}:${measure.sourceMeasureId}`);
      const coverage = measureCoverage[measure.id];

      if (sourceMatch) {
        coverage.loadedEstimateCount += 1;
        coverage.dataYear = measure.dataYear;
        observations.push({
          schemaVersion: "1.0.0",
          geography,
          measure: {
            id: measure.id,
            label: measure.label,
            evidenceLayer: measure.evidenceLayer
          },
          source: {
            agency: "Centers for Disease Control and Prevention",
            dataset: CDC_PLACES_DATASET_NAME,
            releaseYear: CDC_PLACES_RELEASE_YEAR,
            url: CDC_PLACES_SOURCE_URL
          },
          value: sourceMatch.value,
          unit: measure.unit,
          estimateType: "modeled",
          missingness: { isMissing: false, reason: null },
          provenance: {
            sourceRecordId: sourceMatch.sourceRecordId,
            transformation:
              `Selected the ${measure.dataYear} CDC PLACES crude-prevalence estimate and converted the source percent value to a JSON number without changing scale.`,
            checkedDate: CDC_PLACES_CHECKED_DATE
          }
        });
      } else {
        coverage.missingEstimateCount += 1;
        missingMeasureCountByGeoid.set(
          geography.geoid,
          (missingMeasureCountByGeoid.get(geography.geoid) ?? 0) + 1
        );
        observations.push({
          schemaVersion: "1.0.0",
          geography,
          measure: {
            id: measure.id,
            label: measure.label,
            evidenceLayer: measure.evidenceLayer
          },
          source: {
            agency: "Centers for Disease Control and Prevention",
            dataset: CDC_PLACES_DATASET_NAME,
            releaseYear: CDC_PLACES_RELEASE_YEAR,
            url: CDC_PLACES_SOURCE_URL
          },
          value: null,
          unit: measure.unit,
          estimateType: "unavailable",
          missingness: {
            isMissing: true,
            reason:
              "No matching estimate exists for this 2024 Census tract in the CDC PLACES 2025 release."
          },
          provenance: {
            sourceRecordId:
              `${CDC_PLACES_DATASET_ID}:${geography.geoid}:${measure.sourceMeasureId}:outside-source-coverage`,
            transformation:
              "Created an explicit missing observation after a GEOID-only join found no matching source row; no value was imputed.",
            checkedDate: CDC_PLACES_CHECKED_DATE
          }
        });
      }
    }
  }

  const outsideSourceCoverageGeoids = [...missingMeasureCountByGeoid]
    .filter(([, count]) => count === selectedCdcPlacesMeasures.length)
    .map(([geoid]) => geoid)
    .sort();
  const partiallyCoveredGeoids = [...missingMeasureCountByGeoid]
    .filter(([, count]) => count < selectedCdcPlacesMeasures.length)
    .map(([geoid]) => geoid)
    .sort();
  const loadedEstimateCount = observations.filter(({ value }) => value !== null).length;
  const missingEstimateCount = observations.length - loadedEstimateCount;
  const observationCountsByCounty = Object.fromEntries(
    [...new Set(geographies.map(({ countyFips }) => countyFips))]
      .sort()
      .map((countyFips) => [
        countyFips,
        observations.filter(
          ({ geography }) => geography.countyFips === countyFips
        ).length
      ])
  );

  const coverageSummary = {
    schemaVersion: "1.0.0",
    pilotState: "New Jersey",
    stateFips: "34",
    tractCount: geographies.length,
    selectedMeasureCount: selectedCdcPlacesMeasures.length,
    countyShardCount: Object.keys(observationCountsByCounty).length,
    observationCountsByCounty,
    expectedObservationCount: geographies.length * selectedCdcPlacesMeasures.length,
    sourceRecordCount: sourceRows.length,
    loadedEstimateCount,
    missingEstimateCount,
    tractsWithAllSelectedMeasures:
      geographies.length - missingMeasureCountByGeoid.size,
    tractsWithAnyMissingEstimate: missingMeasureCountByGeoid.size,
    tractsOutsideSourceCoverage: outsideSourceCoverageGeoids.length,
    tractsWithPartialSourceCoverage: partiallyCoveredGeoids.length,
    outsideSourceCoverageGeoids,
    partiallyCoveredGeoids,
    measureCoverage,
    source: {
      agency: "Centers for Disease Control and Prevention",
      dataset: CDC_PLACES_DATASET_NAME,
      datasetId: CDC_PLACES_DATASET_ID,
      releaseYear: CDC_PLACES_RELEASE_YEAR,
      checkedDate: CDC_PLACES_CHECKED_DATE,
      sourceUrl: CDC_PLACES_SOURCE_URL,
      apiUrl: buildCdcPlacesApiUrl(),
      geographyIdentifierField: "LocationID",
      geographyIdentifierFormat: "11-digit Census tract GEOID",
      estimateType: "modeled crude prevalence",
      unit: "percent"
    },
    selectedMeasures: selectedCdcPlacesMeasures.map(
      ({ sourceMeasureId, id, label, category, evidenceLayer, dataYear, dataValueType, rationale }) => ({
        sourceMeasureId,
        id,
        label,
        category,
        evidenceLayer,
        dataYear,
        dataValueType,
        estimateType: "modeled",
        unit: "percent",
        rationale
      })
    ),
    limitations: [
      "CDC PLACES values are modeled population estimates, not individual diagnoses.",
      "Crude prevalence reflects the local population composition and should not be treated as an age-adjusted comparison.",
      `The 2025 release uses 2023 BRFSS data for all ${selectedCdcPlacesMeasures.length} selected measures.`,
      "A missing estimate is not zero and does not imply low community health need."
    ],
    classificationStatus: "not_evaluated"
  };

  return { observations, coverageSummary };
}

async function loadSourceRows() {
  const input = getArgument("input");
  if (input) return readJson(path.resolve(projectRoot, input));

  const response = await fetch(buildCdcPlacesApiUrl(), {
    headers: { "user-agent": "CareAtlas CDC PLACES tract importer" }
  });
  if (!response.ok) {
    throw new Error(`CDC PLACES download failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function main() {
  const tractFile = path.resolve(projectRoot, getArgument("tract-file") ?? defaultTractFile);
  const outputRoot = path.resolve(projectRoot, getArgument("output-dir") ?? defaultOutputRoot);
  const [sourceRows, tractArtifact] = await Promise.all([
    loadSourceRows(),
    readJson(tractFile)
  ]);
  const { observations, coverageSummary } = buildArtifacts(sourceRows, tractArtifact);
  const countyOutputRoot = path.join(
    outputRoot,
    "evidence",
    "cdc-places",
    "by-county"
  );
  await fs.rm(countyOutputRoot, { force: true, recursive: true });
  const countyWrites = Object.keys(coverageSummary.observationCountsByCounty).map(
    (countyFips) =>
      writeJson(
        path.join(countyOutputRoot, `${countyFips}.json`),
        observations.filter(
          ({ geography }) => geography.countyFips === countyFips
        )
      )
  );

  await Promise.all([
    ...countyWrites,
    writeJson(path.join(outputRoot, "cdc-places-coverage-summary.json"), coverageSummary)
  ]);

  console.log(
    `Wrote ${coverageSummary.loadedEstimateCount} loaded and ${coverageSummary.missingEstimateCount} explicitly missing CDC PLACES observations for ${coverageSummary.tractCount} New Jersey tracts.`
  );
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildArtifacts, getTractGeographies, validateSourceRow };
