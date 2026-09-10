import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isWithinStateBounds,
  loadStateBounds,
  normalizeStateCode
} from "./lib/stateBounds.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const defaultProductionPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
const defaultStates = ["CT", "DC", "DE", "MA", "MD", "ME", "NH", "NJ", "NY", "PA", "RI", "VA", "VT"];
const officialDatasetName =
  "Health Center Service Delivery and Look-Alike Sites";

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
  operationalSchedule: "Health Center Operational Schedule Description"
};

const comparisonGroups = [
  {
    key: "identity",
    label: "Identity fields",
    fields: ["name", "sourceDataset"]
  },
  {
    key: "addressLocation",
    label: "Address/location fields",
    fields: [
      "address",
      "city",
      "state",
      "stateFips",
      "county",
      "countyFips",
      "postalCode"
    ]
  },
  {
    key: "contact",
    label: "Phone/website fields",
    fields: ["phone", "website"]
  },
  {
    key: "coordinates",
    label: "Coordinates",
    fields: ["latitude", "longitude"]
  },
  {
    key: "statusType",
    label: "Status/type fields",
    fields: [
      "facilityType",
      "siteStatus",
      "locationSetting",
      "operationalSchedule"
    ],
    compareOnlyWhenBothKnown: [
      "siteStatus",
      "locationSetting",
      "operationalSchedule"
    ]
  }
];

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

function parseArgs(argv) {
  const args = {
    input: "",
    production: defaultProductionPath,
    states: defaultStates,
    write: false
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

    if (arg === "--write") {
      args.write = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--input") {
      args.input = path.resolve(projectRoot, nextValue());
    } else if (arg.startsWith("--input=")) {
      args.input = path.resolve(projectRoot, arg.slice("--input=".length));
    } else if (arg === "--states") {
      args.states = parseStates(nextValue());
    } else if (arg.startsWith("--states=")) {
      args.states = parseStates(arg.slice("--states=".length));
    } else if (arg === "--production") {
      args.production = path.resolve(projectRoot, nextValue());
    } else if (arg.startsWith("--production=")) {
      args.production = path.resolve(
        projectRoot,
        arg.slice("--production=".length)
      );
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  return args;
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

  if (states.length === 0 || states.some((state) => !/^[A-Z]{2}$/.test(state))) {
    throw new Error("--states must contain comma-separated two-letter state codes.");
  }

  return states;
}

function printHelp() {
  console.log("Audit current production HRSA records against an official HRSA CSV.");
  console.log("");
  console.log("Usage:");
  console.log(
    "  npm run audit:hrsa-refresh -- --input path/to/official-hrsa.csv --states CT,DE,NJ,NY,PA"
  );
  console.log(
    "  npm run audit:hrsa-refresh -- --input path/to/official-hrsa.csv --states CT,DE,NJ,NY,PA --write"
  );
  console.log("");
  console.log("The audit is read-only. --write only saves a Markdown report under docs/reports/.");
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

function normalizeSourceId(value) {
  return cleanText(value).toUpperCase();
}

function parseCoordinate(value, axis) {
  const text = cleanText(value);
  if (!text) return { value: null, issue: "missing" };

  const parsed = Number(text.replace(/,/g, ""));
  const minimum = axis === "latitude" ? -90 : -180;
  const maximum = axis === "latitude" ? 90 : 180;

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    return { value: null, issue: "invalid", raw: text };
  }

  return { value: parsed, issue: "" };
}

function noteValue(notes, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return cleanText(
    String(notes ?? "").match(new RegExp(`${escaped}:\\s*([^.]*)\\.`, "i"))?.[1]
  );
}

function normalizeUpstreamRows(raw) {
  const parsed = parseCsv(raw);
  if (parsed.length < 2) {
    throw new Error("The official HRSA CSV has no data rows.");
  }

  const headers = parsed[0].map(normalizeHeader);
  const requiredColumns = ["sourceId", "name", "state"];
  const missingColumns = requiredColumns.filter(
    (field) => !headers.includes(normalizeHeader(hrsaColumns[field]))
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Official HRSA columns are missing: ${missingColumns
        .map((field) => hrsaColumns[field])
        .join(", ")}.`
    );
  }

  return parsed.slice(1).map((cells, rowIndex) => {
    const row = Object.fromEntries(
      headers.map((header, index) => [header, cells[index] ?? ""])
    );
    const get = (field) => cleanText(row[normalizeHeader(hrsaColumns[field])]);
    const latitude = parseCoordinate(get("latitude"), "latitude");
    const longitude = parseCoordinate(get("longitude"), "longitude");

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
      latitude: latitude.value,
      longitude: longitude.value,
      latitudeIssue: latitude.issue,
      longitudeIssue: longitude.issue,
      latitudeRaw: latitude.raw ?? get("latitude"),
      longitudeRaw: longitude.raw ?? get("longitude"),
      phone: get("phone"),
      website: get("website"),
      siteStatus: get("siteStatus"),
      locationSetting: get("locationSetting"),
      operationalSchedule: get("operationalSchedule"),
      sourceDataset: officialDatasetName
    };
  });
}

function isHrsaProductionRecord(record) {
  return (
    /^hrsa-/i.test(cleanText(record?.id)) ||
    /hrsa/i.test(cleanText(record?.sourceInfo?.sourceName)) ||
    /health center service delivery/i.test(cleanText(record?.sourceDataset))
  );
}

function normalizeProductionRows(parsed) {
  if (!Array.isArray(parsed)) {
    throw new Error("The production facilities file must contain a JSON array.");
  }

  return parsed.filter(isHrsaProductionRecord).map((record, rowIndex) => {
    const latitude = parseCoordinate(record.latitude, "latitude");
    const longitude = parseCoordinate(record.longitude, "longitude");
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
      latitude: latitude.value,
      longitude: longitude.value,
      latitudeIssue: latitude.issue,
      longitudeIssue: longitude.issue,
      latitudeRaw: latitude.raw ?? cleanText(record.latitude),
      longitudeRaw: longitude.raw ?? cleanText(record.longitude),
      phone: cleanText(record.phone),
      website: cleanText(record.website),
      siteStatus: noteValue(notes, "Site status"),
      locationSetting: noteValue(notes, "Location setting"),
      operationalSchedule: noteValue(notes, "Operational schedule"),
      sourceDataset: cleanText(record.sourceDataset)
    };
  });
}

function groupBySourceId(records) {
  const groups = new Map();

  for (const record of records) {
    if (!record.normalizedSourceId) continue;
    const group = groups.get(record.normalizedSourceId) ?? [];
    group.push(record);
    groups.set(record.normalizedSourceId, group);
  }

  return groups;
}

function comparableValuesEqual(field, productionValue, upstreamValue) {
  if (field === "latitude" || field === "longitude") {
    if (productionValue === null || upstreamValue === null) {
      return productionValue === upstreamValue;
    }
    return Math.abs(productionValue - upstreamValue) <= 0.000001;
  }

  return cleanText(productionValue) === cleanText(upstreamValue);
}

function compareMatchedRecords(productionGroups, upstreamGroups) {
  const changes = Object.fromEntries(
    comparisonGroups.map((group) => [group.key, []])
  );

  for (const [sourceId, productionRecords] of productionGroups) {
    const upstreamRecords = upstreamGroups.get(sourceId);
    if (
      !upstreamRecords ||
      productionRecords.length !== 1 ||
      upstreamRecords.length !== 1
    ) {
      continue;
    }

    const production = productionRecords[0];
    const upstream = upstreamRecords[0];

    for (const group of comparisonGroups) {
      const changedFields = [];

      for (const field of group.fields) {
        if (
          group.compareOnlyWhenBothKnown?.includes(field) &&
          (!cleanText(production[field]) || !cleanText(upstream[field]))
        ) {
          continue;
        }

        if (!comparableValuesEqual(field, production[field], upstream[field])) {
          changedFields.push({
            field,
            production: production[field],
            upstream: upstream[field]
          });
        }
      }

      if (changedFields.length > 0) {
        changes[group.key].push({
          sourceId: upstream.sourceId || production.sourceId,
          normalizedSourceId: sourceId,
          state: upstream.state || production.state,
          name: upstream.name || production.name,
          fields: changedFields
        });
      }
    }
  }

  return changes;
}

function coordinateIssues(dataset, records) {
  return records
    .filter((record) => record.latitudeIssue || record.longitudeIssue)
    .map((record) => ({
      dataset,
      sourceId: record.sourceId,
      state: record.state,
      name: record.name,
      latitude: record.latitudeRaw,
      longitude: record.longitudeRaw,
      issue: [
        record.latitudeIssue && `latitude ${record.latitudeIssue}`,
        record.longitudeIssue && `longitude ${record.longitudeIssue}`
      ]
        .filter(Boolean)
        .join(", ")
    }));
}

function outOfBoundsRecords(dataset, records, boundsByState) {
  return records
    .filter((record) => {
      if (record.latitudeIssue || record.longitudeIssue) return false;
      const bounds = boundsByState.get(record.state);
      return bounds && !isWithinStateBounds(record.latitude, record.longitude, bounds);
    })
    .map((record) => ({
      dataset,
      sourceId: record.sourceId,
      state: record.state,
      name: record.name,
      latitude: record.latitude,
      longitude: record.longitude
    }));
}

function sourceIdSummary(records) {
  return records.map((record) => ({
    sourceId: record.sourceId,
    normalizedSourceId: record.normalizedSourceId,
    state: record.state,
    name: record.name
  }));
}

function duplicateSummary(groups) {
  return [...groups.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([normalizedSourceId, records]) => ({
      sourceId: records[0].sourceId,
      normalizedSourceId,
      count: records.length,
      states: [...new Set(records.map((record) => record.state))].sort(),
      names: [...new Set(records.map((record) => record.name))].sort()
    }));
}

function changedIdSet(changes) {
  return new Set(
    Object.values(changes)
      .flat()
      .map((change) => change.normalizedSourceId)
  );
}

function buildStateCounts({
  states,
  upstreamRecords,
  productionRecords,
  upstreamGroups,
  productionGroups,
  changes,
  invalidCoordinates,
  outOfBounds
}) {
  const changedIds = changedIdSet(changes);

  return states.map((state) => {
    const upstreamStateRows = upstreamRecords.filter((record) => record.state === state);
    const productionStateRows = productionRecords.filter((record) => record.state === state);
    const upstreamIds = new Set(
      upstreamStateRows.map((record) => record.normalizedSourceId).filter(Boolean)
    );
    const productionIds = new Set(
      productionStateRows.map((record) => record.normalizedSourceId).filter(Boolean)
    );
    const matched = [...upstreamIds].filter((id) => productionGroups.has(id));
    const additions = [...upstreamIds].filter((id) => !productionGroups.has(id));
    const removals = [...productionIds].filter((id) => !upstreamGroups.has(id));

    return {
      state,
      upstreamRows: upstreamStateRows.length,
      upstreamIds: upstreamIds.size,
      productionRows: productionStateRows.length,
      productionIds: productionIds.size,
      matched: matched.length,
      additions: additions.length,
      removals: removals.length,
      changed: matched.filter((id) => changedIds.has(id)).length,
      invalidCoordinates: invalidCoordinates.filter((item) => item.state === state).length,
      outOfBounds: outOfBounds.filter((item) => item.state === state).length
    };
  });
}

function markdownValue(value) {
  if (value === null || value === undefined || cleanText(value) === "") return "_(missing)_";
  return cleanText(value).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

function markdownRecordList(records, emptyText) {
  if (records.length === 0) return `${emptyText}\n`;
  return `${records
    .map(
      (record) =>
        `- \`${markdownValue(record.sourceId)}\` — ${markdownValue(record.name)} (${markdownValue(record.state)})`
    )
    .join("\n")}\n`;
}

function markdownDuplicateList(records) {
  if (records.length === 0) return "None.\n";
  return `${records
    .map(
      (record) =>
        `- \`${markdownValue(record.sourceId)}\` — ${record.count} rows; states: ${record.states.map(markdownValue).join(", ")}; names: ${record.names.map(markdownValue).join(" / ")}`
    )
    .join("\n")}\n`;
}

function markdownChanges(label, records) {
  const lines = [`## Changed ${label.toLowerCase()}`, ""];
  if (records.length === 0) return `${lines.join("\n")}None.\n`;

  lines.push("| Source ID | State | Field | Production | Official HRSA CSV |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const record of records) {
    for (const field of record.fields) {
      lines.push(
        `| ${markdownValue(record.sourceId)} | ${markdownValue(record.state)} | ${fieldLabels[field.field]} | ${markdownValue(field.production)} | ${markdownValue(field.upstream)} |`
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

function buildMarkdown(audit) {
  const lines = [
    `# HRSA Refresh Audit — ${audit.auditDate}`,
    "",
    "> Read-only comparison. This report does not update, promote, or remove production records. Every proposed refresh requires manual review.",
    "",
    `- Official CSV: \`${audit.inputPath}\``,
    `- Production comparison file: \`${audit.productionPath}\``,
    `- States: ${audit.states.join(", ")}`,
    `- Official rows in scope: ${audit.counts.upstreamRows}`,
    `- Production HRSA rows in scope: ${audit.counts.productionRows}`,
    `- Matched stable source IDs: ${audit.counts.matched}`,
    `- Comparable one-to-one matches: ${audit.counts.comparableMatched}`,
    `- New upstream source IDs: ${audit.additions.length}`,
    `- Production source IDs missing upstream: ${audit.removals.length}`,
    `- Duplicate upstream source IDs: ${audit.duplicateUpstream.length}`,
    `- Duplicate production source IDs: ${audit.duplicateProduction.length}`,
    `- Official rows missing a stable source ID: ${audit.counts.missingUpstreamSourceIds}`,
    `- Production HRSA rows missing a stable source ID: ${audit.counts.missingProductionSourceIds}`,
    "",
    "## State-by-state counts",
    "",
    "| State | Upstream rows | Upstream IDs | Production rows | Production IDs | Matched | Additions | Missing upstream | Changed | Coordinate issues | Out of bounds |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const count of audit.stateCounts) {
    lines.push(
      `| ${count.state} | ${count.upstreamRows} | ${count.upstreamIds} | ${count.productionRows} | ${count.productionIds} | ${count.matched} | ${count.additions} | ${count.removals} | ${count.changed} | ${count.invalidCoordinates} | ${count.outOfBounds} |`
    );
  }

  lines.push(
    "",
    "## Matched production records",
    "",
    markdownRecordList(audit.matched, "None."),
    "## New upstream records not in production",
    "",
    markdownRecordList(audit.additions, "None."),
    "## Production records missing upstream",
    "",
    markdownRecordList(audit.removals, "None."),
    "## Duplicate upstream source IDs",
    "",
    markdownDuplicateList(audit.duplicateUpstream),
    "## Duplicate production source IDs",
    "",
    markdownDuplicateList(audit.duplicateProduction)
  );

  for (const group of comparisonGroups) {
    lines.push(markdownChanges(group.label, audit.changes[group.key]));
  }

  lines.push("## Missing or invalid coordinates", "");
  if (audit.invalidCoordinates.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push("| Dataset | Source ID | State | Latitude | Longitude | Issue |", "| --- | --- | --- | --- | --- | --- |");
    for (const item of audit.invalidCoordinates) {
      lines.push(
        `| ${markdownValue(item.dataset)} | ${markdownValue(item.sourceId)} | ${markdownValue(item.state)} | ${markdownValue(item.latitude)} | ${markdownValue(item.longitude)} | ${markdownValue(item.issue)} |`
      );
    }
    lines.push("");
  }

  lines.push("## Out-of-bounds coordinates", "");
  if (audit.outOfBounds.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push("| Dataset | Source ID | State | Latitude | Longitude |", "| --- | --- | --- | ---: | ---: |");
    for (const item of audit.outOfBounds) {
      lines.push(
        `| ${markdownValue(item.dataset)} | ${markdownValue(item.sourceId)} | ${markdownValue(item.state)} | ${item.latitude} | ${item.longitude} |`
      );
    }
    lines.push("");
  }

  lines.push(
    "## Interpretation",
    "",
    "- Additions are official source IDs that do not currently exist in production. They are candidates for manual review, not automatic inserts.",
    "- Missing-upstream records exist in production but not in this official CSV/state scope. Confirm the source and status manually before any future removal.",
    "- Changed fields are one-to-one stable-ID comparisons. Duplicate IDs are excluded from field comparison because the match is ambiguous.",
    "- Coordinate issues require source-backed correction or a documented hold. Do not infer missing coordinates.",
    "- This audit never changes `public/data/healthcare/facilities.json` and does not approve, stage, promote, or remove records.",
    ""
  );

  return lines.join("\n");
}

function toProjectPath(filePath) {
  const relative = path.relative(projectRoot, filePath).replaceAll("\\", "/");
  return relative.startsWith("..") ? filePath.replaceAll("\\", "/") : relative;
}

function auditDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export async function runHrsaRefreshAudit({
  inputPath,
  productionPath = defaultProductionPath,
  states = defaultStates,
  writeReport = false,
  date = new Date()
}) {
  if (!inputPath) throw new Error("Missing --input path to an official HRSA CSV.");

  const normalizedStates = parseStates(states.join(","));
  const stateSet = new Set(normalizedStates);
  const [upstreamRaw, productionRaw] = await Promise.all([
    readFile(inputPath, "utf8"),
    readFile(productionPath, "utf8")
  ]);
  const upstreamAll = normalizeUpstreamRows(upstreamRaw);
  const productionAll = normalizeProductionRows(JSON.parse(productionRaw));
  const upstreamRecords = upstreamAll.filter((record) => stateSet.has(record.state));
  const productionRecords = productionAll.filter((record) => stateSet.has(record.state));
  const upstreamGroups = groupBySourceId(upstreamRecords);
  const productionGroups = groupBySourceId(productionRecords);
  const duplicateUpstream = duplicateSummary(upstreamGroups);
  const duplicateProduction = duplicateSummary(productionGroups);
  const matchedIds = [...upstreamGroups.keys()].filter((id) => productionGroups.has(id));
  const comparableMatched = matchedIds.filter(
    (id) => upstreamGroups.get(id).length === 1 && productionGroups.get(id).length === 1
  );
  const additions = sourceIdSummary(
    [...upstreamGroups.entries()]
      .filter(([id]) => !productionGroups.has(id))
      .map(([, records]) => records[0])
  );
  const matched = sourceIdSummary(
    matchedIds.map((id) => productionGroups.get(id)[0])
  );
  const removals = sourceIdSummary(
    [...productionGroups.entries()]
      .filter(([id]) => !upstreamGroups.has(id))
      .map(([, records]) => records[0])
  );
  const changes = compareMatchedRecords(productionGroups, upstreamGroups);
  const boundsEntries = await Promise.all(
    normalizedStates.map(async (state) => [state, await loadStateBounds(projectRoot, state)])
  );
  const boundsByState = new Map(boundsEntries);
  const invalidCoordinates = [
    ...coordinateIssues("official HRSA CSV", upstreamRecords),
    ...coordinateIssues("production", productionRecords)
  ];
  const outOfBounds = [
    ...outOfBoundsRecords("official HRSA CSV", upstreamRecords, boundsByState),
    ...outOfBoundsRecords("production", productionRecords, boundsByState)
  ];
  const missingUpstreamSourceIds = upstreamRecords.filter(
    (record) => !record.normalizedSourceId
  );
  const missingProductionSourceIds = productionRecords.filter(
    (record) => !record.normalizedSourceId
  );
  const dateText = auditDate(date);
  const reportPath = path.join(
    projectRoot,
    "docs",
    "reports",
    `hrsa-refresh-audit-${dateText}.md`
  );

  const audit = {
    auditDate: dateText,
    inputPath: toProjectPath(inputPath),
    productionPath: toProjectPath(productionPath),
    reportPath,
    states: normalizedStates,
    counts: {
      upstreamRows: upstreamRecords.length,
      productionRows: productionRecords.length,
      matched: matchedIds.length,
      comparableMatched: comparableMatched.length,
      missingUpstreamSourceIds: missingUpstreamSourceIds.length,
      missingProductionSourceIds: missingProductionSourceIds.length
    },
    additions,
    matched,
    removals,
    duplicateUpstream,
    duplicateProduction,
    changes,
    invalidCoordinates,
    outOfBounds
  };
  audit.stateCounts = buildStateCounts({
    states: normalizedStates,
    upstreamRecords,
    productionRecords,
    upstreamGroups,
    productionGroups,
    changes,
    invalidCoordinates,
    outOfBounds
  });
  audit.markdown = buildMarkdown(audit);

  if (writeReport) {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, audit.markdown, "utf8");
  }

  return audit;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.input) throw new Error("Missing --input path to an official HRSA CSV.");

  const audit = await runHrsaRefreshAudit({
    inputPath: args.input,
    productionPath: args.production,
    states: args.states,
    writeReport: args.write
  });

  console.log(audit.markdown);
  if (args.write) {
    console.log(`Wrote ${toProjectPath(audit.reportPath)}.`);
  } else {
    console.log("Dry run only. No report or production data was written.");
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error("HRSA refresh audit failed.");
    console.error(error.message);
    process.exit(1);
  });
}
