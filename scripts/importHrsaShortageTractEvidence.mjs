import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRows } from "./lib/csvRows.mjs";
import {
  HRSA_DATASET_NAME,
  HRSA_SOURCE_URL,
  hrsaSources
} from "./lib/batch6SourceConfig.mjs";
import {
  CHECKED_DATE,
  NJ_TRACT_ROOT,
  PROJECT_ROOT,
  TRACT_FOUNDATION_PATH,
  assert,
  buildObservation,
  getArgument,
  getTractGeographies,
  readJson,
  summarizeCoverage,
  writeCountyShards,
  writeJson
} from "./lib/tractEvidenceBatch6.mjs";

function pointInRing(longitude, latitude, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crosses = y > latitude !== previousY > latitude &&
      longitude < ((previousX - x) * (latitude - y)) / (previousY - y) + x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInGeometry(longitude, latitude, geometry) {
  const inPolygon = (polygon) =>
    pointInRing(longitude, latitude, polygon[0] ?? []) &&
    !polygon.slice(1).some((hole) => pointInRing(longitude, latitude, hole));
  if (geometry?.type === "Polygon") return inPolygon(geometry.coordinates);
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.some(inPolygon);
  return false;
}

function buildCousubTractCrosswalk(tractFeatures, cousubFeatures) {
  const cousubsByCounty = new Map();
  for (const feature of cousubFeatures) {
    const geoid = String(feature.properties?.GEOID ?? feature.properties?.GEOID20 ?? "");
    const countyFips = String(feature.properties?.COUNTYFP ?? geoid.slice(2, 5)).padStart(3, "0");
    assert(/^34\d{8}$/.test(geoid), `County subdivision has invalid GEOID ${geoid}.`);
    const features = cousubsByCounty.get(countyFips) ?? [];
    features.push({ ...feature, geoid });
    cousubsByCounty.set(countyFips, features);
  }

  const tractsByCousub = new Map();
  const unmatchedTractGeoids = [];
  for (const feature of tractFeatures) {
    const properties = feature.properties ?? {};
    const geoid = String(properties.GEOID ?? "");
    const countyFips = String(properties.COUNTYFP ?? geoid.slice(2, 5)).padStart(3, "0");
    const longitude = Number(properties.INTPTLON);
    const latitude = Number(properties.INTPTLAT);
    assert(/^34\d{9}$/.test(geoid), `Tract feature has invalid GEOID ${geoid}.`);
    assert(Number.isFinite(longitude) && Number.isFinite(latitude), `${geoid} lacks an internal point.`);
    const match = (cousubsByCounty.get(countyFips) ?? []).find(({ geometry }) =>
      pointInGeometry(longitude, latitude, geometry)
    );
    if (!match) {
      unmatchedTractGeoids.push(geoid);
      continue;
    }
    const geoids = tractsByCousub.get(match.geoid) ?? [];
    geoids.push(geoid);
    tractsByCousub.set(match.geoid, geoids);
  }
  return { tractsByCousub, unmatchedTractGeoids };
}

function normalizeHpsaRows(rows, source) {
  return rows.filter((row) =>
    row["HPSA Component State Abbreviation"] === "NJ" &&
    row["HPSA Status"] === "Designated" &&
    row["HPSA Discipline Class"] === source.discipline
  ).map((row) => ({
    designationId: row["HPSA ID"],
    designationName: row["HPSA Name"],
    designationType: row["Designation Type"],
    status: row["HPSA Status"],
    designationDate: row["HPSA Designation Date"],
    updateDate: row["HPSA Designation Last Update Date"],
    score: row["HPSA Score"] === "" ? null : Number(row["HPSA Score"]),
    ruralStatus: row["Rural Status"],
    populationType: row["HPSA Designation Population Type Description"],
    componentType: row["HPSA Component Type Code"],
    componentGeoid: row["HPSA Geography Identification Number"],
    componentName: row["HPSA Component Name"]
  }));
}

function normalizeMuapRows(rows) {
  return rows.filter((row) =>
    row["State Abbreviation"] === "NJ" &&
    row["MUA/P Status Description"] === "Designated"
  ).map((row) => {
    const componentType = row["Medically Underserved Area/Population (MUA/P) Component Geographic Type Code"];
    const componentGeoid = componentType === "CT"
      ? row["MUA/P Area Code"]
      : componentType === "CSD"
        ? row["County Subdivision FIPS Code"]
        : row["State and County Federal Information Processing Standard Code"];
    return {
      designationId: row["MUA/P ID"],
      designationName: row["MUA/P Service Area Name"],
      designationType: row["Designation Type"],
      status: row["MUA/P Status Description"],
      designationDate: row["Designation Date"],
      updateDate: row["MUA/P Update Date"],
      score: row["IMU Score"] === "" ? null : Number(row["IMU Score"]),
      ruralStatus: row["Rural Status Description"],
      populationType: row["Population Type"],
      componentType,
      componentGeoid,
      componentName: row["Medically Underserved Area/Population (MUA/P) Component Geographic Name"]
    };
  });
}

function assignComponentsToTracts(components, geographies, tractsByCousub) {
  const knownGeoids = new Set(geographies.map(({ geoid }) => geoid));
  const tractsByCounty = new Map();
  for (const { geoid, countyFips } of geographies) {
    const geoids = tractsByCounty.get(countyFips) ?? [];
    geoids.push(geoid);
    tractsByCounty.set(countyFips, geoids);
  }
  const designationsByTract = new Map();
  const componentMethodCounts = { census_tract_exact: 0, county_exact: 0, county_subdivision_internal_point: 0 };
  const seenComponents = new Set();
  const unmatchedComponentKeys = [];

  for (const component of components) {
    assert(/^\d+$/.test(component.designationId), `Invalid HRSA designation ID ${component.designationId}.`);
    assert(["CT", "SCTY", "CSD"].includes(component.componentType),
      `${component.designationId} uses unsupported component type ${component.componentType}.`);
    assert(component.score === null || Number.isFinite(component.score), `${component.designationId} has an invalid score.`);
    const componentKey = `${component.designationId}:${component.componentType}:${component.componentGeoid}`;
    assert(!seenComponents.has(componentKey), `Duplicate HRSA component ${componentKey}.`);
    seenComponents.add(componentKey);

    let tractGeoids;
    if (component.componentType === "CT") {
      tractGeoids = knownGeoids.has(component.componentGeoid) ? [component.componentGeoid] : [];
      componentMethodCounts.census_tract_exact += 1;
    } else if (component.componentType === "SCTY") {
      tractGeoids = tractsByCounty.get(component.componentGeoid.slice(-3)) ?? [];
      componentMethodCounts.county_exact += 1;
    } else {
      tractGeoids = tractsByCousub.get(component.componentGeoid) ?? [];
      componentMethodCounts.county_subdivision_internal_point += 1;
    }
    if (tractGeoids.length === 0) {
      unmatchedComponentKeys.push(componentKey);
      continue;
    }
    for (const geoid of tractGeoids) {
      const designations = designationsByTract.get(geoid) ?? new Map();
      designations.set(component.designationId, component);
      designationsByTract.set(geoid, designations);
    }
  }

  return { designationsByTract, componentMethodCounts, unmatchedComponentKeys };
}

function buildHrsaShortageArtifacts(sourceRowsByKey, tractArtifact, tractFeatures, cousubFeatures) {
  const geographies = getTractGeographies(tractArtifact);
  const { tractsByCousub, unmatchedTractGeoids } = buildCousubTractCrosswalk(
    tractFeatures,
    cousubFeatures
  );
  const source = {
    agency: "Health Resources and Services Administration",
    dataset: HRSA_DATASET_NAME,
    releaseYear: 2026,
    url: HRSA_SOURCE_URL
  };
  const observations = [];
  const designationCatalog = {};
  const sourceCoverage = {};

  for (const measure of hrsaSources) {
    const rows = sourceRowsByKey[measure.key];
    assert(Array.isArray(rows), `Missing HRSA source rows for ${measure.key}.`);
    const components = measure.key === "muap" ? normalizeMuapRows(rows) : normalizeHpsaRows(rows, measure);
    const { designationsByTract, componentMethodCounts, unmatchedComponentKeys } = assignComponentsToTracts(
      components,
      geographies,
      tractsByCousub
    );
    const catalog = new Map();
    for (const component of components) {
      if (!catalog.has(component.designationId)) {
        const { componentType, componentGeoid, componentName, ...designation } = component;
        catalog.set(component.designationId, designation);
      }
    }
    designationCatalog[measure.key] = Object.fromEntries([...catalog].sort());
    sourceCoverage[measure.key] = {
      reviewedNewJerseyRowCount: rows.length,
      activeNewJerseyComponentCount: components.length,
      activeNewJerseyDesignationCount: catalog.size,
      tractWithDesignationCount: designationsByTract.size,
      componentMethodCounts,
      unmatchedActiveComponentCount: unmatchedComponentKeys.length,
      unmatchedActiveComponentKeys: unmatchedComponentKeys.sort(),
      fileUrl: measure.fileUrl
    };

    for (const geography of geographies) {
      const designations = [...(designationsByTract.get(geography.geoid)?.values() ?? [])]
        .sort((first, second) => first.designationId.localeCompare(second.designationId));
      const ids = designations.map(({ designationId }) => designationId);
      observations.push(buildObservation({
        geography,
        measure,
        source,
        value: ids.length,
        estimateType: "designation",
        sourceRecordId: `hrsa:${measure.key}:${geography.geoid}:${ids.join("|") || "none"}`,
        transformation:
          "Counted distinct active HRSA designations assigned by exact tract GEOID, exact county coverage, or the Census tract internal point within an exact county-subdivision component; no facility pins or inferred access score were used."
      }));
    }
  }

  return {
    observations,
    coverageSummary: {
      schemaVersion: "1.0.0",
      pilotState: "New Jersey",
      stateFips: "34",
      ...summarizeCoverage({ geographies, measures: hrsaSources, observations }),
      source: {
        ...source,
        checkedDate: CHECKED_DATE,
        refreshCycle: "daily",
        geographyIdentifierFormats: ["11-digit tract GEOID", "5-digit county GEOID", "10-digit county-subdivision GEOID"]
      },
      sourceCoverage,
      countySubdivisionCrosswalk: {
        method: "2024 Census tract internal point inside 2024 Census county-subdivision polygon",
        matchedTractCount: geographies.length - unmatchedTractGeoids.length,
        unmatchedTractCount: unmatchedTractGeoids.length,
        unmatchedTractGeoids: unmatchedTractGeoids.sort()
      },
      selectedMeasures: hrsaSources.map(({ fileUrl, ...measure }) => measure),
      designationCatalog,
      limitations: [
        "A designation count is official shortage evidence, not a CareAtlas access-gap score or medical advice.",
        "HPSA disciplines remain separate; primary care, dental health and mental health are never merged.",
        "MUP designations may apply to a defined population group rather than every resident of an intersecting tract.",
        "County-subdivision components use the official 2024 Census tract internal point for a reproducible tract crosswalk; boundary-edge tracts may only be partially covered.",
        "Tracts whose official internal point falls outside every county-subdivision polygon remain unmatched in that crosswalk; they can still receive exact tract or county designations.",
        "Active HRSA components whose geographic identifier does not exist in the current 2024 tract, county or subdivision foundation remain listed as unmatched source components and are not reassigned by name.",
        "Zero means no active designation matched the reviewed HRSA component files on the checked date; it does not prove adequate access."
      ],
      classificationStatus: "not_evaluated"
    }
  };
}

async function loadCsv(url, inputArgument, sourceKey) {
  const input = getArgument(inputArgument);
  let text;
  if (input) {
    text = await fs.readFile(path.resolve(PROJECT_ROOT, input), "utf8");
  } else {
    const response = await fetch(url, { headers: { "user-agent": "CareAtlas HRSA shortage importer" } });
    if (!response.ok) throw new Error(`HRSA ${inputArgument} download failed: ${response.status} ${response.statusText}`);
    text = await response.text();
  }
  const rows = parseCsvRows(text);
  return sourceKey === "muap"
    ? rows.filter((row) => row["State Abbreviation"] === "NJ")
    : rows.filter((row) => row["HPSA Component State Abbreviation"] === "NJ");
}

async function loadTractFeatures() {
  const countyRoot = path.join(NJ_TRACT_ROOT, "by-county");
  const files = (await fs.readdir(countyRoot)).filter((file) => /^\d{3}\.geojson$/.test(file)).sort();
  const collections = await Promise.all(files.map((file) => readJson(path.join(countyRoot, file))));
  return collections.flatMap(({ features }) => features);
}

async function main() {
  const tractFile = path.resolve(PROJECT_ROOT, getArgument("tract-file") ?? TRACT_FOUNDATION_PATH);
  const outputRoot = path.resolve(PROJECT_ROOT, getArgument("output-dir") ?? NJ_TRACT_ROOT);
  const [tractArtifact, tractFeatures, cousubGeoJson] = await Promise.all([
    readJson(tractFile),
    loadTractFeatures(),
    readJson(path.join(PROJECT_ROOT, "public", "data", "cousubs", "by-state", "34.geojson"))
  ]);
  const sourceEntries = [];
  for (const source of hrsaSources) {
    sourceEntries.push([
      source.key,
      await loadCsv(source.fileUrl, source.key.replaceAll("_", "-"), source.key)
    ]);
  }
  const { observations, coverageSummary } = buildHrsaShortageArtifacts(
    Object.fromEntries(sourceEntries),
    tractArtifact,
    tractFeatures,
    cousubGeoJson.features
  );
  await Promise.all([
    writeCountyShards({ observations, outputRoot, sourceSlug: "hrsa-shortage" }),
    writeJson(path.join(outputRoot, "hrsa-shortage-coverage-summary.json"), coverageSummary)
  ]);
  console.log(`Wrote ${observations.length} HRSA shortage observations for ${coverageSummary.tractCount} New Jersey tracts.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}

export {
  assignComponentsToTracts,
  buildCousubTractCrosswalk,
  buildHrsaShortageArtifacts,
  normalizeHpsaRows,
  normalizeMuapRows,
  pointInGeometry
};
