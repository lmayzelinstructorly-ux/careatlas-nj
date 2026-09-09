import fs from "node:fs/promises";
import path from "node:path";
import { evaluateAccessGapRule } from "./lib/accessGapRuleV1.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const tractRoot = path.join(projectRoot, "public", "data", "tracts", "nj");
const rulePath = path.join(tractRoot, "access-gap-rule.v1.json");
const outputRoot = path.join(tractRoot, "classifications", "access-gap-rule-v1", "by-county");
const summaryPath = path.join(tractRoot, "access-gap-rule-v1-summary.json");
const generatedDate = "2026-07-13";
const sourceSlugs = ["cdc-places", "cdc-svi", "hrsa-shortage"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

async function loadSourceCounty(sourceSlug, countyFips) {
  const filePath = path.join(
    tractRoot,
    "evidence",
    sourceSlug,
    "by-county",
    `${countyFips}.json`
  );
  return readJson(filePath);
}

function groupByGeoid(observations) {
  const byGeoid = new Map();
  for (const observation of observations) {
    const geoid = observation.geography?.geoid;
    assert(/^34\d{9}$/.test(geoid), `Invalid New Jersey tract GEOID ${geoid}.`);
    const rows = byGeoid.get(geoid) ?? [];
    rows.push(observation);
    byGeoid.set(geoid, rows);
  }
  return byGeoid;
}

const rule = await readJson(rulePath);
assert(rule.ruleVersion === "1.0.0", "Only access-gap rule version 1.0.0 can be applied by this script.");
assert(rule.scope?.stateFips === "34", "Rule scope must remain New Jersey.");

const cdcCoverage = await readJson(path.join(tractRoot, "cdc-places-coverage-summary.json"));
const countyFipsValues = Object.keys(cdcCoverage.observationCountsByCounty ?? {}).sort();
assert(countyFipsValues.length === 21, `Expected 21 New Jersey counties, found ${countyFipsValues.length}.`);

await fs.rm(outputRoot, { recursive: true, force: true });
const classifications = [];

for (const countyFips of countyFipsValues) {
  const sourceRows = (await Promise.all(
    sourceSlugs.map((sourceSlug) => loadSourceCounty(sourceSlug, countyFips))
  )).flat();
  const observationsByGeoid = groupByGeoid(sourceRows);
  const countyClassifications = [...observationsByGeoid.entries()]
    .map(([geoid, observations]) => {
      const evaluated = evaluateAccessGapRule({ rule, observations });
      const geography = observations[0].geography;
      const checkedDates = [...new Set(observations.map(({ provenance }) => provenance?.checkedDate).filter(Boolean))].sort();
      return {
        schemaVersion: "1.0.0",
        ruleVersion: rule.ruleVersion,
        geography,
        state: evaluated.state,
        label: evaluated.label,
        findings: evaluated.findings,
        ruleInputs: evaluated.ruleInputs,
        explanations: evaluated.explanations,
        limitations: rule.limitations,
        provenance: {
          ruleFile: "public/data/tracts/nj/access-gap-rule.v1.json",
          sourceEvidenceFamilies: sourceSlugs,
          sourceCheckedDates: checkedDates,
          generatedDate
        }
      };
    })
    .sort((first, second) => first.geography.geoid.localeCompare(second.geography.geoid));
  assert(countyClassifications.length > 0, `County ${countyFips} produced no classifications.`);
  assert(
    countyClassifications.every(({ geography }) => geography.countyFips === countyFips),
    `County ${countyFips} output contains another county.`
  );
  await writeJson(path.join(outputRoot, `${countyFips}.json`), countyClassifications);
  classifications.push(...countyClassifications);
}

assert(classifications.length === 2181, `Expected 2,181 classifications, found ${classifications.length}.`);
const countStates = (records) => Object.fromEntries(
  rule.statesInPrecedenceOrder.map((state) => [
    state,
    records.filter((record) => record.state === state).length
  ])
);
const stateCounts = countStates(classifications);
const classificationCount = Object.values(stateCounts).reduce((sum, count) => sum + count, 0);
assert(classificationCount === classifications.length, "One or more classifications use an unknown state.");

await writeJson(summaryPath, {
  schemaVersion: "1.0.0",
  ruleVersion: rule.ruleVersion,
  title: rule.title,
  pilotState: "New Jersey",
  stateFips: "34",
  generatedDate,
  tractCount: classifications.length,
  countyShardCount: countyFipsValues.length,
  stateCounts,
  stateCountsByCounty: Object.fromEntries(countyFipsValues.map((countyFips) => [
    countyFips,
    countStates(classifications.filter(({ geography }) => geography.countyFips === countyFips))
  ])),
  requiredMeasureIds: [
    ...rule.communityHealthNeed.requiredMeasures,
    ...rule.socialBarriers.requiredMeasures,
    ...rule.documentedShortage.requiredMeasures
  ].map(({ id }) => id),
  ruleFile: "public/data/tracts/nj/access-gap-rule.v1.json",
  classificationShardRoot: "public/data/tracts/nj/classifications/access-gap-rule-v1/by-county",
  note: "Counts describe versioned screening flags, not scores, rankings, diagnoses, medical advice or proof of adequate access."
});

console.log(`Applied access-gap rule ${rule.ruleVersion} to ${classifications.length} New Jersey tracts.`);
console.log(JSON.stringify(stateCounts));
