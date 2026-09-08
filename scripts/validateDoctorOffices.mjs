import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const artifactPath = path.join(root, "public/data/doctor-offices/nj.json");
const countyPath = path.join(root, "public/data/counties/by-state/34.geojson");
const [artifactSource, countySource] = await Promise.all([
  readFile(artifactPath, "utf8"),
  readFile(countyPath, "utf8")
]);
const artifact = JSON.parse(artifactSource);
const counties = JSON.parse(countySource).features;
const expectedSpecialties = new Map([
  ["pediatrics", ["PEDIATRIC MEDICINE"]],
  ["dermatology", ["DERMATOLOGY"]],
  ["oncology", [
    "MEDICAL ONCOLOGY",
    "HEMATOLOGY/ONCOLOGY",
    "SURGICAL ONCOLOGY",
    "RADIATION ONCOLOGY",
    "GYNECOLOGICAL ONCOLOGY"
  ]]
]);
const forbiddenKeys = /(?:rating|ranking|quality|capacity|availability|appointment|insurance|accepting.?patients?|medical.?advice)/iu;

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(String(value ?? ""));
}

function isPointInRing(latitude, longitude, ring) {
  let isInside = false;
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
    if (crossesLatitude && longitude < crossingLongitude) {
      isInside = !isInside;
    }
  }
  return isInside;
}

function isPointInPolygon(latitude, longitude, polygon) {
  return Boolean(
    polygon[0] &&
      isPointInRing(latitude, longitude, polygon[0]) &&
      polygon.slice(1).every((hole) =>
        !isPointInRing(latitude, longitude, hole)
      )
  );
}

function isPointInFeature(latitude, longitude, feature) {
  if (feature.geometry.type === "Polygon") {
    return isPointInPolygon(latitude, longitude, feature.geometry.coordinates);
  }
  return feature.geometry.type === "MultiPolygon" &&
    feature.geometry.coordinates.some((polygon) =>
      isPointInPolygon(latitude, longitude, polygon)
    );
}

function assertNoForbiddenFields(value, pointer = "artifact") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoForbiddenFields(item, `${pointer}[${index}]`)
    );
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assert(!forbiddenKeys.test(key), `${pointer}.${key} is a forbidden claim field.`);
    assertNoForbiddenFields(child, `${pointer}.${key}`);
  }
}

assert.equal(artifact.schemaVersion, "1.0.0");
assert.equal(artifact.specialtyNormalizationVersion, "1.0.0");
assert.equal(artifact.state, "NJ");
assert.equal(artifact.stateFips, "34");
assert(
  ["foundation_empty", "validated_pilot"].includes(artifact.publicationStatus),
  "Doctor-office publication status is invalid."
);
assert(isIsoDate(artifact.generatedAt), "generatedAt must be an ISO date.");
assert.equal(artifact.refreshPolicy?.cadence, "monthly");
assert.equal(artifact.refreshPolicy?.staleAfterDays, 45);
assert(
  isIsoDate(artifact.refreshPolicy?.nextReviewDate),
  "Doctor-office next review date must be an ISO date."
);
assert.equal(artifact.coverage.isComplete, false, "Coverage must remain explicitly incomplete.");
assert(Array.isArray(artifact.offices), "offices must be an array.");
assert(Array.isArray(artifact.specialties), "specialties must be an array.");
assert(Array.isArray(artifact.sources) && artifact.sources.length === 3);
assert(Array.isArray(artifact.limitations) && artifact.limitations.length >= 3);

const specialtyIds = new Set();
for (const specialty of artifact.specialties) {
  assert(expectedSpecialties.has(specialty.id), `Unknown specialty ${specialty.id}.`);
  assert(!specialtyIds.has(specialty.id), `Duplicate specialty ${specialty.id}.`);
  specialtyIds.add(specialty.id);
  assert.deepEqual(
    specialty.sourceSpecialties,
    expectedSpecialties.get(specialty.id),
    `${specialty.id} CMS specialty mapping drifted.`
  );
  assert(Number.isInteger(specialty.officeCount) && specialty.officeCount >= 0);
  assert(Number.isInteger(specialty.providerCount) && specialty.providerCount >= 0);
}
assert.equal(specialtyIds.size, expectedSpecialties.size);

const cmsSource = artifact.sources.find(({ datasetId }) => datasetId === "mj5m-pzi6");
const nppesSource = artifact.sources.find(({ name }) => name.includes("NPPES"));
const geocoderSource = artifact.sources.find(({ name }) => name.includes("Geocoding"));
assert(
  cmsSource &&
    isIsoDate(cmsSource.releaseDate) &&
    isIsoDate(cmsSource.checkedDate) &&
    isIsoDate(cmsSource.nextUpdateDate)
);
assert.equal(cmsSource.nextUpdateDate, artifact.refreshPolicy.nextReviewDate);
assert(nppesSource && isIsoDate(nppesSource.releaseDate) && isIsoDate(nppesSource.checkedDate));
assert(geocoderSource && isIsoDate(geocoderSource.checkedDate));

if (artifact.publicationStatus === "foundation_empty") {
  assert.equal(artifact.offices.length, 0, "Foundation status cannot publish office records.");
}
if (artifact.offices.length > 0) {
  assert.equal(
    artifact.publicationStatus,
    "validated_pilot",
    "Published offices require validated_pilot status."
  );
  assert(Number.isInteger(artifact.coverage.cmsQueryRowCount));
  assert(Number.isInteger(artifact.coverage.eligibleSourceRowCount));
  assert(Number.isInteger(artifact.coverage.candidateOfficeCount));
  assert(artifact.coverage.nppesDeactivationRecordCount > 300000);
  assert.match(artifact.coverage.sourceRowDigestSha256, /^[a-f0-9]{64}$/u);
  assert.match(artifact.coverage.nppesSourceDigestSha256, /^[a-f0-9]{64}$/u);
  assert.match(artifact.coverage.geocoderResultDigestSha256, /^[a-f0-9]{64}$/u);
  const exclusions = artifact.coverage.exclusions;
  for (const key of [
    "deactivatedNpi",
    "duplicateQueryResult",
    "missingRequiredFields",
    "noMappedSpecialty",
    "outsideRequestedState",
    "outsideNewJerseyBoundary",
    "unmatchedGeocode"
  ]) {
    assert(Number.isInteger(exclusions?.[key]) && exclusions[key] >= 0);
  }
  assert.equal(
    artifact.coverage.cmsQueryRowCount,
    artifact.coverage.eligibleSourceRowCount +
      exclusions.deactivatedNpi +
      exclusions.duplicateQueryResult +
      exclusions.missingRequiredFields +
      exclusions.noMappedSpecialty +
      exclusions.outsideRequestedState,
    "CMS query rows do not reconcile to eligible rows and row-level exclusions."
  );
  assert.equal(
    artifact.coverage.candidateOfficeCount,
    artifact.coverage.officeCount +
      exclusions.outsideNewJerseyBoundary +
      exclusions.unmatchedGeocode,
    "Candidate offices do not reconcile to published and geocode/boundary exclusions."
  );
  assert(nppesSource.downloadUrl?.endsWith("NPPES_Deactivated_NPI_Report_081026_V2.zip"));
  assert(geocoderSource.serviceUrl?.includes("/locations/addressbatch"));
}

const officeIds = new Set();
const officeGroupKeys = new Set();
const allProviderNpis = new Set();
for (const office of artifact.offices) {
  assert(!officeIds.has(office.id), `Duplicate office id ${office.id}.`);
  officeIds.add(office.id);
  assert.equal(office.state, "NJ");
  assert(/^\d{3}$/u.test(office.countyFips), `${office.id} county FIPS is invalid.`);
  assert(office.addressLine1 && office.city && office.postalCode);
  assert(["suite", "building"].includes(office.addressPrecision));
  assert(Number.isFinite(office.latitude) && Number.isFinite(office.longitude));
  assert(Array.isArray(office.specialtyIds) && office.specialtyIds.length > 0);
  assert(office.specialtyIds.every((id) => specialtyIds.has(id)));
  assert(Array.isArray(office.providers) && office.providers.length > 0);
  assert(Array.isArray(office.practiceNames));
  assert(office.provenance.cmsDatasetId === "mj5m-pzi6");
  assert(office.provenance.cmsAddressId);
  assert(isIsoDate(office.provenance.cmsReleaseDate));
  assert(isIsoDate(office.provenance.nppesCheckedDate));
  assert(isIsoDate(office.provenance.censusGeocoderCheckedDate));
  assert(office.provenance.censusGeocoderBenchmark);
  assert(office.provenance.censusGeocoderMatchType);
  assert(office.provenance.censusGeocoderMatchedAddress);
  assert(
    Array.isArray(office.provenance.sourceRowIds) &&
      office.provenance.sourceRowIds.length > 0
  );
  assert.equal(
    new Set(office.provenance.sourceRowIds).size,
    office.provenance.sourceRowIds.length,
    `${office.id} repeats a source-row identity.`
  );

  const normalizedAddress = [
    office.addressLine1,
    office.addressLine2,
    office.city,
    office.state,
    office.postalCode
  ].filter(Boolean).join("|").toUpperCase().replace(/\s+/gu, " ");
  const groupKey = `${office.provenance.cmsAddressId}|${normalizedAddress}`;
  assert(!officeGroupKeys.has(groupKey), `${office.id} duplicates an office group key.`);
  officeGroupKeys.add(groupKey);

  const matchingCounties = counties.filter((county) =>
    isPointInFeature(office.latitude, office.longitude, county)
  );
  assert.equal(
    matchingCounties.length,
    1,
    `${office.id} must fall inside exactly one official New Jersey county.`
  );
  assert.equal(String(matchingCounties[0].properties.COUNTYFP), office.countyFips);

  const providerNpis = new Set();
  for (const provider of office.providers) {
    assert(/^\d{10}$/u.test(provider.npi), `${office.id} has an invalid NPI.`);
    assert(!providerNpis.has(provider.npi), `${office.id} repeats NPI ${provider.npi}.`);
    providerNpis.add(provider.npi);
    allProviderNpis.add(provider.npi);
    assert.equal(provider.nppesStatus, "not_deactivated_in_snapshot");
    assert(Array.isArray(provider.credentials));
    assert(provider.displayName);
    assert(Array.isArray(provider.enrollmentIds) && provider.enrollmentIds.length > 0);
    assert(
      provider.normalizedSpecialtyIds.some((id) => office.specialtyIds.includes(id)),
      `${office.id} provider ${provider.npi} does not support an office specialty.`
    );
  }
}

assert.equal(artifact.coverage.officeCount, artifact.offices.length);
assert.equal(artifact.coverage.providerCount, allProviderNpis.size);
for (const specialty of artifact.specialties) {
  const matchingOffices = artifact.offices.filter((office) =>
    office.specialtyIds.includes(specialty.id)
  );
  const matchingNpis = new Set(
    matchingOffices.flatMap((office) =>
      office.providers
        .filter((provider) => provider.normalizedSpecialtyIds.includes(specialty.id))
        .map((provider) => provider.npi)
    )
  );
  assert.equal(specialty.officeCount, matchingOffices.length);
  assert.equal(specialty.providerCount, matchingNpis.size);
}

assertNoForbiddenFields(artifact);
console.log(
  `Doctor-office validation passed: ${artifact.offices.length} published offices, ${allProviderNpis.size} unique providers, explicit incomplete coverage.`
);
