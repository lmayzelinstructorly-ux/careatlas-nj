import fs from "node:fs/promises";
import path from "node:path";
import { buildArtifacts } from "./importCdcPlacesTractEvidence.mjs";
import { selectedCdcPlacesMeasures } from "./lib/cdcPlacesConfig.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const fixturePath = path.join(
  projectRoot,
  "public",
  "data",
  "tracts",
  "test-fixtures",
  "cdc-places-source.fixture.json"
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sourceRows = JSON.parse(await fs.readFile(fixturePath, "utf8"));
const tractArtifact = {
  records: [
    {
      geography: {
        type: "census_tract",
        geoid: "34001000100",
        stateFips: "34",
        countyFips: "001",
        tractCode: "000100"
      }
    },
    {
      geography: {
        type: "census_tract",
        geoid: "34001000200",
        stateFips: "34",
        countyFips: "001",
        tractCode: "000200"
      }
    }
  ]
};

const { observations, coverageSummary } = buildArtifacts(sourceRows, tractArtifact);
assert(
  observations.length === tractArtifact.records.length * selectedCdcPlacesMeasures.length,
  "Fixture must create one observation for every tract/measure pair."
);
assert(
  observations.filter(({ value }) => value !== null).length === selectedCdcPlacesMeasures.length,
  "Fixture must preserve every loaded selected estimate."
);
assert(
  observations.filter(({ value }) => value === null).length === selectedCdcPlacesMeasures.length,
  "Fixture must create one explicit missing observation per selected measure for the uncovered tract."
);
assert(
  coverageSummary.tractsOutsideSourceCoverage === 1 &&
    coverageSummary.tractsWithPartialSourceCoverage === 0,
  "Fixture coverage must distinguish one fully uncovered tract."
);
assert(
  observations.every(({ value, missingness }) => missingness.isMissing === (value === null)),
  "Fixture missingness must agree with null values."
);

console.log("CDC PLACES importer fixture check passed for loaded and outside-coverage observations.");
