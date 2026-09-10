import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  buildArtifact,
  buildUnmatchedGeocodeReview,
  groupEligibleRows,
  parseCsvMatrix,
  parseNppesDeactivationZip,
  publishGeocodedOffices,
  specialtyFields,
  text
} from "./lib/doctorOfficePipeline.mjs";
import {
  doctorOfficeSourceConfig,
  doctorOfficeSpecialties
} from "./lib/doctorOfficeSourceConfig.mjs";

const root = path.resolve(import.meta.dirname, "..");
const defaultOutputPath = path.join(
  root,
  "public/data/doctor-offices/nj.json"
);
const defaultReviewOutputPath = path.join(
  root,
  "public/data/doctor-offices/staging/unmatched-geocodes.review.json"
);
const countyPath = path.join(root, "public/data/counties/by-state/34.geojson");
const cmsPageSize = 1500;
const geocoderBatchSize = 5000;

function parseArgs(argv) {
  const args = {
    output: defaultOutputPath,
    reviewOutput: defaultReviewOutputPath
  };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--output=")) {
      args.output = path.resolve(root, arg.slice("--output=".length));
    } else if (arg.startsWith("--review-output=")) {
      args.reviewOutput = path.resolve(
        root,
        arg.slice("--review-output=".length)
      );
    } else throw new Error(`Unknown option ${arg}.`);
  }
  return args;
}

function printHelp() {
  console.log("Import selected New Jersey doctor-office specialties from pinned official CMS sources.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run import:doctor-offices");
  console.log("  npm run import:doctor-offices -- --output=tmp/nj-doctor-offices.json");
  console.log("  npm run import:doctor-offices -- --review-output=tmp/unmatched-review.json");
  console.log("");
  console.log("Update scripts/lib/doctorOfficeSourceConfig.mjs only after reviewing a new official release.");
}

async function fetchWithRetry(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`${label} returned status ${response.status}.`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }
  throw lastError;
}

function getCmsQueryUrl(field, sourceSpecialty, offset) {
  const url = new URL(doctorOfficeSourceConfig.cms.apiUrl);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(cmsPageSize));
  url.searchParams.set("conditions[0][property]", "state");
  url.searchParams.set("conditions[0][value]", doctorOfficeSourceConfig.state);
  url.searchParams.set("conditions[0][operator]", "=");
  url.searchParams.set("conditions[1][property]", field);
  url.searchParams.set("conditions[1][value]", sourceSpecialty);
  url.searchParams.set("conditions[1][operator]", "=");
  return url;
}

async function fetchCmsQuery(field, sourceSpecialty) {
  const rows = [];
  let offset = 0;
  let count = null;
  do {
    const label = `CMS ${field}=${sourceSpecialty} offset ${offset}`;
    const response = await fetchWithRetry(
      getCmsQueryUrl(field, sourceSpecialty, offset),
      undefined,
      label
    );
    const payload = await response.json();
    if (!Array.isArray(payload.results) || !Number.isFinite(Number(payload.count))) {
      throw new Error(`${label} returned an invalid payload.`);
    }
    count = Number(payload.count);
    rows.push(...payload.results);
    offset += payload.results.length;
    if (payload.results.length === 0 && offset < count) {
      throw new Error(`${label} stopped before its reported row count.`);
    }
  } while (offset < count);
  return rows;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return results;
}

async function fetchCmsRows() {
  const metadataResponse = await fetchWithRetry(
    doctorOfficeSourceConfig.cms.metadataUrl,
    undefined,
    "CMS dataset metadata"
  );
  const metadata = await metadataResponse.json();
  if (
    metadata.identifier !== doctorOfficeSourceConfig.cms.datasetId ||
    metadata.modified !== doctorOfficeSourceConfig.cms.dataDate ||
    metadata.released !== doctorOfficeSourceConfig.cms.releaseDate ||
    metadata.nextUpdateDate !== doctorOfficeSourceConfig.cms.nextUpdateDate
  ) {
    throw new Error(
      `CMS release pin mismatch: expected ${doctorOfficeSourceConfig.cms.datasetId} modified ${doctorOfficeSourceConfig.cms.dataDate} released ${doctorOfficeSourceConfig.cms.releaseDate} with next update ${doctorOfficeSourceConfig.cms.nextUpdateDate}; received ${metadata.identifier} modified ${metadata.modified} released ${metadata.released} with next update ${metadata.nextUpdateDate}. Review the new release before importing.`
    );
  }
  const sourceSpecialties = doctorOfficeSpecialties.flatMap(
    ({ sourceSpecialties: labels }) => labels
  );
  const queries = specialtyFields.flatMap((field) =>
    sourceSpecialties.map((sourceSpecialty) => ({ field, sourceSpecialty }))
  );
  const resultSets = await mapWithConcurrency(
    queries,
    5,
    ({ field, sourceSpecialty }) => fetchCmsQuery(field, sourceSpecialty)
  );
  const rows = resultSets.flat();
  console.log(
    `CMS release pin verified; API returned ${rows.length.toLocaleString()} rows across ${queries.length} exact specialty-field queries.`
  );
  return rows;
}

async function fetchNppesDeactivations() {
  const response = await fetchWithRetry(
    doctorOfficeSourceConfig.nppes.deactivationZipUrl,
    undefined,
    "NPPES deactivation download"
  );
  const zipBuffer = Buffer.from(await response.arrayBuffer());
  const parsed = parseNppesDeactivationZip(zipBuffer);
  if (!parsed.reportTitle.includes(
    doctorOfficeSourceConfig.nppes.reportTitleIncludes
  )) {
    throw new Error(`Unexpected NPPES report title: ${parsed.reportTitle}.`);
  }
  console.log(
    `NPPES screening loaded ${parsed.deactivations.size.toLocaleString()} deactivated NPIs from ${parsed.workbookName}.`
  );
  return {
    ...parsed,
    sourceDigestSha256: createHash("sha256").update(zipBuffer).digest("hex")
  };
}

function csvCell(value) {
  const source = String(value ?? "");
  return /[",\r\n]/u.test(source)
    ? `"${source.replace(/"/gu, '""')}"`
    : source;
}

async function geocodeBatch(candidates) {
  const csv = ["id,street,city,state,zip"];
  for (const candidate of candidates) {
    csv.push([
      candidate.id,
      candidate.addressLine1,
      candidate.city,
      candidate.state,
      candidate.postalCode
    ].map(csvCell).join(","));
  }
  const form = new FormData();
  form.append("benchmark", doctorOfficeSourceConfig.censusGeocoder.benchmark);
  form.append(
    "addressFile",
    new Blob([csv.join("\n")], { type: "text/csv" }),
    "doctor-office-addresses.csv"
  );
  const response = await fetchWithRetry(
    doctorOfficeSourceConfig.censusGeocoder.serviceUrl,
    { body: form, method: "POST" },
    "Census batch geocoder"
  );
  const matches = new Map();
  for (const row of parseCsvMatrix(await response.text())) {
    const [id, , matchFlag, matchType, matchedAddress, coordinateText] = row;
    if (text(matchFlag) !== "Match") continue;
    const [longitude, latitude] = text(coordinateText).split(",").map(Number);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    matches.set(text(id), {
      latitude,
      longitude,
      matchedAddress: text(matchedAddress),
      matchType: text(matchType) || "Unknown"
    });
  }
  return matches;
}

async function geocodeCandidates(candidates) {
  const geocodes = new Map();
  for (let start = 0; start < candidates.length; start += geocoderBatchSize) {
    const batch = candidates.slice(start, start + geocoderBatchSize);
    const batchMatches = await geocodeBatch(batch);
    for (const [id, match] of batchMatches) geocodes.set(id, match);
    console.log(
      `Census geocoder batch ${Math.floor(start / geocoderBatchSize) + 1}: ${batchMatches.size.toLocaleString()} of ${batch.length.toLocaleString()} matched.`
    );
  }
  return geocodes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const [cmsRows, nppesStatus, countySource] = await Promise.all([
    fetchCmsRows(),
    fetchNppesDeactivations(),
    readFile(countyPath, "utf8")
  ]);
  const counties = JSON.parse(countySource).features;
  const { candidates, eligibleRows, exclusions } = groupEligibleRows(
    cmsRows,
    nppesStatus.deactivations
  );
  console.log(
    `Eligible source rows: ${eligibleRows.length.toLocaleString()}; candidate office groups: ${candidates.length.toLocaleString()}.`
  );

  const geocodes = await geocodeCandidates(candidates);
  const geocoderResultDigestSha256 = createHash("sha256")
    .update([...geocodes.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([id, match]) => `${id}|${JSON.stringify(match)}`)
      .join("\n"))
    .digest("hex");
  let previousReview = null;
  try {
    previousReview = JSON.parse(await readFile(args.reviewOutput, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const unmatchedReview = buildUnmatchedGeocodeReview({
    candidates,
    geocodes,
    previousReview
  });
  const { offices, rejected } = publishGeocodedOffices(
    candidates,
    geocodes,
    counties
  );
  const artifact = buildArtifact({
    candidateOfficeCount: candidates.length,
    cmsQueryRowCount: cmsRows.length,
    eligibleRows,
    exclusions,
    geocoderResultDigestSha256,
    nppesRecordCount: nppesStatus.deactivations.size,
    nppesSourceDigestSha256: nppesStatus.sourceDigestSha256,
    offices,
    rejected
  });

  await Promise.all([
    mkdir(path.dirname(args.output), { recursive: true }),
    mkdir(path.dirname(args.reviewOutput), { recursive: true })
  ]);
  await writeFile(args.output, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await writeFile(
    args.reviewOutput,
    `${JSON.stringify(unmatchedReview, null, 2)}\n`,
    "utf8"
  );
  console.log(
    `Published ${artifact.coverage.officeCount.toLocaleString()} office groups with ${artifact.coverage.providerCount.toLocaleString()} unique clinicians to ${path.relative(root, args.output)}.`
  );
  console.log(`Exclusions: ${JSON.stringify(artifact.coverage.exclusions)}.`);
  console.log(
    `Queued ${unmatchedReview.recordCount.toLocaleString()} unmatched address groups for non-production review at ${path.relative(root, args.reviewOutput)}.`
  );
}

main().catch((error) => {
  console.error(`Doctor-office import failed: ${error.message}`);
  process.exit(1);
});
