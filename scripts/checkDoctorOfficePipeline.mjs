import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  buildUnmatchedGeocodeReview,
  getOfficeGroupKey,
  getSourceRowId,
  getSpecialtyIds,
  parseCsvMatrix,
  specialtyFields
} from "./lib/doctorOfficePipeline.mjs";
import {
  doctorOfficeSourceConfig,
  doctorOfficeSpecialties
} from "./lib/doctorOfficeSourceConfig.mjs";

const root = path.resolve(import.meta.dirname, "..");
const [importer, pipeline, reviewer, stagingReadme, artifactSource] = await Promise.all([
  readFile(path.join(root, "scripts/importCmsDoctorOffices.mjs"), "utf8"),
  readFile(path.join(root, "scripts/lib/doctorOfficePipeline.mjs"), "utf8"),
  readFile(path.join(root, "scripts/reviewDoctorOfficeGeocodes.mjs"), "utf8"),
  readFile(path.join(root, "public/data/doctor-offices/staging/README.md"), "utf8"),
  readFile(path.join(root, "public/data/doctor-offices/nj.json"), "utf8")
]);
const artifact = JSON.parse(artifactSource);
const artifactBytes = Buffer.byteLength(artifactSource);
const artifactGzipBytes = gzipSync(Buffer.from(artifactSource), {
  level: 9
}).byteLength;

assert.equal(doctorOfficeSourceConfig.cms.datasetId, "mj5m-pzi6");
assert.equal(doctorOfficeSourceConfig.state, "NJ");
assert.equal(doctorOfficeSourceConfig.stateFips, "34");
assert.match(doctorOfficeSourceConfig.cms.releaseDate, /^\d{4}-\d{2}-\d{2}$/u);
assert.match(doctorOfficeSourceConfig.nppes.releaseDate, /^\d{4}-\d{2}-\d{2}$/u);
assert(
  doctorOfficeSourceConfig.nppes.deactivationZipUrl.includes(
    "NPPES_Deactivated_NPI_Report_081026_V2.zip"
  )
);
assert.equal(doctorOfficeSourceConfig.refreshPolicy.cadence, "monthly");
assert.equal(doctorOfficeSourceConfig.refreshPolicy.staleAfterDays, 45);
assert.equal(
  doctorOfficeSourceConfig.refreshPolicy.nextReviewDate,
  doctorOfficeSourceConfig.cms.nextUpdateDate
);
assert.equal(specialtyFields.length, 5);
assert.deepEqual(
  doctorOfficeSpecialties.map(({ id }) => id),
  ["pediatrics", "dermatology", "oncology"]
);
assert.deepEqual(getSpecialtyIds({ pri_spec: "PEDIATRIC MEDICINE" }), ["pediatrics"]);
assert.deepEqual(getSpecialtyIds({ sec_spec_3: "DERMATOLOGY" }), ["dermatology"]);
assert.deepEqual(
  getSpecialtyIds({
    pri_spec: "MEDICAL ONCOLOGY",
    sec_spec_1: "HEMATOLOGY/ONCOLOGY"
  }),
  ["oncology"]
);
assert.deepEqual(getSpecialtyIds({ pri_spec: "INTERNAL MEDICINE" }), []);

const unmatchedReview = buildUnmatchedGeocodeReview({
  candidates: [{
    addressLine1: "1 Fixture Street",
    addressLine2: null,
    city: "Fixture City",
    displayName: "Fixture practice location",
    groupKey: "fixture-address|1 FIXTURE STREET|FIXTURE CITY|NJ|00000",
    id: "fixture-office",
    practiceNames: ["Fixture practice"],
    postalCode: "00000",
    providers: [{ npi: "0000000000" }],
    specialtyIds: ["pediatrics"],
    state: "NJ"
  }],
  geocodes: new Map(),
  previousReview: null
});
assert.equal(unmatchedReview.recordCount, 1);
assert.equal(unmatchedReview.records[0].reason, "census_geocoder_unmatched");
assert.equal(unmatchedReview.records[0].review.status, "pending");
assert(!("latitude" in unmatchedReview.records[0]));
assert(!("longitude" in unmatchedReview.records[0]));

const identityOnlyRow = {
  npi: "source-npi",
  ind_enrl_id: "source-enrollment",
  org_pac_id: "",
  adrs_id: "source-address-id",
  adr_ln_1: "source-address-line",
  adr_ln_2: "",
  citytown: "source-city",
  state: "NJ",
  zip_code: "source-zip"
};
assert.equal(
  getSourceRowId(identityOnlyRow),
  "source-npi|source-enrollment|solo|source-address-id"
);
assert(
  getOfficeGroupKey(identityOnlyRow).startsWith(
    "source-address-id|SOURCE-ADDRESS-LINE"
  )
);
assert.deepEqual(
  parseCsvMatrix('1,"input address",Match,Exact,"matched address","-74.1,40.2"\n'),
  [["1", "input address", "Match", "Exact", "matched address", "-74.1,40.2"]]
);

assert(
  importer.includes("conditions[1][property]") &&
    importer.includes("CMS release pin mismatch") &&
    importer.includes("cmsPageSize = 1500") &&
    importer.includes("fetchNppesDeactivations") &&
    importer.includes("geocoderBatchSize = 5000") &&
    importer.includes("FormData") &&
    importer.includes("publishGeocodedOffices") &&
    importer.includes("buildUnmatchedGeocodeReview") &&
    importer.includes("reviewOutput"),
  "Importer must retain exact specialty queries, official status screening, batch geocoding and the unmatched-address review queue."
);
assert(
  pipeline.includes("duplicateQueryResult") &&
    pipeline.includes("not_deactivated_in_snapshot") &&
    pipeline.includes("sourceRowDigestSha256") &&
    pipeline.includes("outsideNewJerseyBoundary"),
  "Pipeline must retain duplicate, NPPES, digest and official-boundary gates."
);
assert(
  reviewer.includes("Review annotations never add coordinates") &&
    reviewer.includes("evidence-url") &&
    stagingReadme.includes("never promote a record"),
  "The ignored review workflow must require official evidence and remain unable to publish coordinates."
);
assert.equal(artifact.publicationStatus, "validated_pilot");
assert(artifact.coverage.officeCount > 0);
assert(artifact.coverage.providerCount > 0);
assert.equal(artifact.coverage.isComplete, false);
assert.equal(artifact.refreshPolicy.cadence, "monthly");
assert.equal(artifact.refreshPolicy.nextReviewDate, artifact.sources[0].nextUpdateDate);
assert(artifact.specialties.every(({ officeCount }) => officeCount > 0));
assert(artifactBytes < 5 * 1024 * 1024, "Doctor-office runtime artifact exceeds 5 MB raw.");
assert(artifactGzipBytes < 750 * 1024, "Doctor-office runtime artifact exceeds 750 KB gzip.");

console.log(
  `Doctor-office pipeline check passed: pinned CMS/NPPES/Census workflow supports ${artifact.coverage.officeCount.toLocaleString()} validated office groups without changing incomplete-coverage status (${artifactBytes.toLocaleString()} raw bytes; ${artifactGzipBytes.toLocaleString()} gzip).`
);
