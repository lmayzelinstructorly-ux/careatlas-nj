import { parseCsvRows } from "./lib/csvRows.mjs";
import { buildCdcSviArtifacts } from "./importCdcSviTractEvidence.mjs";
import { buildCensusAcsArtifacts } from "./importCensusAcsTractEvidence.mjs";
import { buildHrsaShortageArtifacts } from "./importHrsaShortageTractEvidence.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const geographies = ["34001000100", "34001000200"].map((geoid) => ({
  type: "census_tract",
  geoid,
  stateFips: "34",
  countyFips: "001",
  tractCode: geoid.slice(5)
}));
const tractArtifact = { records: geographies.map((geography) => ({ geography })) };

const csvFixture = 'id,name,notes\r\n1,"quoted, name","line one\nline two"\r\n';
const parsedCsv = parseCsvRows(csvFixture);
assert(parsedCsv[0].name === "quoted, name" && parsedCsv[0].notes.includes("line two"),
  "CSV parser must preserve quoted commas and newlines.");
const trailingHeaderCsv = parseCsvRows("id,name,\n1,fixture\n2,fixture,\n");
assert(trailingHeaderCsv.length === 2 && !("" in trailingHeaderCsv[0]),
  "CSV parser must normalize an unnamed trailing source column.");

const sviRow = {
  ST: "34", ST_ABBR: "NJ", FIPS: geographies[0].geoid,
  RPL_THEMES: "0.8", RPL_THEME1: "0.7", RPL_THEME2: "0.6", RPL_THEME3: "0.5", RPL_THEME4: "0.4"
};
const svi = buildCdcSviArtifacts([sviRow], tractArtifact);
assert(svi.observations.length === 10, "SVI fixture must create five observations per tract.");
assert(svi.coverageSummary.source.csvUrl.endsWith('/states/NewJersey.csv'),
  "The SVI reference population must match the pinned New Jersey state file.");
assert(svi.coverageSummary.limitations.some(text => text.includes('2022 New Jersey release')),
  "State-file ranks must not be described as national percentiles.");
assert(svi.observations.filter(({ value }) => value === null).length === 5,
  "SVI fixture must preserve explicit missing observations.");

const acs = buildCensusAcsArtifacts({
  B27010: [{ GEO_ID: `1400000US${geographies[0].geoid}`, B27010_E001: "100", B27010_E017: "2", B27010_E033: "3", B27010_E050: "4", B27010_E066: "1" }],
  B17001: [{ GEO_ID: `1400000US${geographies[0].geoid}`, B17001_E001: "100", B17001_E002: "11" }],
  C18108: [{ GEO_ID: `1400000US${geographies[0].geoid}`, C18108_E001: "100", C18108_E003: "1", C18108_E004: "2", C18108_E007: "2", C18108_E008: "1", C18108_E011: "2", C18108_E012: "2" }],
  B08201: [{ GEO_ID: `1400000US${geographies[0].geoid}`, B08201_E001: "100", B08201_E002: "20" }]
}, tractArtifact);
assert(acs.observations.length === 8, "ACS fixture must create four observations per tract.");
assert(acs.observations.find(({ measure }) => measure.id === "acs_households_without_vehicle_percent").value === 20,
  "ACS fixture must derive the no-vehicle percentage.");

const square = (minX, maxX) => ({ type: "Polygon", coordinates: [[[minX, 0], [maxX, 0], [maxX, 2], [minX, 2], [minX, 0]]] });
const tractFeatures = geographies.map((geography, index) => ({
  type: "Feature",
  properties: { GEOID: geography.geoid, COUNTYFP: "001", INTPTLON: String(index + 0.5), INTPTLAT: "1" },
  geometry: square(index, index + 1)
}));
const cousubFeatures = [0, 1].map((index) => ({
  type: "Feature",
  properties: { GEOID: `340010000${index + 1}`, COUNTYFP: "001" },
  geometry: square(index, index + 1)
}));
const hpsaRow = (discipline, id, type, geoid) => ({
  "HPSA Component State Abbreviation": "NJ", "HPSA Status": "Designated",
  "HPSA Discipline Class": discipline, "HPSA ID": id, "HPSA Name": `${discipline} fixture`,
  "Designation Type": "Geographic HPSA", "HPSA Designation Date": "01/01/2024",
  "HPSA Designation Last Update Date": "01/02/2024", "HPSA Score": "10", "Rural Status": "Non-Rural",
  "HPSA Designation Population Type Description": "Geographic Population", "HPSA Component Type Code": type,
  "HPSA Geography Identification Number": geoid, "HPSA Component Name": "fixture component"
});
const muapRow = {
  "State Abbreviation": "NJ", "MUA/P Status Description": "Designated", "MUA/P ID": "4001",
  "MUA/P Service Area Name": "fixture MUA", "Designation Type": "Medically Underserved Area",
  "Designation Date": "01/01/2024", "MUA/P Update Date": "01/02/2024", "IMU Score": "55",
  "Rural Status Description": "Non-Rural", "Population Type": "Medically Underserved Area",
  "Medically Underserved Area/Population (MUA/P) Component Geographic Type Code": "CT",
  "MUA/P Area Code": geographies[1].geoid,
  "Medically Underserved Area/Population (MUA/P) Component Geographic Name": "fixture tract"
};
const hrsa = buildHrsaShortageArtifacts({
  primary_care: [hpsaRow("Primary Care", "1001", "CT", geographies[0].geoid)],
  dental_health: [hpsaRow("Dental Health", "2001", "SCTY", "34001")],
  mental_health: [hpsaRow("Mental Health", "3001", "CSD", "3400100001")],
  muap: [muapRow]
}, tractArtifact, tractFeatures, cousubFeatures);
assert(hrsa.observations.length === 8, "HRSA fixture must create four designation observations per tract.");
assert(hrsa.observations.filter(({ value }) => value === 1).length === 5,
  "HRSA fixture must exercise tract, county and county-subdivision assignments.");
assert(hrsa.coverageSummary.sourceCoverage.mental_health.componentMethodCounts.county_subdivision_internal_point === 1,
  "HRSA fixture must report its county-subdivision crosswalk method.");
assert(hrsa.coverageSummary.countySubdivisionCrosswalk.unmatchedTractCount === 0,
  "HRSA fixture must report complete synthetic subdivision coverage.");
assert(Object.values(hrsa.coverageSummary.sourceCoverage).every(({ unmatchedActiveComponentCount }) => unmatchedActiveComponentCount === 0),
  "HRSA fixture must assign every synthetic source component.");

console.log("Batch 6 importer fixtures passed for CSV, SVI, ACS and HRSA source contracts.");
