import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const tractRoot = path.join(projectRoot, "public", "data", "tracts", "nj");
const countyRoot = path.join(tractRoot, "by-county");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isBoundaryGeometry(geometry) {
  return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}

async function main() {
  const countyFiles = (await fs.readdir(countyRoot))
    .filter((fileName) => /^\d{3}\.geojson$/.test(fileName))
    .sort();
  const [foundation, assignmentsArtifact, coverage, facilities] = await Promise.all([
    readJson(path.join(tractRoot, "tract-foundation.json")),
    readJson(path.join(tractRoot, "facility-tract-assignments.json")),
    readJson(path.join(tractRoot, "coverage-summary.json")),
    readJson(path.join(projectRoot, "public", "data", "healthcare", "facilities.json"))
  ]);
  const geoids = new Set();
  const countyCounts = {};

  assert(countyFiles.length === 21, `Expected 21 New Jersey county shards, found ${countyFiles.length}.`);

  for (const fileName of countyFiles) {
    const countyFips = fileName.slice(0, 3);
    const geoJson = await readJson(path.join(countyRoot, fileName));
    assert(geoJson.type === "FeatureCollection", `${fileName} is not a FeatureCollection.`);
    assert(geoJson.metadata?.service === "tigerWMS_ACS2024", `${fileName} source is not pinned to ACS 2024 TIGERweb.`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(geoJson.metadata?.checkedDate), `${fileName} source checked date is missing.`);
    countyCounts[countyFips] = geoJson.features.length;

    for (const feature of geoJson.features) {
      const properties = feature.properties ?? {};
      assert(isBoundaryGeometry(feature.geometry), `${properties.GEOID ?? fileName} has invalid geometry.`);
      assert(/^34\d{9}$/.test(properties.GEOID), `${properties.GEOID ?? fileName} has an invalid NJ tract GEOID.`);
      assert(properties.COUNTYFP === countyFips, `${properties.GEOID} is in the wrong county shard.`);
      assert(properties.TRACTCE === properties.GEOID.slice(5), `${properties.GEOID} has a mismatched tract code.`);
      assert(!geoids.has(properties.GEOID), `Duplicate tract GEOID ${properties.GEOID}.`);
      geoids.add(properties.GEOID);
    }
  }

  assert(geoids.size === 2181, `Expected 2,181 tracts for the pinned 2024 vintage, found ${geoids.size}.`);
  assert(foundation.schemaVersion === "1.0.0", "Unexpected tract foundation schema version.");
  assert(foundation.records.length === geoids.size, "Foundation record count does not match tract geometry count.");

  for (const record of foundation.records) {
    assert(geoids.has(record.geography?.geoid), `Unknown foundation GEOID ${record.geography?.geoid}.`);
    assert(record.evidenceStatus?.classification === "not_evaluated", `${record.geography.geoid} must remain not evaluated.`);
    assert(record.evidenceStatus.missingRequiredLayers.length === 3, `${record.geography.geoid} must name all missing evidence layers.`);
    assert(!("score" in record), `${record.geography.geoid} must not publish a score.`);
    assert(record.documentedCapacity?.note.includes("not counted as primary-care"), `${record.geography.geoid} must keep CMS hospitals separate.`);
  }

  const assignments = Object.values(assignmentsArtifact.assignments ?? {});
  const expectedFacilityIds = new Set(
    facilities
      .filter(
        (facility) =>
          facility.state === "NJ" &&
          Number.isFinite(facility.latitude) &&
          Number.isFinite(facility.longitude)
      )
      .map((facility) => facility.id)
  );
  assert(assignmentsArtifact.unassignedFacilityIds.length === 0, "All mappable New Jersey facilities should be assigned to a tract.");
  assert(
    assignments.length === expectedFacilityIds.size,
    `Expected ${expectedFacilityIds.size} New Jersey facility assignments, found ${assignments.length}.`
  );
  assert(
    assignments.every((assignment) => expectedFacilityIds.has(assignment.facilityId)),
    "A tract assignment references a facility outside the current mappable New Jersey production set."
  );
  assert(assignments.every((assignment) => geoids.has(assignment.tractGeoid)), "An assignment references an unknown tract GEOID.");
  assert(coverage.tractCount === geoids.size, "Coverage tract count does not match geometry.");
  assert(coverage.countyCount === countyFiles.length, "Coverage county count does not match shards.");
  assert(JSON.stringify(coverage.tractCountsByCounty) === JSON.stringify(countyCounts), "Coverage county counts do not match geometry shards.");
  assert(coverage.classificationStatus === "not_evaluated", "Coverage must not publish an access-gap classification in Batch 4.");

  console.log(
    `New Jersey tract foundation validation passed for ${geoids.size} tracts, ${countyFiles.length} counties and ${assignments.length} facility assignments.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
