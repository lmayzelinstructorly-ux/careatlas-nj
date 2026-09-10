import { createReadStream } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import {
  CENSUS_ACS_DATASET_NAME,
  CENSUS_ACS_RELEASE_YEAR,
  CENSUS_ACS_SOURCE_URL,
  buildCensusAcsTableUrls,
  censusAcsMeasures
} from "./lib/batch6SourceConfig.mjs";
import {
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
} from "./lib/tractEvidenceBatch6.mjs";

function parseAcsCount(rawValue, sourceRecordId, field) {
  const value = Number(rawValue);
  assert(Number.isFinite(value), `${sourceRecordId} has invalid ${field}.`);
  return value < 0 ? null : value;
}

function calculateMeasure(row, measure, sourceRecordId) {
  if (!row) return null;
  const numeratorValues = measure.numeratorVariables.map((field) =>
    parseAcsCount(row[field], sourceRecordId, field)
  );
  const denominator = parseAcsCount(row[measure.denominatorVariable], sourceRecordId, measure.denominatorVariable);
  if (numeratorValues.some((value) => value === null) || denominator === null || denominator === 0) return null;
  const numerator = numeratorValues.reduce((sum, value) => sum + value, 0);
  assert(numerator <= denominator, `${sourceRecordId} numerator exceeds denominator.`);
  return Number(((numerator / denominator) * 100).toFixed(4));
}

function indexTableRecords(records, tableId, knownGeoids) {
  assert(Array.isArray(records), `ACS ${tableId} records must be an array.`);
  const byGeoid = new Map();
  for (const row of records) {
    const geoid = String(row.GEO_ID ?? "").replace(/^1400000US/, "");
    assert(/^34\d{9}$/.test(geoid), `ACS ${tableId} row has invalid tract GEOID ${geoid}.`);
    assert(!byGeoid.has(geoid), `ACS ${tableId} has duplicate tract GEOID ${geoid}.`);
    if (knownGeoids.has(geoid)) byGeoid.set(geoid, row);
  }
  return byGeoid;
}

function buildCensusAcsArtifacts(sourceData, tractArtifact) {
  const geographies = getTractGeographies(tractArtifact);
  const knownGeoids = new Set(geographies.map(({ geoid }) => geoid));
  for (const { tableId } of censusAcsMeasures) {
    assert(Array.isArray(sourceData[tableId]), `Missing ACS table ${tableId}.`);
  }
  const recordsByTable = Object.fromEntries(
    Object.entries(sourceData).map(([tableId, records]) => [
      tableId,
      indexTableRecords(records, tableId, knownGeoids)
    ])
  );
  const source = {
    agency: "United States Census Bureau",
    dataset: CENSUS_ACS_DATASET_NAME,
    releaseYear: CENSUS_ACS_RELEASE_YEAR,
    url: CENSUS_ACS_SOURCE_URL
  };
  const observations = [];

  for (const geography of geographies) {
    for (const measure of censusAcsMeasures) {
      const row = recordsByTable[measure.tableId]?.get(geography.geoid);
      const sourceFields = [...measure.numeratorVariables, measure.denominatorVariable].join(",");
      const sourceRecordId = `acs-${CENSUS_ACS_RELEASE_YEAR}-5yr:${geography.geoid}:${sourceFields}`;
      const value = calculateMeasure(row, measure, sourceRecordId);
      observations.push(buildObservation({
        geography,
        measure,
        source,
        value,
        estimateType: "derived",
        sourceRecordId,
        transformation:
          `Summed ${measure.numeratorVariables.join(" + ")}, divided by ${measure.denominatorVariable}, multiplied by 100 and rounded to four decimal places; no count or denominator was imputed.`,
        missingReason: row
          ? "The ACS table reports a suppression sentinel, unavailable count or zero denominator for this tract measure."
          : "No matching 2024 ACS 5-year tract exists for this current New Jersey tract GEOID."
      }));
    }
  }

  const tableUrls = buildCensusAcsTableUrls();
  return {
    observations,
    coverageSummary: {
      schemaVersion: "1.0.0",
      pilotState: "New Jersey",
      stateFips: "34",
      ...summarizeCoverage({ geographies, measures: censusAcsMeasures, observations }),
      sourceRecordCounts: Object.fromEntries(
        Object.entries(recordsByTable).map(([tableId, rows]) => [tableId, rows.size])
      ),
      source: {
        ...source,
        checkedDate: CHECKED_DATE,
        tableUrls,
        geographyIdentifierField: "GEO_ID",
        geographyIdentifierFormat: "1400000US followed by an 11-digit Census tract GEOID"
      },
      selectedMeasures: censusAcsMeasures,
      limitations: [
        "ACS 5-year values are survey estimates and carry sampling uncertainty.",
        "Each percentage is transparently derived from published ACS table counts; margins of error are not combined or displayed in this batch.",
        "The disability numerator sums people reporting one or multiple disability types across the table's three age groups.",
        "A suppressed or unavailable estimate is unknown, not zero and not evidence of low barriers."
      ],
      classificationStatus: "not_evaluated"
    }
  };
}

function requiredFieldsForTable(tableId) {
  const fields = new Set(["GEO_ID"]);
  for (const measure of censusAcsMeasures.filter((candidate) => candidate.tableId === tableId)) {
    measure.numeratorVariables.forEach((field) => fields.add(field));
    fields.add(measure.denominatorVariable);
  }
  return fields;
}

async function readTableStream(stream, tableId) {
  const lineReader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let headers;
  let selectedIndexes;
  const records = [];
  for await (const line of lineReader) {
    if (!headers) {
      headers = line.replace(/^\uFEFF/, "").split("|");
      const required = requiredFieldsForTable(tableId);
      selectedIndexes = [...required].map((field) => {
        const index = headers.indexOf(field);
        assert(index >= 0, `ACS ${tableId} table is missing required field ${field}.`);
        return [field, index];
      });
      continue;
    }
    if (!line.startsWith("1400000US34")) continue;
    const values = line.split("|");
    records.push(Object.fromEntries(selectedIndexes.map(([field, index]) => [field, values[index]])));
  }
  assert(headers, `ACS ${tableId} table is empty.`);
  assert(records.length > 0, `ACS ${tableId} table contains no New Jersey tracts.`);
  return records;
}

async function loadTable(tableId, url) {
  const argument = getArgument(tableId.toLowerCase());
  if (argument) {
    return readTableStream(createReadStream(path.resolve(PROJECT_ROOT, argument), { encoding: "utf8" }), tableId);
  }
  const response = await fetch(url, { headers: { "user-agent": "CareAtlas ACS table importer" } });
  if (!response.ok || !response.body) {
    throw new Error(`ACS ${tableId} download failed: ${response.status} ${response.statusText}`);
  }
  return readTableStream(Readable.fromWeb(response.body), tableId);
}

async function loadSourceData() {
  const input = getArgument("input");
  if (input) return readJson(path.resolve(PROJECT_ROOT, input));
  const sourceData = {};
  for (const [tableId, url] of Object.entries(buildCensusAcsTableUrls())) {
    sourceData[tableId] = await loadTable(tableId, url);
  }
  return sourceData;
}

async function main() {
  const tractFile = path.resolve(PROJECT_ROOT, getArgument("tract-file") ?? TRACT_FOUNDATION_PATH);
  const outputRoot = path.resolve(PROJECT_ROOT, getArgument("output-dir") ?? NJ_TRACT_ROOT);
  const [sourceData, tractArtifact] = await Promise.all([loadSourceData(), readJson(tractFile)]);
  const { observations, coverageSummary } = buildCensusAcsArtifacts(sourceData, tractArtifact);
  await Promise.all([
    writeCountyShards({ observations, outputRoot, sourceSlug: "census-acs" }),
    writeJson(path.join(outputRoot, "census-acs-coverage-summary.json"), coverageSummary)
  ]);
  console.log(`Wrote ${observations.length} Census ACS observations for ${coverageSummary.tractCount} New Jersey tracts.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}

export { buildCensusAcsArtifacts, calculateMeasure, indexTableRecords, readTableStream };
