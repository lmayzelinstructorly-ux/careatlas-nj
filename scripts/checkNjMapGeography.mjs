import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import polygonClipping from "polygon-clipping";

const { difference, intersection } = polygonClipping;

const root = path.resolve(import.meta.dirname, "..");
const dataRoot = path.join(root, "public", "data");
const tractRoot = path.join(dataRoot, "tracts", "nj");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function toMultiPolygon(geometry) {
  assert(
    geometry?.type === "Polygon" || geometry?.type === "MultiPolygon",
    `Expected Polygon or MultiPolygon, received ${geometry?.type ?? "missing geometry"}.`
  );
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function ringArea(ring) {
  let sum = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    sum +=
      ring[previous][0] * ring[index][1] -
      ring[index][0] * ring[previous][1];
  }
  return Math.abs(sum / 2);
}

function multiPolygonArea(multiPolygon) {
  return (multiPolygon ?? []).reduce(
    (total, polygon) =>
      total +
      ringArea(polygon[0] ?? []) -
      polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0),
    0
  );
}

function assertClippedInsideBoundary(clipped, boundary, label) {
  const clippedArea = multiPolygonArea(clipped);
  assert(clippedArea > 0, `${label} has no visible intersection with its assigned boundary.`);
  const boundaryPositions = boundary.flat(2);
  const longitudes = boundaryPositions.map((position) => position[0]);
  const latitudes = boundaryPositions.map((position) => position[1]);
  const bounds = {
    maxLatitude: Math.max(...latitudes),
    maxLongitude: Math.max(...longitudes),
    minLatitude: Math.min(...latitudes),
    minLongitude: Math.min(...longitudes)
  };

  for (const [longitude, latitude] of clipped.flat(2)) {
    assert(
      longitude >= bounds.minLongitude - 1e-9 &&
        longitude <= bounds.maxLongitude + 1e-9 &&
        latitude >= bounds.minLatitude - 1e-9 &&
        latitude <= bounds.maxLatitude + 1e-9,
      `${label} produced a clipped coordinate outside its parent bounds.`
    );
  }
}

const [countyCollection, townCollection] = await Promise.all([
  readJson(path.join(dataRoot, "counties", "by-state", "34.geojson")),
  readJson(path.join(dataRoot, "cousubs", "by-state", "34.geojson"))
]);

assert.equal(countyCollection.features.length, 21, "New Jersey county count drifted.");
assert.equal(townCollection.features.length, 564, "New Jersey town count drifted.");

const countyByFips = new Map(
  countyCollection.features.map((county) => [
    String(county.properties?.COUNTYFP ?? ""),
    county
  ])
);

let tractCount = 0;
let potentialGapCount = 0;
let sourceTractsCrossingDisplayCounty = 0;
let waterOnlyTractCount = 0;

for (const [countyFips, county] of countyByFips) {
  assert(/^\d{3}$/.test(countyFips), `Invalid county FIPS ${countyFips}.`);
  const [tractCollection, classifications] = await Promise.all([
    readJson(path.join(tractRoot, "by-county", `${countyFips}.geojson`)),
    readJson(
      path.join(
        tractRoot,
        "classifications",
        "access-gap-rule-v1",
        "by-county",
        `${countyFips}.json`
      )
    )
  ]);
  const classificationByGeoid = new Map(
    classifications.map((record) => [record.geography.geoid, record])
  );
  const tractGeoids = new Set(
    tractCollection.features.map((feature) => String(feature.properties?.GEOID ?? ""))
  );

  assert.equal(
    classificationByGeoid.size,
    tractGeoids.size,
    `Classification/geometry count mismatch for county ${countyFips}.`
  );

  const countyGeometry = toMultiPolygon(county.geometry);

  for (const tract of tractCollection.features) {
    tractCount += 1;
    const geoid = String(tract.properties?.GEOID ?? "");
    const classification = classificationByGeoid.get(geoid);
    assert(/^34\d{9}$/.test(geoid), `Invalid tract GEOID ${geoid}.`);
    assert.equal(geoid.slice(2, 5), countyFips, `${geoid} is in the wrong county shard.`);
    assert.equal(String(tract.properties?.COUNTYFP ?? ""), countyFips);
    assert(classification, `${geoid} is missing its screening classification.`);
    assert.equal(classification.geography.countyFips, countyFips);

    const tractGeometry = toMultiPolygon(tract.geometry);
    const tractArea = multiPolygonArea(tractGeometry);
    const originalOutsideArea = multiPolygonArea(
      difference(tractGeometry, countyGeometry)
    );
    if (originalOutsideArea > Math.max(1e-12, tractArea * 1e-6)) {
      sourceTractsCrossingDisplayCounty += 1;
    }

    const landArea = Number(
      tract.properties?.ALAND ?? tract.properties?.AREALAND ?? Number.NaN
    );
    if (landArea === 0) {
      waterOnlyTractCount += 1;
      continue;
    }

    const clipped = intersection(tractGeometry, countyGeometry);
    assertClippedInsideBoundary(clipped, countyGeometry, `Tract ${geoid}`);

    if (classification.state === "potential_access_gap") {
      potentialGapCount += 1;
    }
  }

  for (const geoid of classificationByGeoid.keys()) {
    assert(tractGeoids.has(geoid), `${geoid} has a classification but no tract geometry.`);
  }
}

for (const town of townCollection.features) {
  const geoid = String(town.properties?.GEOID ?? "");
  const countyFips = String(town.properties?.COUNTYFP ?? "");
  const county = countyByFips.get(countyFips);
  assert(/^34\d{8}$/.test(geoid), `Invalid town GEOID ${geoid}.`);
  assert(county, `${geoid} references missing county ${countyFips}.`);
  const countyGeometry = toMultiPolygon(county.geometry);
  const clipped = intersection(toMultiPolygon(town.geometry), countyGeometry);
  assertClippedInsideBoundary(clipped, countyGeometry, `Town ${geoid}`);
}

assert.equal(tractCount, 2181, "New Jersey tract count drifted.");
assert.equal(potentialGapCount, 359, "Potential-gap tract count drifted.");
assert.equal(waterOnlyTractCount, 6, "Water-only tract count drifted.");
assert(
  sourceTractsCrossingDisplayCounty > 0,
  "The source-vintage alignment audit unexpectedly found no tract/county edge differences."
);

console.log(
  `New Jersey map geography passed: 21 counties, 564 towns and ${tractCount - waterOnlyTractCount} land tracts clip inside their displayed parent boundaries; ${waterOnlyTractCount} water-only tracts are excluded from the public map.`
);
