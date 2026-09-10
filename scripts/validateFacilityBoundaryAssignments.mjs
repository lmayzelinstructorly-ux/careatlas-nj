import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(projectRoot, "public", "data");
const healthcareDir = path.join(dataDir, "healthcare");
const facilitiesPath = path.join(healthcareDir, "facilities.json");
const statesPath = path.join(dataDir, "us-states.geojson");
const countiesDir = path.join(dataDir, "counties", "by-state");
const localJurisdictionsDir = path.join(dataDir, "cousubs", "by-state");
const assignmentsPath = path.join(
  healthcareDir,
  "facility-boundary-assignments.json"
);

const assignedStatuses = new Set(["assigned"]);
const nonAssignmentStatuses = new Set([
  "missing_coordinates",
  "invalid_coordinates",
  "outside_supported_geography",
  "no_matching_boundary",
  "partial_assignment"
]);

function parseArgs(argv) {
  const args = {
    inputPath: assignmentsPath
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--file=")) {
      args.inputPath = path.resolve(projectRoot, arg.slice("--file=".length));
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option "${arg}".`);
    } else {
      args.inputPath = path.resolve(projectRoot, arg);
    }
  }

  return args;
}

function printHelp() {
  console.log("Validate generated facility-to-boundary assignments.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run validate:facility-boundaries");
  console.log("  node scripts/validateFacilityBoundaryAssignments.mjs --file=public/data/healthcare/facility-boundary-assignments.json");
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readChecksum(filePath) {
  return createHash("sha256")
    .update(await fs.readFile(filePath, "utf8"))
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

function isFeatureCollection(data) {
  return (
    isObject(data) &&
    data.type === "FeatureCollection" &&
    Array.isArray(data.features)
  );
}

function isBoundaryFeature(feature) {
  return (
    isObject(feature) &&
    feature.type === "Feature" &&
    isObject(feature.geometry) &&
    (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")
  );
}

function validateBoundaryData(errors, data, label) {
  if (!isFeatureCollection(data)) {
    errors.push(`${label} must be a GeoJSON FeatureCollection.`);
    return;
  }

  if (data.features.some((feature) => !isBoundaryFeature(feature))) {
    errors.push(`${label} must contain only Polygon or MultiPolygon boundary features.`);
  }
}

function collectBoundaryIds(data, level) {
  const ids = new Map();

  if (!isFeatureCollection(data)) {
    return ids;
  }

  for (const feature of data.features) {
    const geoid = getPropertyText(feature, ["GEOID", "GEOID20", "GEOID10"]);
    const stateFips = getPropertyText(feature, ["STATEFP", "STATEFP20"]);
    const countyFips = getPropertyText(feature, ["COUNTYFP", "COUNTYFP20"]);
    const cousubFips = getPropertyText(feature, ["COUSUBFP", "COUSUBFP20"]);

    if (!geoid) {
      continue;
    }

    ids.set(geoid, {
      geoid,
      stateFips: stateFips?.padStart(2, "0") ?? geoid.slice(0, 2),
      countyFips:
        countyFips?.padStart(3, "0") ??
        (level === "county" || level === "local" ? geoid.slice(2, 5) : null),
      cousubFips: cousubFips?.padStart(5, "0") ?? null
    });
  }

  return ids;
}

async function collectStateSpecificBoundaryIds(sourceDir) {
  const ids = new Map();
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !/^\d{2}\.geojson$/.test(entry.name)) {
      continue;
    }

    const filePath = path.join(sourceDir, entry.name);
    const data = await readJson(filePath);
    const level = sourceDir === countiesDir ? "county" : "local";

    for (const [geoid, details] of collectBoundaryIds(data, level)) {
      ids.set(geoid, details);
    }
  }

  return ids;
}

function hasMissingCoordinates(facility) {
  return (
    facility.latitude === undefined ||
    facility.latitude === null ||
    facility.longitude === undefined ||
    facility.longitude === null
  );
}

function hasValidCoordinateRange(facility) {
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

function validateAssignedBoundary(errors, assignment, boundary, ids, label) {
  if (boundary.status !== "assigned") {
    return;
  }

  if (!hasText(boundary.geoid)) {
    errors.push(`${assignment.facilityId} has assigned ${label} without a GEOID.`);
    return;
  }

  if (!ids.has(boundary.geoid)) {
    errors.push(`${assignment.facilityId} references unknown ${label} GEOID ${boundary.geoid}.`);
  }
}

function validateAssignmentShape(errors, assignment, index) {
  const label = `assignment ${index + 1}`;

  if (!isObject(assignment)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  if (!hasText(assignment.facilityId)) {
    errors.push(`${label} needs a facilityId.`);
  }

  if (!assignedStatuses.has(assignment.status) && !nonAssignmentStatuses.has(assignment.status)) {
    errors.push(`${label} has unknown status "${assignment.status}".`);
  }

  for (const fieldName of ["state", "county", "localJurisdiction"]) {
    if (!isObject(assignment[fieldName])) {
      errors.push(`${label} needs a ${fieldName} object.`);
    } else if (!hasText(assignment[fieldName].status)) {
      errors.push(`${label} ${fieldName} needs a status.`);
    }
  }

  if (!Array.isArray(assignment.warnings)) {
    errors.push(`${label} warnings must be an array.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const errors = [];
  const [facilities, assignmentsArtifact, states] = await Promise.all([
    readJson(facilitiesPath),
    readJson(args.inputPath),
    readJson(statesPath)
  ]);

  if (!Array.isArray(facilities)) {
    errors.push(`${relativePath(facilitiesPath)} must contain a JSON array.`);
  }

  if (!isObject(assignmentsArtifact) || !Array.isArray(assignmentsArtifact.assignments)) {
    errors.push(`${relativePath(args.inputPath)} must contain an assignments array.`);
  }

  validateBoundaryData(errors, states, "state boundaries");

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const [currentFacilitiesChecksum, currentStatesChecksum, countyIds, localIds] =
    await Promise.all([
      readChecksum(facilitiesPath),
      readChecksum(statesPath),
      collectStateSpecificBoundaryIds(countiesDir),
      collectStateSpecificBoundaryIds(localJurisdictionsDir)
    ]);
  const stateIds = collectBoundaryIds(states, "state");
  const assignments = assignmentsArtifact.assignments;
  const facilitiesById = new Map(facilities.map((facility) => [facility.id, facility]));
  const assignmentsByFacilityId = new Map();

  if (assignmentsArtifact.metadata?.inputChecksums?.facilities !== currentFacilitiesChecksum) {
    errors.push("Assignment artifact facilities checksum does not match current facilities.json. Regenerate it with npm run assign:facility-boundaries -- --write.");
  }

  if (assignmentsArtifact.metadata?.inputChecksums?.states !== currentStatesChecksum) {
    errors.push("Assignment artifact state boundary checksum does not match current us-states.geojson. Regenerate it with npm run assign:facility-boundaries -- --write.");
  }

  assignments.forEach((assignment, index) => {
    validateAssignmentShape(errors, assignment, index);

    if (!hasText(assignment.facilityId)) {
      return;
    }

    if (assignmentsByFacilityId.has(assignment.facilityId)) {
      errors.push(`${assignment.facilityId} appears more than once in the assignment artifact.`);
    }

    assignmentsByFacilityId.set(assignment.facilityId, assignment);
  });

  for (const facility of facilities) {
    if (!assignmentsByFacilityId.has(facility.id)) {
      errors.push(`${facility.id} is missing from the assignment artifact.`);
    }
  }

  for (const assignment of assignments) {
    const facility = facilitiesById.get(assignment.facilityId);

    if (!facility) {
      errors.push(`${assignment.facilityId} does not exist in current facilities.json.`);
      continue;
    }

    if (hasMissingCoordinates(facility) && assignment.status !== "missing_coordinates") {
      errors.push(`${assignment.facilityId} has missing coordinates but status is ${assignment.status}.`);
    }

    if (!hasMissingCoordinates(facility) && !hasValidCoordinateRange(facility) && assignment.status !== "invalid_coordinates") {
      errors.push(`${assignment.facilityId} has invalid coordinates but status is ${assignment.status}.`);
    }

    if (assignment.status === "assigned") {
      if (
        assignment.state?.status !== "assigned" ||
        assignment.county?.status !== "assigned" ||
        assignment.localJurisdiction?.status !== "assigned"
      ) {
        errors.push(`${assignment.facilityId} is fully assigned but one or more boundary levels are not assigned.`);
      }
    }

    if (assignment.status !== "assigned" && assignment.status !== "partial_assignment") {
      for (const boundaryName of ["state", "county", "localJurisdiction"]) {
        if (assignment[boundaryName]?.status === "assigned") {
          errors.push(`${assignment.facilityId} has ${assignment.status} but also has an assigned ${boundaryName}.`);
        }
      }
    }

    validateAssignedBoundary(errors, assignment, assignment.state, stateIds, "state");
    validateAssignedBoundary(errors, assignment, assignment.county, countyIds, "county");
    validateAssignedBoundary(
      errors,
      assignment,
      assignment.localJurisdiction,
      localIds,
      "local jurisdiction"
    );

    if (assignment.state?.status === "assigned" && assignment.county?.status === "assigned") {
      const county = countyIds.get(assignment.county.geoid);

      if (county && county.stateFips !== assignment.state.stateFips) {
        errors.push(`${assignment.facilityId} county assignment is outside assigned state.`);
      }
    }

    if (
      assignment.county?.status === "assigned" &&
      assignment.localJurisdiction?.status === "assigned"
    ) {
      const local = localIds.get(assignment.localJurisdiction.geoid);

      if (local && local.stateFips !== assignment.county.stateFips) {
        errors.push(`${assignment.facilityId} local jurisdiction assignment is outside assigned state.`);
      }

      if (local && local.countyFips !== assignment.county.countyFips) {
        errors.push(`${assignment.facilityId} local jurisdiction assignment is outside assigned county.`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("Facility boundary assignment validation failed.");
    console.error("Please fix the following issues:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Facility boundary assignment validation passed for ${assignments.length} assignments.`
  );
}

main().catch((error) => {
  console.error("Facility boundary assignment validation failed.");
  console.error(error.message);
  process.exit(1);
});
