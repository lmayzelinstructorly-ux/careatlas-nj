import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");

export const healthcareDir = path.join(projectRoot, "public", "data", "healthcare");
export const facilitiesPath = path.join(healthcareDir, "facilities.json");
export const assignmentsPath = path.join(
  healthcareDir,
  "facility-boundary-assignments.json"
);
export const summariesPath = path.join(
  healthcareDir,
  "boundary-healthcare-summaries.json"
);
export const statesPath = path.join(projectRoot, "public", "data", "us-states.geojson");
export const countiesDir = path.join(projectRoot, "public", "data", "counties", "by-state");
export const localJurisdictionsDir = path.join(
  projectRoot,
  "public",
  "data",
  "cousubs",
  "by-state"
);

const coverageWarning =
  "Current source-backed facility data may not represent full healthcare coverage.";
const noAssignedFacilitiesNote =
  "No mapped source-backed facilities are currently assigned to this boundary in the loaded data. This does not mean no healthcare exists there.";

export function relativePath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function readChecksum(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath, "utf8"))
    .digest("hex");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getPropertyText(feature, propertyNames) {
  if (!isObject(feature?.properties)) {
    return null;
  }

  for (const propertyName of propertyNames) {
    const value = feature.properties[propertyName];

    if ((typeof value === "string" && value.trim()) || typeof value === "number") {
      return String(value).trim();
    }
  }

  return null;
}

function getBoundaryName(feature) {
  return getPropertyText(feature, ["NAMELSAD", "NAME", "STATE_NAME"]);
}

function isFeatureCollection(data) {
  return isObject(data) && data.type === "FeatureCollection" && Array.isArray(data.features);
}

function collectBoundariesFromGeoJson(data, level, sourceFile) {
  if (!isFeatureCollection(data)) {
    throw new Error(`${sourceFile} must be a GeoJSON FeatureCollection.`);
  }

  return data.features
    .map((feature) => {
      const geoid = getPropertyText(feature, ["GEOID", "GEOID20", "GEOID10"]);
      const stateFips = getPropertyText(feature, ["STATEFP", "STATEFP20"]);
      const countyFips = getPropertyText(feature, ["COUNTYFP", "COUNTYFP20"]);
      const cousubFips = getPropertyText(feature, ["COUSUBFP", "COUSUBFP20"]);

      if (!geoid) {
        return null;
      }

      return {
        boundaryId: geoid,
        boundaryLevel: level,
        boundaryName: getBoundaryName(feature),
        countyFips: countyFips?.padStart(3, "0") ?? null,
        sourceFile,
        stateFips: stateFips?.padStart(2, "0") ?? geoid.slice(0, 2),
        cousubFips: cousubFips?.padStart(5, "0") ?? null
      };
    })
    .filter(Boolean);
}

async function collectStateSpecificBoundaries(sourceDir, level) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const boundaries = [];

  for (const entry of entries) {
    if (!entry.isFile() || !/^\d{2}\.geojson$/.test(entry.name)) {
      continue;
    }

    const filePath = path.join(sourceDir, entry.name);
    boundaries.push(
      ...collectBoundariesFromGeoJson(
        await readJson(filePath),
        level,
        relativePath(filePath)
      )
    );
  }

  return boundaries;
}

export async function collectSupportedBoundaries() {
  const [states, counties, localJurisdictions] = await Promise.all([
    readJson(statesPath).then((data) =>
      collectBoundariesFromGeoJson(data, "state", relativePath(statesPath))
    ),
    collectStateSpecificBoundaries(countiesDir, "county"),
    collectStateSpecificBoundaries(localJurisdictionsDir, "local_jurisdiction")
  ]);

  return [...states, ...counties, ...localJurisdictions];
}

function hasValidCoordinates(facility) {
  return (
    typeof facility.latitude === "number" &&
    Number.isFinite(facility.latitude) &&
    facility.latitude >= -90 &&
    facility.latitude <= 90 &&
    typeof facility.longitude === "number" &&
    Number.isFinite(facility.longitude) &&
    facility.longitude >= -180 &&
    facility.longitude <= 180
  );
}

function incrementCount(counts, key) {
  if (!hasText(key)) {
    return;
  }

  counts[key] = (counts[key] ?? 0) + 1;
}

function createBoundaryKey(level, boundaryId) {
  return `${level}:${boundaryId}`;
}

function getAssignedBoundary(assignment, level) {
  if (level === "state") {
    return assignment.state;
  }

  if (level === "county") {
    return assignment.county;
  }

  return assignment.localJurisdiction;
}

function summarizeBoundary({
  assignments,
  boundary,
  facilitiesById,
  totalMissingCoordinateFacilities
}) {
  const assignedFacilityRecords = assignments
    .map((assignment) => {
      const facility = facilitiesById.get(assignment.facilityId);
      return facility ? { assignment, facility } : null;
    })
    .filter(Boolean);
  const totalAssignedFacilities = assignedFacilityRecords.length;
  const facilitiesWithValidCoordinates = assignedFacilityRecords.filter(({ facility }) =>
    hasValidCoordinates(facility)
  ).length;
  const facilityTypeCounts = {};

  for (const { facility } of assignedFacilityRecords) {
    incrementCount(facilityTypeCounts, facility.facilityType);
  }

  const statuses = [];

  if (totalAssignedFacilities > 0) {
    statuses.push("has_facilities");
  } else {
    statuses.push("no_assigned_facilities");
  }

  if (
    totalAssignedFacilities === 0 ||
    totalMissingCoordinateFacilities > 0
  ) {
    statuses.push("limited_data");
  }

  const missingDataWarnings = [];

  if (totalAssignedFacilities === 0) {
    missingDataWarnings.push(noAssignedFacilitiesNote);
  }

  if (totalMissingCoordinateFacilities > 0) {
    missingDataWarnings.push(
      `${totalMissingCoordinateFacilities} loaded source-backed facility record${
        totalMissingCoordinateFacilities === 1 ? " is" : "s are"
      } missing valid coordinates and could not be assigned by boundary.`
    );
  }

  const dataCompletenessNotes = [
    coverageWarning,
    "Summaries use assigned production facilities only and do not infer missing facilities."
  ];

  return {
    boundaryId: boundary.boundaryId,
    boundaryName: boundary.boundaryName,
    boundaryLevel: boundary.boundaryLevel,
    stateFips: boundary.stateFips,
    countyFips: boundary.countyFips,
    cousubFips: boundary.cousubFips,
    summaryStatus: statuses[0],
    statuses,
    totalAssignedFacilities,
    facilitiesWithValidCoordinates,
    facilitiesMissingCoordinates: 0,
    facilityTypeCounts,
    dataCompletenessNotes,
    missingDataWarnings,
    sourceCoverageNotes: [
      "Facility membership comes from public/data/healthcare/facility-boundary-assignments.json.",
      "This is a mapped facility coverage view, not complete healthcare access coverage.",
      "No assigned facilities means coverage is not loaded in the current source view, not that zero healthcare exists."
    ],
    sourceFacilityIds: assignedFacilityRecords.map(({ facility }) => facility.id)
  };
}

export async function buildBoundaryHealthcareSummaries() {
  const [facilities, assignmentsArtifact, boundaries] = await Promise.all([
    readJson(facilitiesPath),
    readJson(assignmentsPath),
    collectSupportedBoundaries()
  ]);

  if (!Array.isArray(facilities)) {
    throw new Error(`${relativePath(facilitiesPath)} must contain a JSON array.`);
  }

  if (!isObject(assignmentsArtifact) || !Array.isArray(assignmentsArtifact.assignments)) {
    throw new Error(`${relativePath(assignmentsPath)} must contain an assignments array.`);
  }

  {
    const facilitiesById = new Map(facilities.map((facility) => [facility.id, facility]));
    const assignmentsByBoundary = new Map();
    const levels = ["state", "county", "local_jurisdiction"];

    for (const assignment of assignmentsArtifact.assignments) {
      for (const level of levels) {
        const boundary = getAssignedBoundary(assignment, level);

        if (boundary?.status !== "assigned" || !hasText(boundary.geoid)) {
          continue;
        }

        const key = createBoundaryKey(level, boundary.geoid);
        const matches = assignmentsByBoundary.get(key) ?? [];
        matches.push(assignment);
        assignmentsByBoundary.set(key, matches);
      }
    }

    const totalMissingCoordinateFacilities = facilities.filter(
      (facility) => !hasValidCoordinates(facility)
    ).length;
    const boundariesByKey = new Map(
      boundaries.map((boundary) => [
        createBoundaryKey(boundary.boundaryLevel, boundary.boundaryId),
        boundary
      ])
    );
    const summariesByLevel = {
      state: {},
      county: {},
      local_jurisdiction: {}
    };

    for (const [key, assignments] of assignmentsByBoundary) {
      const boundary = boundariesByKey.get(key);

      if (!boundary) {
        continue;
      }

      summariesByLevel[boundary.boundaryLevel][boundary.boundaryId] = summarizeBoundary({
        assignments,
        boundary,
        facilitiesById,
        totalMissingCoordinateFacilities
      });
    }

    const summaryCounts = Object.fromEntries(
      Object.entries(summariesByLevel).map(([level, summaries]) => [
        level,
        Object.keys(summaries).length
      ])
    );
    const supportedBoundaryCounts = boundaries.reduce((counts, boundary) => {
      counts[boundary.boundaryLevel] = (counts[boundary.boundaryLevel] ?? 0) + 1;
      return counts;
    }, {});
    const noAssignedBoundaryCounts = Object.fromEntries(
      Object.entries(supportedBoundaryCounts).map(([level, count]) => [
        level,
        count - (summaryCounts[level] ?? 0)
      ])
    );
    const materializedStatusCounts = Object.values(summariesByLevel)
      .flatMap((summaries) => Object.values(summaries))
      .reduce((counts, summary) => {
        for (const status of summary.statuses) {
          counts[status] = (counts[status] ?? 0) + 1;
        }

        return counts;
      }, {});
    const totalNoAssignedBoundaries = Object.values(noAssignedBoundaryCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        summaryMethod: "aggregate_validated_facility_boundary_assignments",
        inputFiles: {
          facilities: relativePath(facilitiesPath),
          assignments: relativePath(assignmentsPath),
          states: relativePath(statesPath),
          countiesByState: relativePath(countiesDir),
          localJurisdictionsByState: relativePath(localJurisdictionsDir)
        },
        inputChecksums: {
          facilities: await readChecksum(facilitiesPath),
          assignments: await readChecksum(assignmentsPath)
        },
        supportedBoundaryLevels: levels,
        totalProductionFacilities: facilities.length,
        totalFacilitiesMissingCoordinates: totalMissingCoordinateFacilities,
        supportedBoundaryCounts,
        summaryCounts,
        noAssignedBoundaryCounts,
        statusCounts: {
          ...materializedStatusCounts,
          no_assigned_facilities:
            (materializedStatusCounts.no_assigned_facilities ?? 0) +
            totalNoAssignedBoundaries,
          limited_data:
            (materializedStatusCounts.limited_data ?? 0) +
            totalNoAssignedBoundaries,
        },
        cacheScope:
          "Sparse cache materializes boundaries with assigned facilities and uses noAssignedFacilityPolicy for supported boundaries without assigned facilities."
      },
      noAssignedFacilityPolicy: {
        summaryStatus: "no_assigned_facilities",
        statuses: ["no_assigned_facilities", "limited_data"],
        totalAssignedFacilities: 0,
        missingDataWarnings: [
          noAssignedFacilitiesNote
        ],
        dataCompletenessNotes: [
          coverageWarning,
          "Summaries use assigned production facilities only and do not infer missing facilities."
        ],
        sourceCoverageNotes: [
          "Use this policy for supported official boundaries that do not have a materialized summary.",
          "Coverage not loaded means no source-backed, coordinate-assigned facilities are currently matched in the loaded data; it does not mean zero healthcare."
        ]
      },
      summaries: summariesByLevel
    };
  }
}
