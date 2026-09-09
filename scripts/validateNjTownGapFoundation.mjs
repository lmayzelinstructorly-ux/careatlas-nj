import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tractRoot = path.join(root, "public", "data", "tracts", "nj");
const townRoot = path.join(tractRoot, "town-foundation");
const states = [
  "potential_access_gap",
  "elevated_need_without_documented_shortage",
  "no_current_gap_flag",
  "insufficient_evidence"
];

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function emptyStateCounts() {
  return Object.fromEntries(states.map((state) => [state, 0]));
}

function addStateCounts(target, source) {
  for (const state of states) target[state] += source[state];
}

const [summary, townGeoJson, ruleSummary] = await Promise.all([
  readJson(path.join(townRoot, "summary.json")),
  readJson(path.join(root, "public", "data", "cousubs", "by-state", "34.geojson")),
  readJson(path.join(tractRoot, "access-gap-rule-v1-summary.json"))
]);

assert.equal(summary.schemaVersion, "1.0.0");
assert.equal(summary.ruleVersion, "1.0.0");
assert.equal(summary.counts.countyCount, 21);
assert.equal(summary.counts.townCount, 564);
assert.equal(summary.counts.tractCount, 2181);
assert.equal(summary.counties.length, 21);
assert.equal(summary.projection.name, "Spherical Lambert azimuthal equal-area");
assert(
  summary.publicUseGuardrails.some((guardrail) =>
    guardrail.includes("Do not label a town as an access gap")
  ),
  "Town foundation lost its no-town-classification guardrail."
);
assert(
  summary.publicUseGuardrails.some((guardrail) =>
    guardrail.includes("not interpret polygon area shares as population shares")
  ),
  "Town foundation lost its population-share guardrail."
);

const officialTownGeoids = new Set(
  townGeoJson.features.map((feature) => String(feature.properties?.GEOID ?? ""))
);
assert.equal(officialTownGeoids.size, 564, "Official New Jersey town GEOIDs drifted.");

const seenTownGeoids = new Set();
const seenTractGeoids = new Set();
const allTracts = [];
const allTowns = [];
const classificationStateCounts = emptyStateCounts();
const assignedStateCounts = emptyStateCounts();
const unassignedStateCounts = emptyStateCounts();
let primaryAssignmentTotal = 0;
let overlapRecordTotal = 0;
let fallbackAssignmentTotal = 0;
let unassignedTractTotal = 0;

for (const county of summary.counties) {
  assert(/^\d{3}$/.test(county.countyFips), `Invalid county FIPS ${county.countyFips}.`);
  assert.equal(
    county.url,
    `/data/tracts/nj/town-foundation/by-county/${county.countyFips}.json`
  );
  const [artifact, classifications] = await Promise.all([
    readJson(path.join(townRoot, "by-county", `${county.countyFips}.json`)),
    readJson(
      path.join(
        tractRoot,
        "classifications",
        "access-gap-rule-v1",
        "by-county",
        `${county.countyFips}.json`
      )
    )
  ]);
  assert.equal(artifact.recordType, "county_tract_to_town_foundation");
  assert.equal(artifact.countyFips, county.countyFips);
  assert.equal(artifact.towns.length, county.townCount);
  assert.equal(artifact.tracts.length, county.tractCount);
  assert(
    artifact.limitations.some((limitation) =>
      limitation.includes("do not classify or score an entire town")
    )
  );
  assert(
    artifact.limitations.some((limitation) =>
      limitation.includes("not population-weighted")
    )
  );
  const classificationByGeoid = new Map(
    classifications.map((classification) => [
      classification.geography.geoid,
      classification
    ])
  );

  for (const tract of artifact.tracts) {
    const geoid = tract.geography.geoid;
    assert(/^34\d{9}$/.test(geoid), `Invalid tract GEOID ${geoid}.`);
    assert(!seenTractGeoids.has(geoid), `Duplicate tract ${geoid}.`);
    seenTractGeoids.add(geoid);
    assert.equal(tract.geography.countyFips, county.countyFips);
    assert(states.includes(tract.screeningState), `${geoid} has an invalid state.`);
    assert.equal(
      tract.screeningState,
      classificationByGeoid.get(geoid)?.state,
      `${geoid} screening state drifted from the classification shard.`
    );
    assert(
      tract.mappedPolygonAreaShare >= 0 && tract.mappedPolygonAreaShare <= 1.01,
      `${geoid} has an invalid mapped polygon share.`
    );
    classificationStateCounts[tract.screeningState] += 1;
    overlapRecordTotal += tract.overlaps.length;
    const primaryOverlaps = tract.overlaps.filter(
      (overlap) => overlap.isPrimaryAssignment
    );
    for (const overlap of tract.overlaps) {
      assert(officialTownGeoids.has(overlap.townGeoid));
      assert(overlap.intersectionAreaSquareMeters >= 0);
      assert(
        overlap.shareOfTractPolygonArea >= 0 &&
          overlap.shareOfTractPolygonArea <= 1.01
      );
      assert(
        overlap.shareOfTownPolygonArea >= 0 && overlap.shareOfTownPolygonArea <= 1.01
      );
    }

    if (tract.primaryTown.geoid === null) {
      unassignedTractTotal += 1;
      unassignedStateCounts[tract.screeningState] += 1;
      assert.equal(primaryOverlaps.length, 0);
      assert.equal(
        tract.primaryTown.assignmentMethod,
        "unassigned_no_town_polygon_overlap"
      );
    } else {
      primaryAssignmentTotal += 1;
      assignedStateCounts[tract.screeningState] += 1;
      assert(officialTownGeoids.has(tract.primaryTown.geoid));
      assert.equal(primaryOverlaps.length, 1, `${geoid} must have one primary overlap.`);
      assert.equal(primaryOverlaps[0].townGeoid, tract.primaryTown.geoid);
      assert(
        [
          "official_tract_internal_point",
          "largest_equal_area_polygon_overlap_fallback"
        ].includes(tract.primaryTown.assignmentMethod)
      );
      if (
        tract.primaryTown.assignmentMethod ===
        "largest_equal_area_polygon_overlap_fallback"
      ) {
        fallbackAssignmentTotal += 1;
        assert(
          primaryOverlaps[0].shareOfTractPolygonArea >=
            artifact.method.minimumFallbackTractShare,
          `${geoid} fallback assignment is below the disclosed threshold.`
        );
      }
    }
    allTracts.push(tract);
  }

  for (const town of artifact.towns) {
    const geoid = town.geography.geoid;
    assert(officialTownGeoids.has(geoid), `Unknown town GEOID ${geoid}.`);
    assert(!seenTownGeoids.has(geoid), `Duplicate town ${geoid}.`);
    seenTownGeoids.add(geoid);
    assert.equal(town.recordType, "town_tract_screening_context");
    assert.equal(town.geography.countyFips, county.countyFips);
    assert(!Object.hasOwn(town, "state"));
    assert(!Object.hasOwn(town, "classification"));
    const primaryTracts = artifact.tracts.filter(
      (tract) => tract.primaryTown.geoid === geoid
    );
    const intersectingTracts = artifact.tracts.filter((tract) =>
      tract.overlaps.some((overlap) => overlap.townGeoid === geoid)
    );
    const expectedPrimaryCounts = emptyStateCounts();
    const expectedIntersectingCounts = emptyStateCounts();
    for (const tract of primaryTracts) expectedPrimaryCounts[tract.screeningState] += 1;
    for (const tract of intersectingTracts) {
      expectedIntersectingCounts[tract.screeningState] += 1;
    }
    assert.equal(town.tractContext.primaryAssignedTractCount, primaryTracts.length);
    assert.equal(town.tractContext.intersectingTractCount, intersectingTracts.length);
    assert.deepEqual(
      town.tractContext.screeningStateCountsForPrimaryAssignedTracts,
      expectedPrimaryCounts
    );
    assert.deepEqual(
      town.tractContext.screeningStateCountsForIntersectingTracts,
      expectedIntersectingCounts
    );
    assert.equal(
      town.dataQuality.hasPrimaryAssignedTracts,
      primaryTracts.length > 0
    );
    allTowns.push(town);
  }
}

assert.equal(seenTractGeoids.size, 2181);
assert.equal(seenTownGeoids.size, 564);
assert.deepEqual(seenTownGeoids, officialTownGeoids);
assert.deepEqual(classificationStateCounts, ruleSummary.stateCounts);
assert.deepEqual(
  summary.counts.primaryAssignedScreeningStateCounts,
  assignedStateCounts
);
assert.deepEqual(summary.counts.unassignedScreeningStateCounts, unassignedStateCounts);
assert.equal(primaryAssignmentTotal + unassignedTractTotal, 2181);
assert.equal(summary.counts.unassignedTractCount, unassignedTractTotal);
assert.equal(summary.counts.tractTownOverlapRecordCount, overlapRecordTotal);
assert.equal(
  summary.counts.crossTownTractCount,
  allTracts.filter((tract) => tract.crossesTownBoundary).length
);
assert.equal(
  summary.counts.townsWithoutPrimaryAssignedTracts,
  allTowns.filter((town) => !town.dataQuality.hasPrimaryAssignedTracts).length
);
assert.equal(
  summary.counts.primaryAssignmentMethods
    .largest_equal_area_polygon_overlap_fallback ?? 0,
  fallbackAssignmentTotal
);
assert(unassignedTractTotal <= 10, "Too many tracts lack a town assignment.");
assert(fallbackAssignmentTotal <= 5, "Too many tracts require fallback assignment.");
assert(
  summary.mappingCoverage.meanTractPolygonAreaShare >= 0.95,
  "Mean tract-to-town polygon coverage fell below 95%."
);
assert(
  summary.counts.tractsBelowFiftyPercentMappedPolygonArea <= 40,
  "Too many tracts have less than 50% mapped town polygon coverage."
);
assert.equal(
  allTowns.reduce(
    (total, town) => total + town.tractContext.primaryAssignedTractCount,
    0
  ),
  primaryAssignmentTotal
);

console.log(
  `New Jersey town gap foundation validation passed for ${seenTractGeoids.size} tracts and ${seenTownGeoids.size} towns; ${unassignedTractTotal} tracts remain explicitly unassigned.`
);
