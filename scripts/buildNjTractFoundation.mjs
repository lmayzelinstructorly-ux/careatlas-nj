import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(projectRoot, "public", "data", "tracts", "nj");
const countyOutputRoot = path.join(outputRoot, "by-county");
const countyBoundaryPath = path.join(
  projectRoot,
  "public",
  "data",
  "counties",
  "by-state",
  "34.geojson"
);
const facilityPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
const sourceUrl =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/8/query?where=STATE%3D%2734%27&outFields=GEOID%2CSTATE%2CCOUNTY%2CTRACT%2CBASENAME%2CNAME%2CLSADC%2CFUNCSTAT%2CAREALAND%2CAREAWATER%2CCENTLAT%2CCENTLON%2CINTPTLAT%2CINTPTLON&returnGeometry=true&outSR=4326&geometryPrecision=5&orderByFields=GEOID&f=geojson";
const sourceMetadata = {
  agency: "U.S. Census Bureau",
  checkedDate: "2026-07-11",
  dataset: "TIGERweb ACS 2024 Census Tracts",
  geometryPrecision: 5,
  geographyVintage: "January 1, 2024",
  layer: "Census Tracts",
  layerId: 8,
  service: "tigerWMS_ACS2024",
  outputSpatialReference: "EPSG:4326",
  sourceUrl
};

function getArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function loadSourceGeoJson() {
  const inputPath = getArgument("input");

  if (inputPath) {
    return readJson(path.resolve(projectRoot, inputPath));
  }

  const response = await fetch(sourceUrl, {
    headers: { "user-agent": "CareAtlas tract foundation generator" }
  });

  if (!response.ok) {
    throw new Error(`Census tract download failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function getCountyNames(countyGeoJson) {
  return new Map(
    countyGeoJson.features.map((feature) => [
      String(feature.properties?.COUNTYFP ?? "").padStart(3, "0"),
      feature.properties?.NAMELSAD ?? feature.properties?.NAME ?? null
    ])
  );
}

function normalizeFeature(feature, countyNames) {
  const properties = feature.properties ?? {};
  const geoid = String(properties.GEOID ?? "");
  const countyFips = String(properties.COUNTY ?? "").padStart(3, "0");

  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: {
      STATEFP: "34",
      COUNTYFP: countyFips,
      TRACTCE: String(properties.TRACT ?? "").padStart(6, "0"),
      GEOID: geoid,
      NAME: properties.NAME,
      NAMELSAD: properties.NAME,
      STUSPS: "NJ",
      STATE_NAME: "New Jersey",
      NAMELSADCO: countyNames.get(countyFips),
      FUNCSTAT: properties.FUNCSTAT,
      ALAND: Number(properties.AREALAND),
      AWATER: Number(properties.AREAWATER),
      INTPTLAT: properties.INTPTLAT,
      INTPTLON: properties.INTPTLON
    }
  };
}

function visitCoordinates(coordinates, visitor) {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    visitor(coordinates[0], coordinates[1]);
    return;
  }
  for (const child of coordinates) visitCoordinates(child, visitor);
}

function getBounds(geometry) {
  const bounds = {
    maxLatitude: -Infinity,
    maxLongitude: -Infinity,
    minLatitude: Infinity,
    minLongitude: Infinity
  };
  visitCoordinates(geometry.coordinates, (longitude, latitude) => {
    bounds.maxLatitude = Math.max(bounds.maxLatitude, latitude);
    bounds.maxLongitude = Math.max(bounds.maxLongitude, longitude);
    bounds.minLatitude = Math.min(bounds.minLatitude, latitude);
    bounds.minLongitude = Math.min(bounds.minLongitude, longitude);
  });
  return bounds;
}

function pointInRing(longitude, latitude, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crosses =
      y > latitude !== previousY > latitude &&
      longitude < ((previousX - x) * (latitude - y)) / (previousY - y) + x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(longitude, latitude, polygon) {
  if (!pointInRing(longitude, latitude, polygon[0] ?? [])) return false;
  return !polygon.slice(1).some((hole) => pointInRing(longitude, latitude, hole));
}

function pointInGeometry(longitude, latitude, geometry) {
  if (geometry.type === "Polygon") {
    return pointInPolygon(longitude, latitude, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInPolygon(longitude, latitude, polygon));
  }
  return false;
}

function assignFacilities(features, facilities) {
  const indexedTracts = features.map((feature) => ({
    bounds: getBounds(feature.geometry),
    feature
  }));
  const assignments = {};
  const unassignedFacilityIds = [];

  for (const facility of facilities) {
    if (
      facility.state !== "NJ" ||
      !Number.isFinite(facility.latitude) ||
      !Number.isFinite(facility.longitude)
    ) {
      continue;
    }

    const match = indexedTracts.find(({ bounds, feature }) =>
      facility.longitude >= bounds.minLongitude &&
      facility.longitude <= bounds.maxLongitude &&
      facility.latitude >= bounds.minLatitude &&
      facility.latitude <= bounds.maxLatitude &&
      pointInGeometry(facility.longitude, facility.latitude, feature.geometry)
    );

    if (!match) {
      unassignedFacilityIds.push(facility.id);
      continue;
    }

    assignments[facility.id] = {
      facilityId: facility.id,
      facilityType: facility.facilityType,
      sourceDataset: facility.sourceDataset,
      tractGeoid: match.feature.properties.GEOID
    };
  }

  return { assignments, unassignedFacilityIds };
}

function buildFoundationRecords(features, assignments) {
  const facilitiesByTract = new Map();

  for (const assignment of Object.values(assignments)) {
    const records = facilitiesByTract.get(assignment.tractGeoid) ?? [];
    records.push(assignment);
    facilitiesByTract.set(assignment.tractGeoid, records);
  }

  return features.map((feature) => {
    const properties = feature.properties;
    const assignedFacilities = facilitiesByTract.get(properties.GEOID) ?? [];
    const healthCenterIds = assignedFacilities
      .filter((assignment) => assignment.facilityType === "community_health_center")
      .map((assignment) => assignment.facilityId)
      .sort();
    const hospitalIds = assignedFacilities
      .filter((assignment) => assignment.facilityType === "hospital")
      .map((assignment) => assignment.facilityId)
      .sort();

    return {
      schemaVersion: "1.0.0",
      geography: {
        type: "census_tract",
        geoid: properties.GEOID,
        stateFips: properties.STATEFP,
        countyFips: properties.COUNTYFP,
        tractCode: properties.TRACTCE,
        name: properties.NAMELSAD,
        countyName: properties.NAMELSADCO
      },
      documentedCapacity: {
        hrsaHealthCenterCount: healthCenterIds.length,
        hrsaHealthCenterIds: healthCenterIds,
        cmsHospitalCount: hospitalIds.length,
        cmsHospitalIds: hospitalIds,
        note: "CMS hospitals remain separate and are not counted as primary-care capacity."
      },
      evidenceStatus: {
        classification: "not_evaluated",
        missingRequiredLayers: [
          "community_health_need",
          "social_barriers",
          "official_shortage"
        ],
        note: "Batch 4 establishes geography and documented facility capacity only; no access-gap flag is calculated."
      },
      provenance: {
        boundarySource: sourceMetadata.dataset,
        boundarySourceUrl: sourceMetadata.sourceUrl,
        boundaryVintage: sourceMetadata.geographyVintage,
        boundaryCheckedDate: sourceMetadata.checkedDate,
        facilitySourceArtifact: "public/data/healthcare/facilities.json",
        generationScript: "scripts/buildNjTractFoundation.mjs"
      }
    };
  });
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

async function main() {
  const [sourceGeoJson, countyGeoJson, facilities] = await Promise.all([
    loadSourceGeoJson(),
    readJson(countyBoundaryPath),
    readJson(facilityPath)
  ]);
  const countyNames = getCountyNames(countyGeoJson);
  const features = sourceGeoJson.features
    .map((feature) => normalizeFeature(feature, countyNames))
    .sort((first, second) => first.properties.GEOID.localeCompare(second.properties.GEOID));

  if (features.length === 0) throw new Error("The Census source returned no New Jersey tracts.");

  await fs.rm(countyOutputRoot, { force: true, recursive: true });
  const featuresByCounty = new Map();
  for (const feature of features) {
    const countyFeatures = featuresByCounty.get(feature.properties.COUNTYFP) ?? [];
    countyFeatures.push(feature);
    featuresByCounty.set(feature.properties.COUNTYFP, countyFeatures);
  }

  for (const [countyFips, countyFeatures] of [...featuresByCounty].sort()) {
    await writeJson(path.join(countyOutputRoot, `${countyFips}.geojson`), {
      type: "FeatureCollection",
      name: `nj_tracts_2024_${countyFips}`,
      metadata: sourceMetadata,
      features: countyFeatures
    });
  }

  const { assignments, unassignedFacilityIds } = assignFacilities(features, facilities);
  const foundationRecords = buildFoundationRecords(features, assignments);
  const assignedValues = Object.values(assignments);
  const countyCounts = Object.fromEntries(
    [...featuresByCounty].sort().map(([countyFips, countyFeatures]) => [
      countyFips,
      countyFeatures.length
    ])
  );

  await Promise.all([
    writeJson(path.join(outputRoot, "facility-tract-assignments.json"), {
      schemaVersion: "1.0.0",
      generatedBy: "scripts/buildNjTractFoundation.mjs",
      assignments,
      unassignedFacilityIds: unassignedFacilityIds.sort()
    }),
    writeJson(path.join(outputRoot, "tract-foundation.json"), {
      schemaVersion: "1.0.0",
      geographyVintage: sourceMetadata.geographyVintage,
      records: foundationRecords
    }),
    writeJson(path.join(outputRoot, "coverage-summary.json"), {
      schemaVersion: "1.0.0",
      pilotState: "New Jersey",
      stateFips: "34",
      tractCount: features.length,
      countyCount: featuresByCounty.size,
      tractCountsByCounty: countyCounts,
      assignedFacilityCount: assignedValues.length,
      assignedHrsaHealthCenterCount: assignedValues.filter(
        (assignment) => assignment.facilityType === "community_health_center"
      ).length,
      assignedCmsHospitalCount: assignedValues.filter(
        (assignment) => assignment.facilityType === "hospital"
      ).length,
      unassignedFacilityCount: unassignedFacilityIds.length,
      missingEvidenceLayers: [
        "community_health_need",
        "social_barriers",
        "official_shortage"
      ],
      classificationStatus: "not_evaluated",
      source: sourceMetadata
    })
  ]);

  console.log(
    `Wrote ${features.length} official New Jersey census tracts across ${featuresByCounty.size} county shards.`
  );
  console.log(
    `Assigned ${assignedValues.length} source-backed NJ facilities; ${unassignedFacilityIds.length} remained unassigned.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
