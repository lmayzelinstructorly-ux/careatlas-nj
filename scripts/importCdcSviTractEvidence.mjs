import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRows } from "./lib/csvRows.mjs";
import {
  CDC_SVI_CSV_URL,
  CDC_SVI_DATASET_NAME,
  CDC_SVI_RELEASE_YEAR,
  CDC_SVI_SOURCE_URL,
  cdcSviMeasures
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

function normalizeRank(rawValue, sourceRecordId, sourceField) {
  const value = Number(rawValue);
  assert(Number.isFinite(value), `${sourceRecordId} has an invalid ${sourceField}.`);
  if (value === -999) return null;
  assert(value >= 0 && value <= 1, `${sourceRecordId} ${sourceField} is outside 0-1.`);
  return value;
}

function buildCdcSviArtifacts(sourceRows, tractArtifact) {
  assert(Array.isArray(sourceRows), "CDC SVI source must be an array of CSV rows.");
  const geographies = getTractGeographies(tractArtifact);
  const knownGeoids = new Set(geographies.map(({ geoid }) => geoid));
  const sourceByGeoid = new Map();

  for (const row of sourceRows) {
    const geoid = String(row.FIPS ?? "");
    assert(row.ST_ABBR === "NJ" && row.ST === "34", `CDC SVI row ${geoid} is not New Jersey.`);
    assert(/^34\d{9}$/.test(geoid), `CDC SVI row has invalid tract GEOID ${geoid}.`);
    assert(!sourceByGeoid.has(geoid), `CDC SVI has duplicate tract GEOID ${geoid}.`);
    if (knownGeoids.has(geoid)) sourceByGeoid.set(geoid, row);
  }

  const source = {
    agency: "Centers for Disease Control and Prevention / Agency for Toxic Substances and Disease Registry",
    dataset: CDC_SVI_DATASET_NAME,
    releaseYear: CDC_SVI_RELEASE_YEAR,
    url: CDC_SVI_SOURCE_URL
  };
  const observations = [];

  for (const geography of geographies) {
    const row = sourceByGeoid.get(geography.geoid);
    for (const measure of cdcSviMeasures) {
      const sourceRecordId = `cdc-svi-${CDC_SVI_RELEASE_YEAR}:${geography.geoid}:${measure.sourceField}`;
      const value = row ? normalizeRank(row[measure.sourceField], sourceRecordId, measure.sourceField) : null;
      observations.push(buildObservation({
        geography,
        measure,
        source,
        value,
        estimateType: "derived",
        sourceRecordId,
        transformation: row
          ? `Selected CDC SVI field ${measure.sourceField}; preserved its official national tract percentile rank without re-ranking or rescoring.`
          : "Created an explicit missing observation after an exact 11-digit GEOID join found no matching 2022 SVI tract; no value was imputed.",
        missingReason: row
          ? `CDC SVI reports ${measure.sourceField} as unavailable (-999) for this tract.`
          : "No matching 2022 CDC SVI tract exists for this current New Jersey tract GEOID."
      }));
    }
  }

  const baseCoverage = summarizeCoverage({ geographies, measures: cdcSviMeasures, observations });
  return {
    observations,
    coverageSummary: {
      schemaVersion: "1.0.0",
      pilotState: "New Jersey",
      stateFips: "34",
      ...baseCoverage,
      sourceRecordCount: sourceByGeoid.size,
      source: {
        ...source,
        checkedDate: CHECKED_DATE,
        csvUrl: CDC_SVI_CSV_URL,
        geographyIdentifierField: "FIPS",
        geographyIdentifierFormat: "11-digit Census tract GEOID"
      },
      selectedMeasures: cdcSviMeasures,
      limitations: [
        "SVI percentile ranks compare tracts within the 2022 national release and are not CareAtlas scores.",
        "CDC cautions that SVI ranks from different release years are not directly comparable.",
        "A missing rank is unknown, not zero and not evidence of low vulnerability.",
        "The 2022 SVI tract vintage does not exactly match every tract in the current foundation."
      ],
      classificationStatus: "not_evaluated"
    }
  };
}

async function loadSourceRows() {
  const input = getArgument("input");
  if (input) return parseCsvRows(await fs.readFile(path.resolve(PROJECT_ROOT, input), "utf8"));
  const response = await fetch(CDC_SVI_CSV_URL, { headers: { "user-agent": "CareAtlas SVI importer" } });
  if (!response.ok) throw new Error(`CDC SVI download failed: ${response.status} ${response.statusText}`);
  return parseCsvRows(await response.text());
}

async function main() {
  const tractFile = path.resolve(PROJECT_ROOT, getArgument("tract-file") ?? TRACT_FOUNDATION_PATH);
  const outputRoot = path.resolve(PROJECT_ROOT, getArgument("output-dir") ?? NJ_TRACT_ROOT);
  const [sourceRows, tractArtifact] = await Promise.all([loadSourceRows(), readJson(tractFile)]);
  const { observations, coverageSummary } = buildCdcSviArtifacts(sourceRows, tractArtifact);
  await Promise.all([
    writeCountyShards({ observations, outputRoot, sourceSlug: "cdc-svi" }),
    writeJson(path.join(outputRoot, "cdc-svi-coverage-summary.json"), coverageSummary)
  ]);
  console.log(`Wrote ${observations.length} CDC SVI observations for ${coverageSummary.tractCount} New Jersey tracts.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}

export { buildCdcSviArtifacts, normalizeRank };
