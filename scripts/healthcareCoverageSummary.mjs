import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");

export const facilitiesPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
export const coverageSummaryPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "coverage-summary.json"
);

const stateNames = {
  AL: "Alabama",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "Washington, D.C.",
  FL: "Florida",
  GA: "Georgia",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming"
};

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidCoordinates(facility) {
  return (
    Number.isFinite(facility.latitude) &&
    facility.latitude >= -90 &&
    facility.latitude <= 90 &&
    Number.isFinite(facility.longitude) &&
    facility.longitude >= -180 &&
    facility.longitude <= 180
  );
}

export function isSourceBackedProductionFacility(facility) {
  return (
    facility?.isDemoData !== true &&
    facility?.verificationStatus !== "demo" &&
    hasText(facility?.state) &&
    hasText(facility?.sourceInfo?.sourceName) &&
    hasText(facility?.sourceInfo?.sourceUrl) &&
    hasText(facility?.sourceInfo?.lastChecked)
  );
}

function uniqueSorted(values) {
  return [...new Set(values.filter(hasText).map((value) => value.trim()))].sort(
    (first, second) => first.localeCompare(second)
  );
}

function getLatestDate(values) {
  return uniqueSorted(values).at(-1) ?? null;
}

function getEarliestDate(values) {
  return uniqueSorted(values)[0] ?? null;
}

function buildCountList(values, keyName) {
  const counts = new Map();

  for (const value of values) {
    if (hasText(value)) {
      const normalizedValue = value.trim();
      counts.set(normalizedValue, (counts.get(normalizedValue) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([value, facilityCount]) => ({
      [keyName]: value,
      facilityCount
    }));
}

export async function readJson(inputPath) {
  return JSON.parse(await readFile(inputPath, "utf8"));
}

export function relativePath(inputPath) {
  return path.relative(projectRoot, inputPath);
}

export function buildHealthcareCoverageSummary(facilities) {
  if (!Array.isArray(facilities)) {
    throw new Error(`${relativePath(facilitiesPath)} must contain a JSON array.`);
  }

  const unsupportedFacilities = facilities.filter(
    (facility) => !isSourceBackedProductionFacility(facility)
  );

  if (unsupportedFacilities.length > 0) {
    throw new Error(
      `Coverage cannot be generated: ${unsupportedFacilities.length} production record(s) are not source-backed.`
    );
  }

  const stateCodes = uniqueSorted(facilities.map((facility) => facility.state));
  const loadedStates = stateCodes.map((postalCode) => {
    const stateFacilities = facilities.filter(
      (facility) => facility.state.trim() === postalCode
    );
    const facilitiesWithValidCoordinates = stateFacilities.filter(
      hasValidCoordinates
    ).length;

    return {
      postalCode,
      name: stateNames[postalCode] ?? postalCode,
      stateFips: uniqueSorted(
        stateFacilities.map((facility) => facility.stateFips)
      )[0] ?? null,
      facilityCount: stateFacilities.length,
      facilitiesWithValidCoordinates,
      facilitiesMissingCoordinates:
        stateFacilities.length - facilitiesWithValidCoordinates,
      sourceNames: uniqueSorted(
        stateFacilities.map((facility) => facility.sourceInfo.sourceName)
      ),
      sourceDatasets: uniqueSorted(
        stateFacilities.map((facility) => facility.sourceDataset)
      ),
      facilityTypes: uniqueSorted(
        stateFacilities.map((facility) => facility.facilityType)
      ),
      latestLastVerifiedDate: getLatestDate(
        stateFacilities.map((facility) => facility.lastVerified)
      ),
      latestSourceUpdatedDate: getLatestDate(
        stateFacilities.map((facility) => facility.sourceLastUpdated)
      )
    };
  });

  const sourceNames = uniqueSorted(
    facilities.map((facility) => facility.sourceInfo.sourceName)
  );
  const sources = sourceNames.map((name) => {
    const sourceFacilities = facilities.filter(
      (facility) => facility.sourceInfo.sourceName.trim() === name
    );

    return {
      name,
      facilityCount: sourceFacilities.length,
      datasets: uniqueSorted(
        sourceFacilities.map((facility) => facility.sourceDataset)
      ),
      loadedStates: uniqueSorted(
        sourceFacilities.map((facility) => facility.state)
      )
    };
  });
  const facilitiesWithValidCoordinates = facilities.filter(
    hasValidCoordinates
  ).length;

  return {
    schemaVersion: 1,
    generatedFrom: "public/data/healthcare/facilities.json",
    coverageStatus: "limited_production_coverage",
    totalFacilities: facilities.length,
    loadedStates,
    sources,
    facilityTypes: buildCountList(
      facilities.map((facility) => facility.facilityType),
      "facilityType"
    ),
    coordinateCoverage: {
      facilitiesWithValidCoordinates,
      facilitiesMissingCoordinates:
        facilities.length - facilitiesWithValidCoordinates
    },
    dateCoverage: {
      earliestLastVerifiedDate: getEarliestDate(
        facilities.map((facility) => facility.lastVerified)
      ),
      latestLastVerifiedDate: getLatestDate(
        facilities.map((facility) => facility.lastVerified)
      ),
      earliestSourceUpdatedDate: getEarliestDate(
        facilities.map((facility) => facility.sourceLastUpdated)
      ),
      latestSourceUpdatedDate: getLatestDate(
        facilities.map((facility) => facility.sourceLastUpdated)
      )
    },
    caveats: [
      "Production coverage is limited to the loaded states and sources listed here.",
      "Coverage not loaded for a state or boundary does not mean no healthcare exists there.",
      "Facility records document source-backed capacity evidence. They do not measure medical quality or provide medical advice."
    ]
  };
}

export async function buildHealthcareCoverageSummaryFromProduction() {
  return buildHealthcareCoverageSummary(await readJson(facilitiesPath));
}
