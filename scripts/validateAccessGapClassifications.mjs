import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const tractRoot = path.join(projectRoot, "public", "data", "tracts", "nj");
const classificationRoot = path.join(tractRoot, "classifications", "access-gap-rule-v1", "by-county");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function compare(value, operator, threshold) {
  if (operator === ">=") return value >= threshold;
  if (operator === "<=") return value <= threshold;
  throw new Error(`Unexpected operator ${operator}.`);
}

const rule = await readJson(path.join(tractRoot, "access-gap-rule.v1.json"));
const summary = await readJson(path.join(tractRoot, "access-gap-rule-v1-summary.json"));
const foundation = await readJson(path.join(tractRoot, "tract-foundation.json"));
const foundationGeoids = new Set(foundation.records.map(({ geography }) => geography.geoid));
const countyFiles = (await fs.readdir(classificationRoot)).filter((file) => /^\d{3}\.json$/.test(file)).sort();
assert(countyFiles.length === 21, `Expected 21 classification shards, found ${countyFiles.length}.`);
const shardRows = await Promise.all(countyFiles.map((file) => readJson(path.join(classificationRoot, file))));
const records = shardRows.flat();
assert(records.length === 2181, `Expected 2,181 classifications, found ${records.length}.`);
assert(foundationGeoids.size === records.length, "Classification count does not match the tract foundation.");

const requiredGroups = [rule.communityHealthNeed, rule.socialBarriers, rule.documentedShortage];
const requiredIds = requiredGroups.flatMap(({ requiredMeasures }) => requiredMeasures.map(({ id }) => id));
const allowedStates = new Set(rule.statesInPrecedenceOrder);
const seenGeoids = new Set();
const sourceSlugs = ["cdc-places", "cdc-svi", "hrsa-shortage"];
const sourceRows = (await Promise.all(sourceSlugs.flatMap((sourceSlug) => countyFiles.map((file) =>
  readJson(path.join(tractRoot, "evidence", sourceSlug, "by-county", file))
)))).flat();
const sourceObservationByKey = new Map(sourceRows
  .filter(({ measure }) => requiredIds.includes(measure.id))
  .map((observation) => [`${observation.geography.geoid}:${observation.measure.id}`, observation]));
assert(sourceObservationByKey.size === foundationGeoids.size * requiredIds.length,
  "Required source evidence does not contain one observation per tract and rule input.");

for (const [fileIndex, countyRecords] of shardRows.entries()) {
  const countyFips = countyFiles[fileIndex].slice(0, 3);
  for (const record of countyRecords) {
    const geoid = record.geography?.geoid;
    assert(record.schemaVersion === "1.0.0" && record.ruleVersion === rule.ruleVersion,
      `${geoid} has the wrong schema or rule version.`);
    assert(/^34\d{9}$/.test(geoid) && foundationGeoids.has(geoid), `${geoid} is not a foundation tract.`);
    assert(!seenGeoids.has(geoid), `Duplicate classification for tract ${geoid}.`);
    seenGeoids.add(geoid);
    assert(record.geography.countyFips === countyFips, `${geoid} is in the wrong county shard.`);
    assert(allowedStates.has(record.state), `${geoid} has unknown state ${record.state}.`);
    assert(record.label === rule.stateLabels[record.state], `${geoid} has the wrong state label.`);
    assert(!("score" in record) && !("rank" in record), `${geoid} must not contain a score or rank.`);
    assert(Array.isArray(record.explanations) && record.explanations.length > 0, `${geoid} lacks explanations.`);
    assert(record.limitations.join("\n") === rule.limitations.join("\n"), `${geoid} does not preserve rule limitations.`);
    assert(record.provenance?.ruleFile.endsWith("access-gap-rule.v1.json"), `${geoid} lacks rule provenance.`);

    const inputById = new Map(record.ruleInputs.map((input) => [input.measureId, input]));
    assert(inputById.size === requiredIds.length, `${geoid} has the wrong number of rule inputs.`);
    assert(requiredIds.every((id) => inputById.has(id)), `${geoid} lacks a required rule input.`);
    const missingIds = requiredIds.filter((id) => inputById.get(id).missing);
    assert(missingIds.join(",") === record.findings.missingRequiredMeasureIds.join(","),
      `${geoid} missing-required list is inconsistent.`);

    for (const group of requiredGroups) {
      for (const contract of group.requiredMeasures) {
        const input = inputById.get(contract.id);
        const sourceObservation = sourceObservationByKey.get(`${geoid}:${contract.id}`);
        assert(input.operator === contract.operator && input.threshold === contract.threshold && input.unit === contract.unit,
          `${geoid}/${contract.id} does not preserve its threshold contract.`);
        assert(sourceObservation && input.value === sourceObservation.value,
          `${geoid}/${contract.id} does not preserve the source evidence value.`);
        assert(input.missing === sourceObservation.missingness.isMissing &&
          input.missingReason === sourceObservation.missingness.reason,
        `${geoid}/${contract.id} does not preserve source missingness.`);
        assert(input.missing ? input.triggered === null : input.triggered === compare(input.value, input.operator, input.threshold),
          `${geoid}/${contract.id} has an incorrect threshold result.`);
      }
    }

    let expectedState;
    if (missingIds.length > 0) expectedState = "insufficient_evidence";
    else {
      const healthHits = rule.communityHealthNeed.requiredMeasures
        .filter(({ id }) => inputById.get(id).triggered).length;
      const socialHits = rule.socialBarriers.requiredMeasures
        .filter(({ id }) => inputById.get(id).triggered).length;
      const shortageHits = rule.documentedShortage.requiredMeasures
        .filter(({ id }) => inputById.get(id).triggered).length;
      const elevatedNeed = healthHits >= rule.communityHealthNeed.minimumTriggeredMeasures ||
        socialHits >= rule.socialBarriers.minimumTriggeredMeasures;
      const shortage = shortageHits > 0;
      expectedState = elevatedNeed
        ? shortage ? "potential_access_gap" : "elevated_need_without_documented_shortage"
        : "no_current_gap_flag";
    }
    assert(record.state === expectedState, `${geoid} should be ${expectedState}, not ${record.state}.`);
  }
}

const stateCounts = Object.fromEntries(rule.statesInPrecedenceOrder.map((state) => [
  state,
  records.filter((record) => record.state === state).length
]));
assert(summary.ruleVersion === rule.ruleVersion && summary.tractCount === records.length,
  "Classification summary has the wrong rule version or tract count.");
assert(summary.countyShardCount === countyFiles.length, "Classification summary has the wrong shard count.");
assert(JSON.stringify(summary.stateCounts) === JSON.stringify(stateCounts), "Classification summary state counts are stale.");
assert(summary.requiredMeasureIds.join(",") === requiredIds.join(","), "Classification summary required measures are stale.");
assert(stateCounts.insufficient_evidence > 0, "Production must exercise the insufficient-evidence state.");
assert(stateCounts.potential_access_gap > 0, "Production must exercise the potential-access-gap state.");
assert(stateCounts.elevated_need_without_documented_shortage > 0,
  "Production must exercise the elevated-need-without-shortage state.");
assert(stateCounts.no_current_gap_flag > 0, "Production must exercise the no-current-gap-flag state.");

console.log(`Validated ${records.length} transparent tract classifications for rule ${rule.ruleVersion}.`);
console.log(JSON.stringify(stateCounts));
