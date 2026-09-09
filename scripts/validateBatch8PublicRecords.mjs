import fs from "node:fs/promises";
import path from "node:path";
import { parseCsvRows } from "./lib/csvRows.mjs";

const root = path.resolve(import.meta.dirname, "..");
const tractRoot = path.join(root, "public", "data", "tracts", "nj");
const publicRoot = path.join(tractRoot, "public-records");
const earthRadiusMiles = 3958.7613;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMiles(first, second) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

function hasForbiddenScoreOrRankKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenScoreOrRankKey);
  return Object.entries(value).some(
    ([key, child]) => /^(?:score|rank|ranking|gapScore)$/i.test(key) || hasForbiddenScoreOrRankKey(child)
  );
}

const [manifest, rule, classificationSummary, foundation, facilities] = await Promise.all([
  readJson(path.join(publicRoot, "download-manifest.json")),
  readJson(path.join(tractRoot, "access-gap-rule.v1.json")),
  readJson(path.join(tractRoot, "access-gap-rule-v1-summary.json")),
  readJson(path.join(tractRoot, "tract-foundation.json")),
  readJson(path.join(root, "public", "data", "healthcare", "facilities.json"))
]);

assert(manifest.ruleVersion === "1.0.0", "Download manifest has the wrong rule version.");
assert(manifest.schemaVersion === "1.1.0", "Download manifest has the wrong schema version.");
assert(manifest.stateFips === "34", "Download manifest must stay New Jersey only.");
assert(manifest.countyCount === 21, "Download manifest must list 21 counties.");
assert(manifest.tractCount === 2181, "Download manifest must list 2,181 tracts.");
assert(manifest.tractRecords.counties.length === 21, "Download manifest county shards are incomplete.");
assert(manifest.distanceMethod.name === "Haversine great-circle distance", "Distance method is not documented.");
assert(manifest.distanceMethod.earthRadiusMiles === earthRadiusMiles, "Distance Earth radius drifted.");

const foundationByGeoid = new Map(
  foundation.records.map((record) => [record.geography.geoid, record])
);
const safetyNetFacilities = facilities.filter(
  (facility) =>
    facility.state === "NJ" &&
    facility.facilityType === "community_health_center" &&
    Number.isFinite(facility.latitude) &&
    Number.isFinite(facility.longitude)
);
const njCmsFacilities = facilities.filter(
  (facility) =>
    facility.state === "NJ" &&
    facility.facilityType === "hospital" &&
    Number.isFinite(facility.latitude) &&
    Number.isFinite(facility.longitude)
);
assert(safetyNetFacilities.length > 0, "No mappable New Jersey HRSA centers were loaded.");
assert(
  new Set(safetyNetFacilities.map((facility) => facility.id)).size === safetyNetFacilities.length,
  "New Jersey HRSA center IDs must be unique."
);
const requiredIds = [
  rule.communityHealthNeed,
  rule.socialBarriers,
  rule.documentedShortage
].flatMap(({ requiredMeasures }) => requiredMeasures.map(({ id }) => id));
assert(requiredIds.length === 7, "Rule must retain seven required inputs.");
const contextIds = rule.contextOnlyMeasures.ids;
assert(contextIds.length === 11, "Rule must retain eleven additional context measures.");
const allowedStates = new Set(Object.keys(rule.stateLabels));
const stateCounts = Object.fromEntries([...allowedStates].map((state) => [state, 0]));
const allRecords = [];
const seenGeoids = new Set();

for (const county of manifest.tractRecords.counties) {
  assert(/^\d{3}$/.test(county.countyFips), `Invalid county FIPS ${county.countyFips}.`);
  const jsonPath = path.join(publicRoot, "tracts", "by-county", `${county.countyFips}.json`);
  const csvPath = path.join(publicRoot, "tracts", "by-county", `${county.countyFips}.csv`);
  const geometryPath = path.join(tractRoot, "by-county", `${county.countyFips}.geojson`);
  const classificationPath = path.join(
    tractRoot,
    "classifications",
    "access-gap-rule-v1",
    "by-county",
    `${county.countyFips}.json`
  );
  const [records, csvText, geometry, classifications] = await Promise.all([
    readJson(jsonPath),
    fs.readFile(csvPath, "utf8"),
    readJson(geometryPath),
    readJson(classificationPath)
  ]);
  const csvRows = parseCsvRows(csvText);
  const featureByGeoid = new Map(
    geometry.features.map((feature) => [feature.properties.GEOID, feature])
  );
  const classificationByGeoid = new Map(
    classifications.map((classification) => [classification.geography.geoid, classification])
  );
  assert(records.length === county.tractCount, `${county.countyFips} JSON count drifted.`);
  assert(csvRows.length === records.length, `${county.countyFips} CSV count drifted.`);
  assert(records.length === classifications.length, `${county.countyFips} classification count drifted.`);

  for (const [index, record] of records.entries()) {
    const geoid = record.geography?.geoid;
    assert(/^34\d{9}$/.test(geoid), `${geoid} is not a New Jersey tract GEOID.`);
    assert(record.geography.countyFips === county.countyFips, `${geoid} is in the wrong public shard.`);
    assert(!seenGeoids.has(geoid), `Duplicate public tract record ${geoid}.`);
    seenGeoids.add(geoid);
    assert(record.schemaVersion === "1.1.0", `${geoid} has the wrong public-record schema version.`);
    assert(record.ruleVersion === rule.ruleVersion, `${geoid} has the wrong rule version.`);
    assert(allowedStates.has(record.screening.state), `${geoid} has an unknown screening state.`);
    assert(record.screening.label === rule.stateLabels[record.screening.state], `${geoid} label drifted.`);
    assert(record.screening.ruleInputs.length === 7, `${geoid} does not preserve seven rule inputs.`);
    assert(record.screening.ruleInputs.every((input) => requiredIds.includes(input.measureId)), `${geoid} includes an unexpected rule input.`);
    assert(record.screening.ruleInputs.every((input) => input.source?.url && input.checkedDate), `${geoid} rule inputs lack source links or dates.`);
    const observations = [
      ...record.evidence.communityHealthNeed,
      ...record.evidence.socialBarriers,
      ...record.evidence.officialShortage
    ];
    assert(observations.length === 18, `${geoid} does not preserve all 18 evidence observations.`);
    const observationIds = new Set(observations.map(({ measure }) => measure.id));
    assert([...requiredIds, ...contextIds].every((id) => observationIds.has(id)), `${geoid} is missing a required or context measure.`);
    assert(observations.every((observation) =>
      observation.source?.agency && observation.source?.dataset &&
      Number.isInteger(observation.source?.releaseYear) && observation.source?.url &&
      /^\d{4}-\d{2}-\d{2}$/.test(observation.provenance?.checkedDate) &&
      ["modeled", "derived", "designation", "unavailable"].includes(observation.estimateType)
    ), `${geoid} contains incomplete source, date or estimate metadata.`);
    assert(record.gapDrivers.length === 4, `${geoid} must publish four contextual gap-driver groups.`);
    assert(new Set(record.gapDrivers.map(({ id }) => id)).size === record.gapDrivers.length, `${geoid} has duplicate gap-driver groups.`);
    assert(record.gapDrivers.every((driver) =>
      driver.relatedMeasureIds.every((id) => observationIds.has(id)) &&
      driver.availableMeasureIds.every((id) => driver.relatedMeasureIds.includes(id)) &&
      driver.missingMeasureIds.every((id) => driver.relatedMeasureIds.includes(id)) &&
      /does not create, remove or change/i.test(driver.interpretation)
    ), `${geoid} has an invalid or overclaimed gap-driver group.`);
    assert(record.actionPaths.length >= 3 && record.actionPaths.length <= 4, `${geoid} has an unexpected action-path count.`);
    assert(new Set(record.actionPaths.map(({ id }) => id)).size === record.actionPaths.length, `${geoid} has duplicate action paths.`);
    assert(record.actionPaths.every((action) =>
      action.relatedMeasureIds.every((id) => observationIds.has(id)) &&
      /^https:\/\//.test(action.officialResource.url) &&
      /not a personalized recommendation or guaranteed solution/i.test(action.framing) &&
      action.limitation.length > 0
    ), `${geoid} has an invalid or overclaimed action path.`);
    const missingRequired = record.screening.ruleInputs.filter((input) => input.missing);
    assert(
      missingRequired.length === record.screening.findings.missingRequiredMeasureIds.length,
      `${geoid} required missingness drifted.`
    );
    assert(
      missingRequired.length > 0
        ? record.screening.state === "insufficient_evidence"
        : record.screening.state !== "insufficient_evidence",
      `${geoid} does not enforce Insufficient evidence precedence.`
    );
    assert(record.missingEvidence.every((missing) => missing.reason), `${geoid} has a missing value without a reason.`);
    assert(record.explanations.length > 0 && record.limitations.length > 0, `${geoid} lacks explanations or limitations.`);
    assert(!hasForbiddenScoreOrRankKey(record), `${geoid} contains a CareAtlas score or ranking key.`);

    const foundationRecord = foundationByGeoid.get(geoid);
    assert(foundationRecord, `${geoid} is not in the tract foundation.`);
    assert(
      record.documentedFacilityContext.countsByType.hrsaCommunityHealthCenters ===
        foundationRecord.documentedCapacity.hrsaHealthCenterCount,
      `${geoid} HRSA facility count drifted.`
    );
    assert(
      record.documentedFacilityContext.countsByType.cmsHospitals ===
        foundationRecord.documentedCapacity.cmsHospitalCount,
      `${geoid} CMS hospital count drifted.`
    );
    const feature = featureByGeoid.get(geoid);
    assert(feature, `${geoid} lacks geometry.`);
    const origin = record.geography.officialInternalPoint;
    assert(origin.latitude === Number(feature.properties.INTPTLAT), `${geoid} internal latitude drifted.`);
    assert(origin.longitude === Number(feature.properties.INTPTLON), `${geoid} internal longitude drifted.`);
    const expectedNearest = safetyNetFacilities
      .map((facility) => ({ facility, distance: distanceMiles(origin, facility) }))
      .sort((first, second) => first.distance - second.distance)[0];
    const nearest = record.documentedFacilityContext.nearestSourceBackedSafetyNetCenter;
    assert(nearest?.facility.facilityType === "community_health_center", `${geoid} nearest safety-net facility has the wrong type.`);
    assert(nearest.facility.id === expectedNearest.facility.id, `${geoid} nearest safety-net facility is not reproducible.`);
    assert(Math.abs(nearest.distanceMiles - Number(expectedNearest.distance.toFixed(2))) < 0.001, `${geoid} nearest distance drifted.`);
    assert(nearest.facility.source?.url && nearest.facility.source?.checkedDate, `${geoid} nearest facility lacks source metadata.`);
    assert(Array.isArray(nearest.facility.missingFields), `${geoid} nearest facility does not preserve missing fields.`);
    assert(nearest.distanceMethod.name === "Haversine great-circle distance", `${geoid} distance method drifted.`);

    const csv = csvRows[index];
    assert(csv.tract_geoid === geoid, `${geoid} CSV order or identifier drifted.`);
    assert(csv.screening_state === record.screening.state, `${geoid} CSV screening state drifted.`);
    assert(csv.rule_version === record.ruleVersion, `${geoid} CSV rule version drifted.`);
    assert(csv.hrsa_community_health_center_count === String(record.documentedFacilityContext.countsByType.hrsaCommunityHealthCenters), `${geoid} CSV HRSA count drifted.`);
    assert(csv.cms_hospital_count === String(record.documentedFacilityContext.countsByType.cmsHospitals), `${geoid} CSV CMS count drifted.`);
    assert(csv.nearest_safety_net_center_source_url === nearest.facility.source.url, `${geoid} CSV nearest source URL drifted.`);
    assert(csv.nearest_safety_net_center_checked_date === nearest.facility.source.checkedDate, `${geoid} CSV nearest checked date drifted.`);
    assert(csv.nearest_safety_net_center_phone === (nearest.facility.phone ?? ""), `${geoid} CSV nearest contact drifted.`);
    assert(csv.loaded_facilities_in_tract_json === JSON.stringify(record.documentedFacilityContext.loadedFacilitiesInTract), `${geoid} CSV in-tract facility context drifted.`);
    assert(csv.gap_drivers_json === JSON.stringify(record.gapDrivers), `${geoid} CSV gap-driver context drifted.`);
    assert(csv.action_paths_json === JSON.stringify(record.actionPaths), `${geoid} CSV action paths drifted.`);
    for (const measureId of observationIds) {
      assert(`${measureId}__value` in csv, `${geoid} CSV lacks ${measureId}.`);
      assert(`${measureId}__source_agency` in csv, `${geoid} CSV lacks ${measureId} source.`);
      assert(`${measureId}__checked_date` in csv, `${geoid} CSV lacks ${measureId} date.`);
    }
    stateCounts[record.screening.state] += 1;
    allRecords.push(record);
    assert(classificationByGeoid.get(geoid)?.state === record.screening.state, `${geoid} public state differs from Batch 7.`);
  }
}

assert(allRecords.length === 2181, `Expected 2,181 public tract records, found ${allRecords.length}.`);
for (const state of allowedStates) {
  assert(
    stateCounts[state] === classificationSummary.stateCounts[state],
    `Statewide ${state} total differs from Batch 7.`
  );
}
assert([...allowedStates].every((state) => stateCounts[state] > 0), "All four screening states must appear in production.");

const [countyRecords, countyCsvText, report] = await Promise.all([
  readJson(path.join(publicRoot, "counties", "new-jersey-counties.json")),
  fs.readFile(path.join(publicRoot, "counties", "new-jersey-counties.csv"), "utf8"),
  fs.readFile(path.join(publicRoot, "reports", "new-jersey-access-gap-report.md"), "utf8")
]);
const countyCsvRows = parseCsvRows(countyCsvText);
assert(countyRecords.length === 21 && countyCsvRows.length === 21, "County JSON/CSV must contain 21 records.");
const countyStateTotals = Object.fromEntries([...allowedStates].map((state) => [state, 0]));
let countyTractTotal = 0;
let hrsaTotal = 0;
let cmsTotal = 0;
for (const [index, county] of countyRecords.entries()) {
  assert(county.ruleVersion === rule.ruleVersion, `${county.geography.name} has the wrong rule version.`);
  assert(county.schemaVersion === "1.1.0", `${county.geography.name} has the wrong summary schema version.`);
  assert(county.measureCoverage.length === 18, `${county.geography.name} lacks evidence coverage.`);
  assert(county.requiredRuleInputs.length === 7, `${county.geography.name} lacks the rule contract.`);
  assert(county.explanations.some((text) => /does not average percentile ranks/i.test(text)), `${county.geography.name} lacks aggregation safety copy.`);
  assert(!hasForbiddenScoreOrRankKey(county), `${county.geography.name} contains a score or ranking key.`);
  const csv = countyCsvRows[index];
  assert(csv.county_geoid === county.geography.geoid, `${county.geography.name} CSV identifier drifted.`);
  countyTractTotal += county.tractCount;
  hrsaTotal += county.facilityCountsByType.hrsaCommunityHealthCenters;
  cmsTotal += county.facilityCountsByType.cmsHospitals;
  for (const state of allowedStates) {
    countyStateTotals[state] += county.screeningStateCounts[state];
    const expectedPercent = Number(((county.screeningStateCounts[state] / county.tractCount) * 100).toFixed(1));
    assert(county.screeningStatePercentagesOfTracts[state] === expectedPercent, `${county.geography.name}/${state} percentage drifted.`);
  }
}
assert(countyTractTotal === 2181, "County tract totals do not sum to 2,181.");
for (const state of allowedStates) {
  assert(
    countyStateTotals[state] === stateCounts[state],
    `County ${state} totals do not sum to the statewide total.`
  );
}
assert(
  hrsaTotal === safetyNetFacilities.length && cmsTotal === njCmsFacilities.length,
  "County facility-type totals drifted."
);

for (const phrase of [
  "Potential access gap",
  "Elevated need without documented shortage",
  "No current gap flag",
  "Insufficient evidence",
  "not a ranking",
  "not individual diagnoses",
  "survey-derived estimates",
  "official national percentile ranks",
  "defined population groups",
  "not diagnoses, clinical guidance or medical advice"
]) {
  assert(report.toLowerCase().includes(phrase.toLowerCase()), `Statewide report lacks required copy: ${phrase}.`);
}
assert(report.includes("| Atlantic County |") && report.includes("| Warren County |"), "Statewide report county table is incomplete.");

console.log("Batch 8 public record validation passed for 2,181 tract JSON/CSV rows, 21 county JSON/CSV summaries and the New Jersey report.");
console.log(JSON.stringify({ stateCounts, facilityCounts: { hrsaCommunityHealthCenters: hrsaTotal, cmsHospitals: cmsTotal } }));
