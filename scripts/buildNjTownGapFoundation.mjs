import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import polygonClipping from "polygon-clipping";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tractRoot = path.join(projectRoot, "public", "data", "tracts", "nj");
const tractGeometryRoot = path.join(tractRoot, "by-county");
const classificationRoot = path.join(
  tractRoot,
  "classifications",
  "access-gap-rule-v1",
  "by-county"
);
const townGeometryPath = path.join(
  projectRoot,
  "public",
  "data",
  "cousubs",
  "by-state",
  "34.geojson"
);
const outputRoot = path.join(tractRoot, "town-foundation");
const outputCountyRoot = path.join(outputRoot, "by-county");
const summaryPath = path.join(outputRoot, "summary.json");
const generatedDate = "2026-07-14";
const meaningfulShareThreshold = 0.005;
const minimumFallbackTractShare = 0.25;
const earthRadiusMeters = 6_371_008.8;
const projectionCenter = {
  latitude: 40.15,
  longitude: -74.7
};
const screeningStates = [
  "potential_access_gap",
  "elevated_need_without_documented_shortage",
  "no_current_gap_flag",
  "insufficient_evidence"
];

function toRadians(value) {
  return (value * Math.PI) / 180;
}

const centerLatitudeRadians = toRadians(projectionCenter.latitude);
const centerLongitudeRadians = toRadians(projectionCenter.longitude);

function projectPosition([longitude, latitude]) {
  const latitudeRadians = toRadians(latitude);
  const longitudeRadians = toRadians(longitude);
  const longitudeDelta = longitudeRadians - centerLongitudeRadians;
  const denominator =
    1 +
    Math.sin(centerLatitudeRadians) * Math.sin(latitudeRadians) +
    Math.cos(centerLatitudeRadians) *
      Math.cos(latitudeRadians) *
      Math.cos(longitudeDelta);
  const scale = Math.sqrt(2 / denominator);

  return [
    earthRadiusMeters *
      scale *
      Math.cos(latitudeRadians) *
      Math.sin(longitudeDelta),
    earthRadiusMeters *
      scale *
      (Math.cos(centerLatitudeRadians) * Math.sin(latitudeRadians) -
        Math.sin(centerLatitudeRadians) *
          Math.cos(latitudeRadians) *
          Math.cos(longitudeDelta))
  ];
}

function toMultiPolygon(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`Unsupported geometry type ${geometry.type}.`);
}

function projectMultiPolygon(multiPolygon) {
  return multiPolygon.map((polygon) =>
    polygon.map((ring) => ring.map(projectPosition))
  );
}

function signedRingArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [currentX, currentY] = ring[index];
    const [nextX, nextY] = ring[(index + 1) % ring.length];
    area += currentX * nextY - nextX * currentY;
  }
  return area / 2;
}

function multiPolygonArea(multiPolygon) {
  return multiPolygon.reduce(
    (total, polygon) =>
      total +
      Math.max(
        0,
        Math.abs(signedRingArea(polygon[0] ?? [])) -
          polygon
            .slice(1)
            .reduce((holeTotal, ring) => holeTotal + Math.abs(signedRingArea(ring)), 0)
      ),
    0
  );
}

function getBounds(geometry) {
  const positions = toMultiPolygon(geometry).flat(2);
  return positions.reduce(
    (bounds, [longitude, latitude]) => ({
      maxLatitude: Math.max(bounds.maxLatitude, latitude),
      maxLongitude: Math.max(bounds.maxLongitude, longitude),
      minLatitude: Math.min(bounds.minLatitude, latitude),
      minLongitude: Math.min(bounds.minLongitude, longitude)
    }),
    {
      maxLatitude: Number.NEGATIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
      minLatitude: Number.POSITIVE_INFINITY,
      minLongitude: Number.POSITIVE_INFINITY
    }
  );
}

function boundsOverlap(first, second) {
  return !(
    first.maxLatitude < second.minLatitude ||
    first.minLatitude > second.maxLatitude ||
    first.maxLongitude < second.minLongitude ||
    first.minLongitude > second.maxLongitude
  );
}

function pointInRing(latitude, longitude, ring) {
  let inside = false;
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
    if (crossesLatitude && longitude < crossingLongitude) inside = !inside;
  }
  return inside;
}

function pointInPolygon(latitude, longitude, polygon) {
  return (
    Boolean(polygon[0] && pointInRing(latitude, longitude, polygon[0])) &&
    polygon.slice(1).every((hole) => !pointInRing(latitude, longitude, hole))
  );
}

function pointInGeometry(latitude, longitude, geometry) {
  return toMultiPolygon(geometry).some((polygon) =>
    pointInPolygon(latitude, longitude, polygon)
  );
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function emptyStateCounts() {
  return Object.fromEntries(screeningStates.map((state) => [state, 0]));
}

function getTownRecord(feature) {
  const properties = feature.properties ?? {};
  const projectedGeometry = projectMultiPolygon(toMultiPolygon(feature.geometry));
  return {
    bounds: getBounds(feature.geometry),
    countyFips: String(properties.COUNTYFP ?? ""),
    countyName: String(properties.NAMELSADCO ?? ""),
    feature,
    geoid: String(properties.GEOID ?? ""),
    name: String(properties.NAMELSAD ?? properties.NAME ?? "Unnamed municipality"),
    polygonAreaSquareMeters: multiPolygonArea(projectedGeometry),
    projectedGeometry
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function buildTownSummary(town, primaryTracts, intersectingTracts) {
  const primaryStateCounts = emptyStateCounts();
  const intersectingStateCounts = emptyStateCounts();

  for (const tract of primaryTracts) primaryStateCounts[tract.screeningState] += 1;
  for (const tract of intersectingTracts) {
    intersectingStateCounts[tract.screeningState] += 1;
  }

  return {
    schemaVersion: "1.0.0",
    recordType: "town_tract_screening_context",
    geography: {
      type: "county_subdivision",
      geoid: town.geoid,
      stateFips: "34",
      countyFips: town.countyFips,
      name: town.name,
      countyName: town.countyName
    },
    tractContext: {
      primaryAssignedTractCount: primaryTracts.length,
      intersectingTractCount: intersectingTracts.length,
      primaryAssignedTractsCrossingTownBoundaries: primaryTracts.filter(
        (tract) => tract.crossesTownBoundary
      ).length,
      screeningStateCountsForPrimaryAssignedTracts: primaryStateCounts,
      screeningStateCountsForIntersectingTracts: intersectingStateCounts
    },
    dataQuality: {
      hasPrimaryAssignedTracts: primaryTracts.length > 0,
      hasInsufficientEvidence:
        primaryStateCounts.insufficient_evidence > 0 ||
        intersectingStateCounts.insufficient_evidence > 0,
      requiresPartialTractExplanation:
        intersectingTracts.length > primaryTracts.length ||
        primaryTracts.some((tract) => tract.crossesTownBoundary)
    }
  };
}

async function buildCounty(countyFips, towns, tractGeoJson, classifications) {
  const classificationByGeoid = new Map(
    classifications.map((classification) => [
      classification.geography.geoid,
      classification
    ])
  );
  const tractRecords = [];

  for (const feature of tractGeoJson.features) {
    const properties = feature.properties ?? {};
    const geoid = String(properties.GEOID ?? "");
    const classification = classificationByGeoid.get(geoid);
    if (!classification) throw new Error(`Missing classification for tract ${geoid}.`);
    const projectedGeometry = projectMultiPolygon(toMultiPolygon(feature.geometry));
    const tractAreaSquareMeters = multiPolygonArea(projectedGeometry);
    const tractBounds = getBounds(feature.geometry);
    const latitude = Number(properties.INTPTLAT);
    const longitude = Number(properties.INTPTLON);
    const pointTown = towns.find((town) =>
      pointInGeometry(latitude, longitude, town.feature.geometry)
    );
    const rawOverlaps = [];

    for (const town of towns) {
      if (!boundsOverlap(tractBounds, town.bounds)) continue;
      const intersection = polygonClipping.intersection(
        projectedGeometry,
        town.projectedGeometry
      );
      const intersectionAreaSquareMeters = multiPolygonArea(intersection);
      if (intersectionAreaSquareMeters <= 1) continue;
      rawOverlaps.push({
        intersectionAreaSquareMeters,
        shareOfTownPolygonArea:
          intersectionAreaSquareMeters / town.polygonAreaSquareMeters,
        shareOfTractPolygonArea:
          intersectionAreaSquareMeters / tractAreaSquareMeters,
        town
      });
    }

    rawOverlaps.sort(
      (first, second) =>
        second.shareOfTractPolygonArea - first.shareOfTractPolygonArea
    );
    const largestOverlap = rawOverlaps[0] ?? null;
    const primaryTown =
      pointTown ??
      (largestOverlap?.shareOfTractPolygonArea >= minimumFallbackTractShare
        ? largestOverlap.town
        : null);
    const assignmentMethod = pointTown
      ? "official_tract_internal_point"
      : primaryTown
        ? "largest_equal_area_polygon_overlap_fallback"
        : "unassigned_no_town_polygon_overlap";
    const overlaps = rawOverlaps
      .filter(
        (overlap) =>
          overlap.town.geoid === primaryTown?.geoid ||
          overlap.shareOfTractPolygonArea >= meaningfulShareThreshold ||
          overlap.shareOfTownPolygonArea >= meaningfulShareThreshold
      )
      .map((overlap) => ({
        townGeoid: overlap.town.geoid,
        townName: overlap.town.name,
        intersectionAreaSquareMeters: Math.round(
          overlap.intersectionAreaSquareMeters
        ),
        shareOfTractPolygonArea: round(overlap.shareOfTractPolygonArea),
        shareOfTownPolygonArea: round(overlap.shareOfTownPolygonArea),
        isPrimaryAssignment: overlap.town.geoid === primaryTown?.geoid
      }));
    if (
      primaryTown &&
      !overlaps.some((overlap) => overlap.isPrimaryAssignment)
    ) {
      overlaps.push({
        townGeoid: primaryTown.geoid,
        townName: primaryTown.name,
        intersectionAreaSquareMeters: 0,
        shareOfTractPolygonArea: 0,
        shareOfTownPolygonArea: 0,
        isPrimaryAssignment: true
      });
    }
    overlaps.sort((first, second) => first.townGeoid.localeCompare(second.townGeoid));
    const meaningfulTownCount = rawOverlaps.filter(
      (overlap) =>
        overlap.shareOfTractPolygonArea >= meaningfulShareThreshold ||
        overlap.shareOfTownPolygonArea >= meaningfulShareThreshold
    ).length;

    tractRecords.push({
      schemaVersion: "1.0.0",
      geography: {
        type: "census_tract",
        geoid,
        stateFips: "34",
        countyFips,
        name: String(properties.NAMELSAD ?? properties.NAME ?? geoid)
      },
      screeningState: classification.state,
      primaryTown: {
        geoid: primaryTown?.geoid ?? null,
        name: primaryTown?.name ?? null,
        assignmentMethod
      },
      crossesTownBoundary: meaningfulTownCount > 1,
      mappedPolygonAreaShare: round(
        rawOverlaps.reduce(
          (total, overlap) => total + overlap.shareOfTractPolygonArea,
          0
        )
      ),
      overlaps
    });
  }

  tractRecords.sort((first, second) =>
    first.geography.geoid.localeCompare(second.geography.geoid)
  );
  const townSummaries = towns.map((town) => {
    const primaryTracts = tractRecords.filter(
      (tract) => tract.primaryTown.geoid === town.geoid
    );
    const intersectingTracts = tractRecords.filter((tract) =>
      tract.overlaps.some((overlap) => overlap.townGeoid === town.geoid)
    );
    return buildTownSummary(town, primaryTracts, intersectingTracts);
  });

  return {
    schemaVersion: "1.0.0",
    recordType: "county_tract_to_town_foundation",
    generatedDate,
    ruleVersion: "1.0.0",
    countyFips,
    countyName: towns[0]?.countyName ?? null,
    method: {
      primaryAssignment:
        "Official 2024 Census tract internal point inside an official 2024 county-subdivision polygon; largest polygon overlap is retained only as a disclosed fallback.",
      overlap:
        "Polygon intersections in a spherical Lambert azimuthal equal-area projection centered on New Jersey.",
      meaningfulOverlapThreshold: meaningfulShareThreshold,
      minimumFallbackTractShare,
      overlapAreaIncludesWater: true
    },
    limitations: [
      "These records summarize tract screening context inside town boundaries; they do not classify or score an entire town.",
      "A census tract can cross town boundaries. Primary assignment prevents double counting, while overlap records disclose partial coverage.",
      "Polygon shares include land and water because the public Census boundary polygons do not separate intersection land from intersection water.",
      "Counts are not population-weighted. A future town display must label them as tract areas or assigned tracts, not as a percentage of town residents."
    ],
    tracts: tractRecords,
    towns: townSummaries
  };
}

async function main() {
  const [townGeoJson, ruleSummary, tractFoundation] = await Promise.all([
    readJson(townGeometryPath),
    readJson(path.join(tractRoot, "access-gap-rule-v1-summary.json")),
    readJson(path.join(tractRoot, "tract-foundation.json"))
  ]);
  const towns = townGeoJson.features.map(getTownRecord).sort((first, second) =>
    first.geoid.localeCompare(second.geoid)
  );
  const countyFipsValues = [...new Set(towns.map((town) => town.countyFips))].sort();
  const counties = [];
  const allTracts = [];
  const allTownSummaries = [];

  await fs.rm(outputCountyRoot, { recursive: true, force: true });

  for (const countyFips of countyFipsValues) {
    const [tractGeoJson, classifications] = await Promise.all([
      readJson(path.join(tractGeometryRoot, `${countyFips}.geojson`)),
      readJson(path.join(classificationRoot, `${countyFips}.json`))
    ]);
    const countyTowns = towns.filter((town) => town.countyFips === countyFips);
    const artifact = await buildCounty(
      countyFips,
      countyTowns,
      tractGeoJson,
      classifications
    );
    await writeJson(path.join(outputCountyRoot, `${countyFips}.json`), artifact);
    counties.push({
      countyFips,
      countyName: artifact.countyName,
      townCount: artifact.towns.length,
      tractCount: artifact.tracts.length,
      url: `/data/tracts/nj/town-foundation/by-county/${countyFips}.json`
    });
    allTracts.push(...artifact.tracts);
    allTownSummaries.push(...artifact.towns);
  }

  const mappedShares = allTracts.map((tract) => tract.mappedPolygonAreaShare);
  const primaryAssignmentMethods = allTracts.reduce((counts, tract) => {
    const method = tract.primaryTown.assignmentMethod;
    counts[method] = (counts[method] ?? 0) + 1;
    return counts;
  }, {});
  const primaryStateCounts = emptyStateCounts();
  const unassignedStateCounts = emptyStateCounts();
  for (const tract of allTracts) {
    const targetCounts = tract.primaryTown.geoid
      ? primaryStateCounts
      : unassignedStateCounts;
    targetCounts[tract.screeningState] += 1;
  }
  const summary = {
    schemaVersion: "1.0.0",
    recordType: "new_jersey_tract_to_town_foundation_summary",
    generatedDate,
    ruleVersion: ruleSummary.ruleVersion,
    geographyVintage: tractFoundation.geographyVintage,
    sources: [
      {
        artifact: "public/data/tracts/nj/by-county/{countyFips}.geojson",
        agency: "United States Census Bureau",
        dataset: "TIGERweb ACS 2024 Census Tracts",
        checkedDate:
          tractFoundation.records[0]?.provenance?.boundaryCheckedDate ?? null
      },
      {
        artifact: "public/data/cousubs/by-state/34.geojson",
        agency: "United States Census Bureau",
        dataset:
          "2024 Cartographic Boundary File, New Jersey county subdivisions, 1:500,000",
        url:
          "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_34_cousub_500k.zip",
        checkedDate: generatedDate
      },
      {
        artifact:
          "public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/{countyFips}.json",
        agency: "CareAtlas",
        dataset: "Versioned tract access-gap screening classifications",
        ruleVersion: ruleSummary.ruleVersion
      }
    ],
    projection: {
      name: "Spherical Lambert azimuthal equal-area",
      centerLatitude: projectionCenter.latitude,
      centerLongitude: projectionCenter.longitude,
      earthRadiusMeters
    },
    counts: {
      countyCount: counties.length,
      townCount: allTownSummaries.length,
      tractCount: allTracts.length,
      tractTownOverlapRecordCount: allTracts.reduce(
        (total, tract) => total + tract.overlaps.length,
        0
      ),
      crossTownTractCount: allTracts.filter((tract) => tract.crossesTownBoundary)
        .length,
      townsWithoutPrimaryAssignedTracts: allTownSummaries.filter(
        (town) => !town.dataQuality.hasPrimaryAssignedTracts
      ).length,
      unassignedTractCount: allTracts.filter(
        (tract) => tract.primaryTown.geoid === null
      ).length,
      primaryAssignmentMethods,
      primaryAssignedScreeningStateCounts: primaryStateCounts,
      unassignedScreeningStateCounts: unassignedStateCounts,
      tractsBelowNinetyPercentMappedPolygonArea: allTracts.filter(
        (tract) => tract.mappedPolygonAreaShare < 0.9
      ).length,
      tractsBelowFiftyPercentMappedPolygonArea: allTracts.filter(
        (tract) => tract.mappedPolygonAreaShare < 0.5
      ).length
    },
    mappingCoverage: {
      minimumTractPolygonAreaShare: round(Math.min(...mappedShares)),
      meanTractPolygonAreaShare: round(
        mappedShares.reduce((total, share) => total + share, 0) /
          mappedShares.length
      ),
      maximumTractPolygonAreaShare: round(Math.max(...mappedShares))
    },
    counties,
    publicUseGuardrails: [
      "Do not label a town as an access gap from these counts.",
      "Describe values as primary-assigned or intersecting tract screening context.",
      "Show a data-quality flag when a town has no primary-assigned tracts, insufficient evidence, or cross-boundary tract context.",
      "Do not interpret polygon area shares as population shares."
    ]
  };
  await writeJson(summaryPath, summary);
  console.log(
    `Generated town foundation for ${allTracts.length} tracts and ${allTownSummaries.length} towns across ${counties.length} counties.`
  );
  console.log(
    `Cross-town tracts: ${summary.counts.crossTownTractCount}; fallback assignments: ${primaryAssignmentMethods.largest_equal_area_polygon_overlap_fallback ?? 0}.`
  );
}

await main();
