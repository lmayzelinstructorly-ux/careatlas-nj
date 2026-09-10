import path from "node:path";
import { NJ_TRACT_ROOT, readJson, writeJson } from "./lib/tractEvidenceBatch6.mjs";

const sources = [
  ["cdc_svi", "cdc-svi-coverage-summary.json"],
  ["census_acs", "census-acs-coverage-summary.json"],
  ["hrsa_shortage", "hrsa-shortage-coverage-summary.json"]
];
const entries = await Promise.all(sources.map(async ([key, fileName]) => {
  const summary = await readJson(path.join(NJ_TRACT_ROOT, fileName));
  return [key, {
    summaryFile: `public/data/tracts/nj/${fileName}`,
    tractCount: summary.tractCount,
    selectedMeasureCount: summary.selectedMeasureCount,
    expectedObservationCount: summary.expectedObservationCount,
    loadedEstimateCount: summary.loadedEstimateCount,
    missingEstimateCount: summary.missingEstimateCount,
    source: summary.source
  }];
}));
const sourceCoverage = Object.fromEntries(entries);
const tractCounts = new Set(Object.values(sourceCoverage).map(({ tractCount }) => tractCount));
if (tractCounts.size !== 1) throw new Error("Batch 6 source summaries do not use the same tract foundation.");

const summary = {
  schemaVersion: "1.0.0",
  batch: 6,
  title: "Social barriers and official shortage evidence",
  pilotState: "New Jersey",
  stateFips: "34",
  tractCount: [...tractCounts][0],
  sourceCoverage,
  totalSelectedMeasureCount: Object.values(sourceCoverage).reduce((sum, source) => sum + source.selectedMeasureCount, 0),
  totalExpectedObservationCount: Object.values(sourceCoverage).reduce((sum, source) => sum + source.expectedObservationCount, 0),
  classificationStatus: "not_evaluated",
  note: "Batch 6 adds source-backed evidence only. It does not calculate an access-gap score or classification."
};

await writeJson(path.join(NJ_TRACT_ROOT, "batch-6-coverage-summary.json"), summary);
console.log(`Wrote Batch 6 coverage summary for ${summary.totalExpectedObservationCount} observations.`);
