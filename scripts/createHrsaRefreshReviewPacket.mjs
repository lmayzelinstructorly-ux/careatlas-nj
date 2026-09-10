import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHrsaRefreshAudit } from "./auditHrsaRefresh.mjs";
import {
  isWithinStateBounds,
  loadStateBounds,
  normalizeStateCode
} from "./lib/stateBounds.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportsDir = path.join(projectRoot, "docs", "reports");
const defaultProductionPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
const defaultStates = ["CT", "DC", "DE", "MA", "MD", "ME", "NH", "NJ", "NY", "PA", "RI", "VA", "VT"];
const hrsaColumns = {
  sourceId: "BPHC Assigned Number",
  name: "Site Name",
  address: "Site Address",
  city: "Site City",
  state: "Site State Abbreviation",
  stateFips: "State FIPS Code",
  county: "Complete County Name",
  countyFips:
    "State and County Federal Information Processing Standard Code",
  postalCode: "Site Postal Code",
  latitude: "Geocoding Artifact Address Primary Y Coordinate",
  longitude: "Geocoding Artifact Address Primary X Coordinate",
  phone: "Site Telephone Number",
  website: "Site Web Address",
  siteStatus: "Site Status Description",
  locationSetting:
    "Health Center Service Delivery Site Location Setting Description",
  operationalSchedule: "Health Center Operational Schedule Description",
  dataWarehouseCreated: "Data Warehouse Record Create Date"
};
const fieldLabels = {
  name: "name",
  sourceDataset: "source dataset",
  address: "address",
  city: "city",
  state: "state",
  stateFips: "state FIPS",
  county: "county",
  countyFips: "county FIPS",
  postalCode: "postal code",
  phone: "phone",
  website: "website",
  latitude: "latitude",
  longitude: "longitude",
  facilityType: "facility type",
  siteStatus: "site status",
  locationSetting: "location setting",
  operationalSchedule: "operational schedule"
};
const earthRadiusMiles = 3958.7613;

function parseArgs(argv) {
  const args = {
    auditReport: "",
    input: "",
    output: "",
    production: defaultProductionPath,
    states: defaultStates
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value after ${arg}.`);
      }
      index += 1;
      return value;
    };

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--audit-report") {
      args.auditReport = resolveProjectPath(nextValue());
    } else if (arg.startsWith("--audit-report=")) {
      args.auditReport = resolveProjectPath(arg.slice("--audit-report=".length));
    } else if (arg === "--input") {
      args.input = resolveProjectPath(nextValue());
    } else if (arg.startsWith("--input=")) {
      args.input = resolveProjectPath(arg.slice("--input=".length));
    } else if (arg === "--output") {
      args.output = resolveProjectPath(nextValue());
    } else if (arg.startsWith("--output=")) {
      args.output = resolveProjectPath(arg.slice("--output=".length));
    } else if (arg === "--production") {
      args.production = resolveProjectPath(nextValue());
    } else if (arg.startsWith("--production=")) {
      args.production = resolveProjectPath(arg.slice("--production=".length));
    } else if (arg === "--states") {
      args.states = parseStates(nextValue());
    } else if (arg.startsWith("--states=")) {
      args.states = parseStates(arg.slice("--states=".length));
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  return args;
}

function printHelp() {
  console.log("Create a human-review packet from a read-only HRSA refresh audit.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run create:hrsa-refresh-review-packet");
  console.log(
    "  npm run create:hrsa-refresh-review-packet -- --audit-report=docs/reports/hrsa-refresh-audit-2026-06-24.md"
  );
  console.log("");
  console.log("The script writes a Markdown report under docs/reports only.");
}

function resolveProjectPath(value) {
  return path.resolve(projectRoot, value);
}

function parseStates(value) {
  const states = [
    ...new Set(
      String(value ?? "")
        .split(",")
        .map(normalizeStateCode)
        .filter(Boolean)
    )
  ];
  if (states.length === 0) {
    throw new Error("--states must include at least one two-letter state code.");
  }
  return states;
}

function toProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll("\\", "/");
}

async function findLatestAuditReport() {
  const entries = await readdir(reportsDir, { withFileTypes: true });
  const reportNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^hrsa-refresh-audit-\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();

  if (reportNames.length === 0) {
    throw new Error("No HRSA refresh audit report exists under docs/reports.");
  }

  return path.join(reportsDir, reportNames.at(-1));
}

function extractAuditMetadata(reportPath, markdown) {
  const inputPath = markdown.match(/- Official CSV: `([^`]+)`/)?.[1];
  const productionPath = markdown.match(/- Production comparison file: `([^`]+)`/)?.[1];
  const dateText =
    path.basename(reportPath).match(/^hrsa-refresh-audit-(\d{4}-\d{2}-\d{2})\.md$/)?.[1] ??
    new Date().toISOString().slice(0, 10);

  if (!inputPath) {
    throw new Error(`${toProjectPath(reportPath)} does not include an Official CSV line.`);
  }

  return {
    dateText,
    inputPath: resolveProjectPath(inputPath),
    productionPath: productionPath ? resolveProjectPath(productionPath) : defaultProductionPath
  };
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (inQuotes) throw new Error("The official HRSA CSV has an open quoted cell.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((candidate) =>
    candidate.some((value) => String(value).trim().length > 0)
  );
}

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function isMissingValue(value) {
  return /^(?:|none|n\/a|na|null|unknown)$/i.test(cleanText(value));
}

function normalizeSourceId(value) {
  return cleanText(value).toUpperCase();
}

function normalizeSearchText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:inc|llc|corp|corporation|center|centre|clinic|health|medical|community|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCoordinate(value) {
  const parsed = Number(cleanText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function noteValue(notes, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return cleanText(
    String(notes ?? "").match(new RegExp(`${escaped}:\\s*([^.]*)\\.`, "i"))?.[1]
  );
}

function normalizeUpstreamRows(raw) {
  const parsed = parseCsv(raw);
  const headers = parsed[0].map(normalizeHeader);

  return parsed.slice(1).map((cells, rowIndex) => {
    const row = Object.fromEntries(
      headers.map((header, index) => [header, cells[index] ?? ""])
    );
    const get = (field) => cleanText(row[normalizeHeader(hrsaColumns[field])]);

    return {
      rowNumber: rowIndex + 2,
      sourceId: get("sourceId"),
      normalizedSourceId: normalizeSourceId(get("sourceId")),
      name: get("name"),
      facilityType: "community_health_center",
      address: get("address"),
      city: get("city"),
      state: normalizeStateCode(get("state")),
      stateFips: get("stateFips"),
      county: get("county"),
      countyFips: get("countyFips"),
      postalCode: get("postalCode"),
      latitude: parseCoordinate(get("latitude")),
      longitude: parseCoordinate(get("longitude")),
      phone: get("phone"),
      website: get("website"),
      siteStatus: get("siteStatus"),
      locationSetting: get("locationSetting"),
      operationalSchedule: get("operationalSchedule"),
      sourceDataset: "Health Center Service Delivery and Look-Alike Sites",
      dataWarehouseCreated: get("dataWarehouseCreated")
    };
  });
}

function normalizeProductionRows(records) {
  return records.map((record, rowIndex) => {
    const notes = cleanText(record?.sourceInfo?.notes);
    return {
      rowNumber: rowIndex + 1,
      sourceId: cleanText(record.sourceId),
      normalizedSourceId: normalizeSourceId(record.sourceId),
      name: cleanText(record.name),
      facilityType: cleanText(record.facilityType),
      address: cleanText(record.address),
      city: cleanText(record.city),
      state: normalizeStateCode(record.state),
      stateFips: cleanText(record.stateFips),
      county: cleanText(record.county),
      countyFips: cleanText(record.countyFips),
      postalCode: cleanText(record.postalCode),
      latitude: parseCoordinate(record.latitude),
      longitude: parseCoordinate(record.longitude),
      phone: cleanText(record.phone),
      website: cleanText(record.website),
      sourceDataset: cleanText(record.sourceDataset),
      sourceLastUpdated: cleanText(record.sourceLastUpdated),
      lastVerified: cleanText(record.lastVerified),
      sourceInfo: {
        sourceName: cleanText(record?.sourceInfo?.sourceName),
        sourceUrl: cleanText(record?.sourceInfo?.sourceUrl),
        lastChecked: cleanText(record?.sourceInfo?.lastChecked),
        notes
      },
      siteStatus: noteValue(notes, "Site status"),
      locationSetting: noteValue(notes, "Location setting"),
      operationalSchedule: noteValue(notes, "Operational schedule")
    };
  });
}

function byNormalizedSourceId(records) {
  return new Map(records.map((record) => [record.normalizedSourceId, record]));
}

function markdownValue(value) {
  const text = cleanText(value);
  if (isMissingValue(text)) return "_(missing)_";
  return text.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

function markdownList(values) {
  if (values.length === 0) return "none";
  return values.map(markdownValue).join("; ");
}

function haversineMiles(a, b) {
  if (
    !Number.isFinite(a.latitude) ||
    !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) ||
    !Number.isFinite(b.longitude)
  ) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const halfChord =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(halfChord), Math.sqrt(1 - halfChord));
}

function stateReviewPriority(count) {
  if (count.additions > 20 || count.removals > 0 || count.changed > 25) return "high";
  if (count.additions > 0 || count.changed > 0) return "medium";
  return "low";
}

function tokens(value) {
  return normalizeSearchText(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

function jaccardScore(left, right) {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function sameNormalizedAddress(left, right) {
  const leftAddress = normalizeSearchText(
    `${left.address} ${left.city} ${left.state} ${String(left.postalCode).slice(0, 5)}`
  );
  const rightAddress = normalizeSearchText(
    `${right.address} ${right.city} ${right.state} ${String(right.postalCode).slice(0, 5)}`
  );
  return leftAddress && leftAddress === rightAddress;
}

function similarProductionMatches(addition, productionRecords) {
  const sameAddress = [];
  const similarAddress = [];
  const similarName = [];

  for (const record of productionRecords) {
    if (sameNormalizedAddress(addition, record)) {
      sameAddress.push(`${record.sourceId} ${record.name}`);
      continue;
    }

    const nameScore = jaccardScore(addition.name, record.name);
    const addressScore = jaccardScore(
      `${addition.address} ${addition.city}`,
      `${record.address} ${record.city}`
    );

    if (addressScore >= 0.85) {
      similarAddress.push(`${record.sourceId} ${record.name}`);
    }
    if (nameScore >= 0.86 && addition.state === record.state) {
      similarName.push(`${record.sourceId} ${record.name}`);
    }
  }

  return {
    sameAddress: sameAddress.slice(0, 3),
    similarAddress: similarAddress.slice(0, 3),
    similarName: similarName.slice(0, 3)
  };
}

async function loadStateGeometries() {
  const geoJson = JSON.parse(
    await readFile(path.join(projectRoot, "public", "data", "us-states.geojson"), "utf8")
  );
  return new Map(
    (geoJson.features ?? []).map((feature) => [
      normalizeStateCode(feature?.properties?.STUSPS),
      feature.geometry
    ])
  );
}

function flattenRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates ?? [];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates ?? []).flat();
  return [];
}

function pointInRing(latitude, longitude, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(latitude, longitude, geometry) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const polygons =
    geometry?.type === "Polygon"
      ? [geometry.coordinates]
      : geometry?.type === "MultiPolygon"
        ? geometry.coordinates
        : [];

  return polygons.some((polygon) => {
    const [outer, ...holes] = polygon;
    return (
      pointInRing(latitude, longitude, outer ?? []) &&
      !holes.some((hole) => pointInRing(latitude, longitude, hole))
    );
  });
}

function pointSegmentDistanceMiles(point, start, end) {
  const latRad = (point.latitude * Math.PI) / 180;
  const milesPerDegreeLat = 69.0;
  const milesPerDegreeLon = Math.cos(latRad) * 69.172;
  const px = point.longitude * milesPerDegreeLon;
  const py = point.latitude * milesPerDegreeLat;
  const sx = start[0] * milesPerDegreeLon;
  const sy = start[1] * milesPerDegreeLat;
  const ex = end[0] * milesPerDegreeLon;
  const ey = end[1] * milesPerDegreeLat;
  const dx = ex - sx;
  const dy = ey - sy;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lengthSquared));
  const closestX = sx + t * dx;
  const closestY = sy + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}

function distanceToStateBoundaryMiles(record, geometry) {
  if (!Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)) return null;
  let minimum = Number.POSITIVE_INFINITY;
  for (const ring of flattenRings(geometry)) {
    for (let index = 1; index < ring.length; index += 1) {
      minimum = Math.min(
        minimum,
        pointSegmentDistanceMiles(record, ring[index - 1], ring[index])
      );
    }
  }
  return Number.isFinite(minimum) ? minimum : null;
}

async function additionRisk(addition, productionRecords, stateBounds, stateGeometries) {
  const flags = [];
  const matches = similarProductionMatches(addition, productionRecords);
  const bounds = stateBounds.get(addition.state);
  const geometry = stateGeometries.get(addition.state);
  const boundaryDistance = distanceToStateBoundaryMiles(addition, geometry);

  if (isMissingValue(addition.address)) flags.push("missing address");
  if (isMissingValue(addition.phone)) flags.push("missing phone");
  if (isMissingValue(addition.website)) flags.push("missing website");
  if (!/^BPS-(?:H80|LAL)-\d{6}$/i.test(addition.sourceId)) {
    flags.push("source ID pattern unusual");
  }
  if (
    bounds &&
    !isWithinStateBounds(addition.latitude, addition.longitude, bounds)
  ) {
    flags.push("state mismatch");
  } else if (
    geometry &&
    !pointInGeometry(addition.latitude, addition.longitude, geometry)
  ) {
    flags.push("state mismatch");
  }
  if (boundaryDistance !== null && boundaryDistance <= 5) {
    flags.push(`coordinate near border/boundary (${boundaryDistance.toFixed(1)} mi)`);
  }
  if (matches.sameAddress.length > 0) flags.push("same/similar address as existing production record");
  if (matches.similarAddress.length > 0) flags.push("same/similar address as existing production record");
  if (matches.similarName.length > 0) flags.push("same/similar name as existing production record");
  if (matches.sameAddress.length > 0 || (matches.similarAddress.length > 0 && matches.similarName.length > 0)) {
    flags.push("likely duplicate by name/address");
  }

  const uniqueFlags = [...new Set(flags)];
  const action =
    uniqueFlags.includes("state mismatch") ||
    uniqueFlags.includes("source ID pattern unusual") ||
    uniqueFlags.includes("likely duplicate by name/address")
      ? "suspicious/hold"
      : uniqueFlags.length > 0
        ? "needs manual source confirmation"
        : "likely safe to stage later";

  return {
    flags: uniqueFlags,
    action
  };
}

function changeRisk(change, category, productionRecord, upstreamRecord) {
  if (category === "identity" || category === "statusType") return "high";
  if (category === "contact") return "medium";
  if (category === "addressLocation") {
    return change.fields.some((field) =>
      ["address", "city", "state", "county", "countyFips"].includes(field.field)
    )
      ? "medium"
      : "low";
  }

  const move = haversineMiles(productionRecord, upstreamRecord);
  if (move === null) return "medium";
  if (move > 1) return "high";
  if (move > 0.25) return "medium";
  return "low";
}

function changedFieldSummary(change) {
  return change.fields.map((field) => fieldLabels[field.field] ?? field.field).join(", ");
}

function productionValues(change) {
  return change.fields
    .map((field) => `${fieldLabels[field.field] ?? field.field}: ${markdownValue(field.production)}`)
    .join("; ");
}

function upstreamValues(change) {
  return change.fields
    .map((field) => `${fieldLabels[field.field] ?? field.field}: ${markdownValue(field.upstream)}`)
    .join("; ");
}

function coordinateBoundaryImpact(moveMiles, sameState) {
  if (!sameState) return "yes - state mismatch must be reviewed";
  if (moveMiles === null) return "unknown - coordinate values need review";
  if (moveMiles > 0.25) return "possible - rerun facility-boundary assignments after promotion";
  return "unlikely, but regenerate assignments after any coordinate promotion";
}

function highestRiskItems(additionRows, coordinateRows, missingRows) {
  const items = [];
  const heldAdditions = additionRows
    .filter((row) => row.action === "suspicious/hold")
    .slice(0, 8)
    .map((row) => `${row.sourceId} (${row.state}) - ${row.flags.join("; ")}`);
  if (heldAdditions.length > 0) {
    items.push("Suspicious/hold additions to review before staging:");
    items.push(...heldAdditions);
  }

  const largerMoves = coordinateRows
    .filter((row) => row.moveMiles !== null && row.moveMiles > 0.25)
    .slice(0, 8)
    .map((row) => `${row.sourceId} (${row.state}) moved ${row.moveMiles.toFixed(2)} mi`);
  if (largerMoves.length > 0) {
    items.push("Coordinate changes over 0.25 miles:");
    items.push(...largerMoves);
  }

  if (missingRows.length > 0) {
    items.push(
      `Production records missing upstream: ${missingRows
        .map((row) => `${row.sourceId} (${row.state})`)
        .join(", ")}`
    );
  }

  items.push("NJ additions are the largest review queue and should be reviewed first.");
  return items;
}

function stateSummaryRows(audit) {
  return audit.stateCounts.map((count) => ({
    ...count,
    priority: stateReviewPriority(count)
  }));
}

async function buildPacket({
  auditReportPath,
  inputPath,
  outputPath,
  productionPath,
  states
}) {
  const [upstreamRaw, productionRaw] = await Promise.all([
    readFile(inputPath, "utf8"),
    readFile(productionPath, "utf8")
  ]);
  const stateSet = new Set(states);
  const upstreamRecords = normalizeUpstreamRows(upstreamRaw).filter((record) =>
    stateSet.has(record.state)
  );
  const productionRecords = normalizeProductionRows(JSON.parse(productionRaw)).filter(
    (record) => stateSet.has(record.state)
  );
  const upstreamById = byNormalizedSourceId(upstreamRecords);
  const productionById = byNormalizedSourceId(productionRecords);
  const audit = await runHrsaRefreshAudit({
    inputPath,
    productionPath,
    states,
    writeReport: false,
    date: new Date(`${path.basename(outputPath).match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "2026-06-24"}T12:00:00Z`)
  });
  const stateBounds = new Map(
    await Promise.all(states.map(async (state) => [state, await loadStateBounds(projectRoot, state)]))
  );
  const stateGeometries = await loadStateGeometries();
  const additionRows = [];

  for (const addition of audit.additions) {
    const upstreamRecord = upstreamById.get(addition.normalizedSourceId);
    const risk = await additionRisk(
      upstreamRecord,
      productionRecords,
      stateBounds,
      stateGeometries
    );
    additionRows.push({
      ...upstreamRecord,
      ...risk
    });
  }

  const missingRows = audit.removals.map((removal) => {
    const productionRecord = productionById.get(removal.normalizedSourceId);
    return {
      ...productionRecord,
      action:
        "do not remove automatically; verify against HRSA source/history; check if source ID changed, site closed, merged, or data issue"
    };
  });

  const coordinateRows = audit.changes.coordinates.map((change) => {
    const productionRecord = productionById.get(change.normalizedSourceId);
    const upstreamRecord = upstreamById.get(change.normalizedSourceId);
    const moveMiles = haversineMiles(productionRecord, upstreamRecord);
    const sameState =
      upstreamRecord?.state === productionRecord?.state &&
      pointInGeometry(upstreamRecord?.latitude, upstreamRecord?.longitude, stateGeometries.get(upstreamRecord?.state));
    return {
      ...change,
      productionRecord,
      upstreamRecord,
      moveMiles,
      sameState,
      risk: changeRisk(change, "coordinates", productionRecord, upstreamRecord)
    };
  });
  const addressRows = audit.changes.addressLocation.map((change) => ({
    ...change,
    risk: changeRisk(
      change,
      "addressLocation",
      productionById.get(change.normalizedSourceId),
      upstreamById.get(change.normalizedSourceId)
    )
  }));
  const contactRows = audit.changes.contact.map((change) => ({
    ...change,
    risk: changeRisk(
      change,
      "contact",
      productionById.get(change.normalizedSourceId),
      upstreamById.get(change.normalizedSourceId)
    )
  }));
  const identityRows = audit.changes.identity.map((change) => ({
    ...change,
    risk: changeRisk(
      change,
      "identity",
      productionById.get(change.normalizedSourceId),
      upstreamById.get(change.normalizedSourceId)
    )
  }));
  const statusRows = audit.changes.statusType.map((change) => ({
    ...change,
    risk: changeRisk(
      change,
      "statusType",
      productionById.get(change.normalizedSourceId),
      upstreamById.get(change.normalizedSourceId)
    )
  }));
  const categoryCounts = {
    coordinate: coordinateRows.length,
    addressPostal: addressRows.length,
    phoneWebsite: contactRows.length,
    identityName: identityRows.length,
    statusType: statusRows.length
  };
  const additionsByState = Object.fromEntries(
    states.map((state) => [
      state,
      additionRows.filter((record) => record.state === state).length
    ])
  );
  const highRisk = highestRiskItems(additionRows, coordinateRows, missingRows);
  const lines = [
    `# HRSA Refresh Human-Review Packet - ${audit.auditDate}`,
    "",
    "> Review-only packet. This file does not stage, promote, remove, regenerate, or update production healthcare records.",
    "",
    "## Executive Summary",
    "",
    `- Audit report: \`${toProjectPath(auditReportPath)}\``,
    `- Official CSV: \`${toProjectPath(inputPath)}\``,
    `- Production comparison file: \`${toProjectPath(productionPath)}\``,
    `- Total production records in scope: ${audit.counts.productionRows}`,
    `- Total upstream records in scope: ${audit.counts.upstreamRows}`,
    `- Matched records: ${audit.counts.matched}`,
    `- Upstream additions: ${additionRows.length}`,
    `- Production records missing upstream: ${missingRows.length}`,
    `- Changed records: ${new Set(Object.values(audit.changes).flat().map((change) => change.normalizedSourceId)).size}`,
    `- Duplicate source IDs: ${audit.duplicateUpstream.length} upstream, ${audit.duplicateProduction.length} production`,
    `- Invalid coordinates: ${audit.invalidCoordinates.length}`,
    `- Out-of-bounds coordinates: ${audit.outOfBounds.length}`,
    "- Recommended decision: do not refresh automatically.",
    "",
    "Highest-risk review items:",
    ...highRisk.map((item) => `- ${item}`),
    "",
    "## State-by-State Summary",
    "",
    "| State | Production count | Upstream count | Matched count | Additions | Missing upstream | Changed records | Review priority |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...stateSummaryRows(audit).map(
      (count) =>
        `| ${count.state} | ${count.productionRows} | ${count.upstreamRows} | ${count.matched} | ${count.additions} | ${count.removals} | ${count.changed} | ${count.priority} |`
    ),
    "",
    "Additions by state:",
    ...states.map((state) => `- ${state}: ${additionsByState[state]}`),
    "",
    "## Additions Review Table",
    "",
    "| State | Source ID | Facility/site name | Address | City | Postal code | Latitude/longitude | Phone | Website | Why it appears new | Review risk flags | Recommended review action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...additionRows.map(
      (record) =>
        `| ${markdownValue(record.state)} | ${markdownValue(record.sourceId)} | ${markdownValue(record.name)} | ${markdownValue(record.address)} | ${markdownValue(record.city)} | ${markdownValue(record.postalCode)} | ${markdownValue(`${record.latitude}, ${record.longitude}`)} | ${markdownValue(record.phone)} | ${markdownValue(record.website)} | Source ID was present in the official HRSA CSV but not in production. | ${markdownList(record.flags)} | ${markdownValue(record.action)} |`
    ),
    "",
    "## Missing-Upstream Review Table",
    "",
    "| State | Source ID | Facility/site name | Production address | Production phone/website | Last source metadata available | Recommended action |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...missingRows.map(
      (record) =>
        `| ${markdownValue(record.state)} | ${markdownValue(record.sourceId)} | ${markdownValue(record.name)} | ${markdownValue(`${record.address}, ${record.city}, ${record.state} ${record.postalCode}`)} | ${markdownValue(`phone=${record.phone}; website=${record.website}`)} | ${markdownValue(`sourceName=${record.sourceInfo.sourceName}; sourceUrl=${record.sourceInfo.sourceUrl}; sourceLastUpdated=${record.sourceLastUpdated}; lastChecked=${record.sourceInfo.lastChecked}; lastVerified=${record.lastVerified}`)} | ${markdownValue(record.action)} |`
    ),
    "",
    "## Changed-Records Review Table",
    "",
    "Changed-record counts by category:",
    `- Coordinate changes: ${categoryCounts.coordinate}`,
    `- Address/postal changes: ${categoryCounts.addressPostal}`,
    `- Phone/website changes: ${categoryCounts.phoneWebsite}`,
    `- Identity/name changes: ${categoryCounts.identityName}`,
    `- Status/type changes: ${categoryCounts.statusType}`,
    "",
    "### Coordinate Changes",
    "",
    "| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Approx. distance moved | Same state | May affect boundary assignment | Review risk level |",
    "| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |",
    ...coordinateRows.map(
      (row) =>
        `| ${markdownValue(row.state)} | ${markdownValue(row.sourceId)} | ${markdownValue(row.name)} | ${markdownValue(changedFieldSummary(row))} | ${markdownValue(`${row.productionRecord.latitude}, ${row.productionRecord.longitude}`)} | ${markdownValue(`${row.upstreamRecord.latitude}, ${row.upstreamRecord.longitude}`)} | ${row.moveMiles === null ? "_(unknown)_" : row.moveMiles.toFixed(3)} mi | ${row.sameState ? "yes" : "no"} | ${coordinateBoundaryImpact(row.moveMiles, row.sameState)} | ${row.risk} |`
    ),
    "",
    "### Address/Postal Changes",
    "",
    "| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Review risk level |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...(addressRows.length === 0
      ? ["| _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ |"]
      : addressRows.map(
          (row) =>
            `| ${markdownValue(row.state)} | ${markdownValue(row.sourceId)} | ${markdownValue(row.name)} | ${markdownValue(changedFieldSummary(row))} | ${markdownValue(productionValues(row))} | ${markdownValue(upstreamValues(row))} | ${row.risk} |`
        )),
    "",
    "### Phone/Website Changes",
    "",
    "| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Review risk level |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...(contactRows.length === 0
      ? ["| _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ |"]
      : contactRows.map(
          (row) =>
            `| ${markdownValue(row.state)} | ${markdownValue(row.sourceId)} | ${markdownValue(row.name)} | ${markdownValue(changedFieldSummary(row))} | ${markdownValue(productionValues(row))} | ${markdownValue(upstreamValues(row))} | ${row.risk} |`
        )),
    "",
    "### Identity/Name Changes",
    "",
    "| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Review risk level |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...(identityRows.length === 0
      ? ["| _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ |"]
      : identityRows.map(
          (row) =>
            `| ${markdownValue(row.state)} | ${markdownValue(row.sourceId)} | ${markdownValue(row.name)} | ${markdownValue(changedFieldSummary(row))} | ${markdownValue(productionValues(row))} | ${markdownValue(upstreamValues(row))} | ${row.risk} |`
        )),
    "",
    "### Status/Type Changes",
    "",
    "| State | Source ID | Facility/site name | Changed fields | Production value | Upstream value | Review risk level |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...(statusRows.length === 0
      ? ["| _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ | _(none)_ |"]
      : statusRows.map(
          (row) =>
            `| ${markdownValue(row.state)} | ${markdownValue(row.sourceId)} | ${markdownValue(row.name)} | ${markdownValue(changedFieldSummary(row))} | ${markdownValue(productionValues(row))} | ${markdownValue(upstreamValues(row))} | ${row.risk} |`
        )),
    "",
    "## Recommended Refresh Approach",
    "",
    "Do not run a full automatic refresh.",
    "",
    "1. Manually review additions, starting with NJ because it has the largest queue.",
    "2. Manually review the 2 missing-upstream production records.",
    "3. Review coordinate changes that may alter boundary assignments.",
    "4. Only then run a state-by-state staging workflow.",
    "5. Promote only reviewed and approved records.",
    "6. Regenerate facility-boundary assignments and summaries after promotion.",
    "7. Re-run this packet generator after each future read-only audit so reviewers have a stable queue.",
    "",
    "## Production-Dist Safety",
    "",
    "- This review packet is under `docs/reports` and is not a runtime app asset.",
    "- HRSA audit reports, review packets, official CSVs, staging files and fixtures must not be copied into `dist`.",
    "- `npm run validate:production-dist` is the production artifact check after a build.",
    ""
  ];

  await writeFile(outputPath, lines.join("\n"), "utf8");

  return {
    outputPath,
    additionsByState,
    missingRows,
    categoryCounts,
    highRisk
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const auditReportPath = args.auditReport || (await findLatestAuditReport());
  const auditMarkdown = await readFile(auditReportPath, "utf8");
  const metadata = extractAuditMetadata(auditReportPath, auditMarkdown);
  const inputPath = args.input || metadata.inputPath;
  const productionPath = args.production || metadata.productionPath;
  const outputPath =
    args.output ||
    path.join(
      reportsDir,
      `hrsa-refresh-review-packet-${metadata.dateText}.md`
    );
  const result = await buildPacket({
    auditReportPath,
    inputPath,
    outputPath,
    productionPath,
    states: args.states
  });

  console.log(`Wrote ${toProjectPath(result.outputPath)}.`);
  console.log(
    `Additions by state: ${Object.entries(result.additionsByState)
      .map(([state, count]) => `${state} ${count}`)
      .join(", ")}.`
  );
  console.log(
    `Changed-record categories: coordinate ${result.categoryCounts.coordinate}, address/postal ${result.categoryCounts.addressPostal}, phone/website ${result.categoryCounts.phoneWebsite}, identity/name ${result.categoryCounts.identityName}, status/type ${result.categoryCounts.statusType}.`
  );
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error("HRSA refresh review packet generation failed.");
    console.error(error.message);
    process.exit(1);
  });
}
