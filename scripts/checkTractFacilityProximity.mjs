import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const utilityPath = path.join(root, "src", "utils", "tractFacilityProximity.ts");
const source = await readFile(utilityPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  },
  fileName: utilityPath,
  reportDiagnostics: true
});

assert.equal(compiled.diagnostics?.length ?? 0, 0, "Proximity utility did not transpile cleanly.");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
const { getTractFacilityProximity } = await import(moduleUrl);

function facility({
  facilityType = "community_health_center",
  id,
  latitude,
  longitude,
  sourceBacked = true,
  state = "NJ"
}) {
  return {
    id,
    name: id,
    facilityType,
    address: "1 Test St",
    city: "Test",
    state,
    latitude,
    longitude,
    services: [],
    hours: {},
    priceInfo: { priceLevel: "unknown" },
    insuranceInfo: {},
    sourceInfo: sourceBacked
      ? {
          sourceName: "Fixture source",
          sourceUrl: "https://example.org/source.csv",
          lastChecked: "2026-07-14"
        }
      : undefined,
    verificationStatus: "needs_review"
  };
}

const fixture = getTractFacilityProximity(
  { latitude: 0, longitude: 0 },
  [
    facility({ id: "near", latitude: 0, longitude: 0.01 }),
    facility({ id: "middle", latitude: 0, longitude: 0.1 }),
    facility({ id: "far", latitude: 0, longitude: 0.2 }),
    facility({ id: "hospital", facilityType: "hospital", latitude: 0, longitude: 0.001 }),
    facility({ id: "unbacked", latitude: 0, longitude: 0.001, sourceBacked: false }),
    facility({ id: "other-state", latitude: 0, longitude: 0.001, state: "PA" })
  ]
);

assert.deepEqual(
  fixture.nearestCenters.map(({ facility: current }) => current.id),
  ["near", "middle", "far"],
  "Nearest centers must be distance ordered and exclude hospitals, unbacked records and other states."
);
assert.equal(fixture.withinFiveMiles, 1, "Five-mile count drifted.");
assert.equal(fixture.withinTenMiles, 2, "Ten-mile count drifted.");
assert.match(fixture.nearestCenters[0].directionsUrl, /google\.com\/maps\/dir/iu, "Directions URL is missing.");

const [facilities, morrisRecords] = await Promise.all([
  readFile(path.join(root, "public", "data", "healthcare", "facilities.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "public", "data", "tracts", "nj", "public-records", "tracts", "by-county", "027.json"), "utf8").then(JSON.parse)
]);
const doverRecord = morrisRecords.find(
  (record) => record.geography.geoid === "34027044800"
);
assert(doverRecord, "Dover fixture tract is missing from the public records.");
const production = getTractFacilityProximity(
  doverRecord.geography.officialInternalPoint,
  facilities
);
const retainedNearest =
  doverRecord.documentedFacilityContext.nearestSourceBackedSafetyNetCenter;

assert(production.nearestCenters.length === 3, "Production context must expose three nearest centers.");
assert.equal(
  production.nearestCenters[0].facility.id,
  retainedNearest.facility.id,
  "Client proximity and the validated Batch 8 nearest center disagree."
);
assert.equal(
  production.nearestCenters[0].distanceMiles,
  retainedNearest.distanceMiles,
  "Client proximity and the validated Batch 8 nearest distance disagree."
);
assert(
  production.withinFiveMiles <= production.withinTenMiles,
  "Distance-band counts are not monotonic."
);

console.log(
  `Tract facility proximity check passed: ${production.withinFiveMiles} source-backed centers within 5 miles and ${production.withinTenMiles} within 10 miles of the Dover fixture tract reference point.`
);
