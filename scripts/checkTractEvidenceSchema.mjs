import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const fixturePath = path.join(
  projectRoot,
  "public",
  "data",
  "tracts",
  "test-fixtures",
  "tract-evidence.v1.fixture.json"
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateObservation(record) {
  assert(record.schemaVersion === "1.0.0", "Fixture schemaVersion must be 1.0.0.");
  assert(record.geography?.type === "census_tract", "Fixture geography type must be census_tract.");
  assert(/^\d{11}$/.test(record.geography.geoid), "Fixture tract GEOID must contain 11 digits.");
  assert(record.geography.geoid === `${record.geography.stateFips}${record.geography.countyFips}${record.geography.tractCode}`, "Fixture geography codes must compose the GEOID.");
  assert(typeof record.measure?.id === "string" && record.measure.id.length > 0, "Fixture measure id is required.");
  assert(Number.isInteger(record.source?.releaseYear), "Fixture source release year is required.");
  assert(typeof record.unit === "string" && record.unit.length > 0, "Fixture unit is required.");
  assert(typeof record.missingness?.isMissing === "boolean", "Fixture missingness flag is required.");
  assert(record.missingness.isMissing === (record.value === null), "Fixture missingness must agree with a null value.");
  assert(record.missingness.isMissing === (record.estimateType === "unavailable"), "Unavailable estimate type must match missingness.");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(record.provenance?.checkedDate), "Fixture provenance checked date is required.");
}

const fixtures = JSON.parse(await fs.readFile(fixturePath, "utf8"));
assert(Array.isArray(fixtures) && fixtures.length === 2, "Expected present and missing evidence fixtures.");
fixtures.forEach(validateObservation);
assert(fixtures.some((record) => record.value !== null), "Fixture must cover a present value.");
assert(fixtures.some((record) => record.value === null), "Fixture must cover an explicitly missing value.");

console.log("Tract evidence schema fixture check passed for present and explicitly missing observations.");
