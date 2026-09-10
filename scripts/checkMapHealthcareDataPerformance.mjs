import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

const [
  map,
  markers,
  facilitiesHook,
  internalReview,
  countySource,
  facilitySource,
  newJerseyShardSource
] = await Promise.all([
  read("src/components/CareAtlasMap.tsx"),
  read("src/components/HealthcareFacilityMarkers.tsx"),
  read("src/hooks/useHealthcareFacilities.ts"),
  read("src/pages/InternalDataReviewPage.tsx"),
  read("public/data/counties/by-state/34.geojson"),
  read("public/data/healthcare/facilities.json"),
  read("public/data/healthcare/by-state/34.json")
]);
const activeRuntime = `${map}\n${markers}\n${facilitiesHook}`;

assert(
  map.includes('useHealthcareFacilities(mapMode !== "doctor_offices", "new-jersey")'),
  "The public map must request only the New Jersey facility shard in healthcare and gap modes, not in the separate doctor-office mode."
);
assert(
  facilitiesHook.includes('"/data/healthcare/by-state/34.json"'),
  "New Jersey public mode must request the validated state shard."
);
assert(
  internalReview.includes("useHealthcareFacilities(true)"),
  "The development-only data review must retain access to the complete production dataset."
);
assert(
  map.includes("HealthcareFacilityMarkers"),
  "The public map must render the healthcare marker layer."
);
assert(
  markers.includes("getCountyGroups") && markers.includes("getLocalGroups"),
  "County and local clustering paths must both remain active."
);

for (const excludedRuntime of [
  "useHealthcareCoverageSummary",
  "useBoundaryHealthcareSummaries",
  "boundary-healthcare-summaries.json",
  "coverage-summary.json",
  "HealthcareFacilityExplorer",
  "HealthcareMapFilters"
]) {
  assert(
    !activeRuntime.includes(excludedRuntime),
    `${excludedRuntime} must stay out of the focused public marker runtime.`
  );
}

function isPointInRing(latitude, longitude, ring) {
  let isInside = false;

  for (
    let index = 0, previousIndex = ring.length - 1;
    index < ring.length;
    previousIndex = index++
  ) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previousIndex];
    const crossesLatitude =
      currentLatitude > latitude !== previousLatitude > latitude;
    const crossingLongitude =
      ((previousLongitude - currentLongitude) *
        (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude;

    if (crossesLatitude && longitude < crossingLongitude) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function isPointInPolygon(latitude, longitude, polygon) {
  return Boolean(
    polygon[0] &&
      isPointInRing(latitude, longitude, polygon[0]) &&
      polygon
        .slice(1)
        .every((hole) => !isPointInRing(latitude, longitude, hole))
  );
}

function isPointInFeature(latitude, longitude, feature) {
  if (feature.geometry.type === "Polygon") {
    return isPointInPolygon(latitude, longitude, feature.geometry.coordinates);
  }

  return (
    feature.geometry.type === "MultiPolygon" &&
    feature.geometry.coordinates.some((polygon) =>
      isPointInPolygon(latitude, longitude, polygon)
    )
  );
}

const counties = JSON.parse(countySource).features;
const facilities = JSON.parse(facilitySource);
const newJerseyFacilities = JSON.parse(newJerseyShardSource);
const expectedNewJerseyFacilities = facilities.filter(
  (facility) =>
    facility.stateFips === "34" ||
    String(facility.state).toUpperCase() === "NJ"
);

assert.deepEqual(
  newJerseyFacilities,
  expectedNewJerseyFacilities,
  "The New Jersey shard must exactly match the source-backed New Jersey production records."
);

const mappableFacilities = newJerseyFacilities.filter(
  (facility) =>
    Number.isFinite(facility.latitude) &&
    Number.isFinite(facility.longitude)
);

assert(
  mappableFacilities.length > 0,
  "At least one New Jersey healthcare location must be available."
);
assert.equal(
  mappableFacilities.length,
  newJerseyFacilities.length,
  "Every public New Jersey facility must have valid coordinates."
);

const countiesWithFacilities = new Set();

for (const facility of mappableFacilities) {
  const matchingCounties = counties.filter((county) =>
    isPointInFeature(facility.latitude, facility.longitude, county)
  );

  assert.equal(
    matchingCounties.length,
    1,
    `${facility.id} must fall inside exactly one official New Jersey county boundary.`
  );
  countiesWithFacilities.add(String(matchingCounties[0].properties.GEOID));
}

assert.equal(
  countiesWithFacilities.size,
  counties.length,
  "Every New Jersey county must have a county-level facility count marker."
);

const sourceBuffer = Buffer.from(facilitySource);
const shardBuffer = Buffer.from(newJerseyShardSource);
const sourceGzipBytes = gzipSync(sourceBuffer, { level: 9 }).byteLength;
const shardGzipBytes = gzipSync(shardBuffer, { level: 9 }).byteLength;

assert(
  shardBuffer.byteLength <= sourceBuffer.byteLength * 0.1,
  "The New Jersey public shard must remain at least 90% smaller than the multi-state source file."
);
assert(
  shardGzipBytes <= sourceGzipBytes * 0.1,
  "The compressed New Jersey public shard must remain at least 90% smaller than the multi-state source file."
);

const distShardPath = path.join(
  root,
  "dist",
  "data",
  "healthcare",
  "by-state",
  "34.json"
);
const distFullPath = path.join(
  root,
  "dist",
  "data",
  "healthcare",
  "facilities.json"
);
const distShard = await readFile(distShardPath);
assert.equal(
  distShard.byteLength,
  shardBuffer.byteLength,
  "The deployed New Jersey shard must match the validated source shard."
);
await assert.rejects(
  stat(distFullPath),
  { code: "ENOENT" },
  "The unused multi-state facilities file must not be included in production dist."
);

const rawReduction = (
  100 *
  (1 - shardBuffer.byteLength / sourceBuffer.byteLength)
).toFixed(1);
const gzipReduction = (
  100 *
  (1 - shardGzipBytes / sourceGzipBytes)
).toFixed(1);

console.log(
  `Map healthcare runtime check passed: ${mappableFacilities.length} New Jersey facilities exactly match the validated source and cover all ${counties.length} counties.`
);
console.log(
  `Public facility payload: ${sourceBuffer.byteLength.toLocaleString()} -> ${shardBuffer.byteLength.toLocaleString()} raw bytes (${rawReduction}% smaller); ${sourceGzipBytes.toLocaleString()} -> ${shardGzipBytes.toLocaleString()} gzip bytes (${gzipReduction}% smaller).`
);
