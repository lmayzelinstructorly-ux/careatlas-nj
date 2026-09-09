const CDC_SVI_RELEASE_YEAR = 2022;
const CDC_SVI_DATASET_NAME = "CDC/ATSDR Social Vulnerability Index 2022 database, New Jersey";
const CDC_SVI_SOURCE_URL = "https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html";
const CDC_SVI_CSV_URL = "https://svi.cdc.gov/Documents/Data/2022/csv/states/NewJersey.csv";

const cdcSviMeasures = [
  ["RPL_THEMES", "cdc_svi_overall_percentile_rank", "Overall social vulnerability percentile rank"],
  ["RPL_THEME1", "cdc_svi_socioeconomic_status_percentile_rank", "Socioeconomic status percentile rank"],
  ["RPL_THEME2", "cdc_svi_household_characteristics_percentile_rank", "Household characteristics percentile rank"],
  ["RPL_THEME3", "cdc_svi_racial_ethnic_minority_status_percentile_rank", "Racial and ethnic minority status percentile rank"],
  ["RPL_THEME4", "cdc_svi_housing_transportation_percentile_rank", "Housing type and transportation percentile rank"]
].map(([sourceField, id, label]) => ({
  sourceField,
  id,
  label,
  evidenceLayer: "social_barriers",
  unit: "percentile_rank_0_to_1"
}));

const CENSUS_ACS_RELEASE_YEAR = 2024;
const CENSUS_ACS_DATASET_NAME = "2024 American Community Survey 5-year estimates";
const CENSUS_ACS_SOURCE_URL = "https://www.census.gov/programs-surveys/acs/data/summary-file.html";
const CENSUS_ACS_TABLE_ROOT = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData";

const censusAcsMeasures = [
  {
    id: "acs_uninsured_population_percent",
    label: "Civilian noninstitutionalized population without health insurance",
    evidenceLayer: "social_barriers",
    unit: "percent",
    tableId: "B27010",
    numeratorVariables: ["B27010_E017", "B27010_E033", "B27010_E050", "B27010_E066"],
    denominatorVariable: "B27010_E001"
  },
  {
    id: "acs_population_below_poverty_percent",
    label: "Population below the poverty level",
    evidenceLayer: "social_barriers",
    unit: "percent",
    tableId: "B17001",
    numeratorVariables: ["B17001_E002"],
    denominatorVariable: "B17001_E001"
  },
  {
    id: "acs_population_with_disability_percent",
    label: "Civilian noninstitutionalized population with a disability",
    evidenceLayer: "social_barriers",
    unit: "percent",
    tableId: "C18108",
    numeratorVariables: [
      "C18108_E003", "C18108_E004", "C18108_E007",
      "C18108_E008", "C18108_E011", "C18108_E012"
    ],
    denominatorVariable: "C18108_E001"
  },
  {
    id: "acs_households_without_vehicle_percent",
    label: "Households with no vehicle available",
    evidenceLayer: "social_barriers",
    unit: "percent",
    tableId: "B08201",
    numeratorVariables: ["B08201_E002"],
    denominatorVariable: "B08201_E001"
  }
];

function buildCensusAcsTableUrls() {
  return Object.fromEntries(
    [...new Set(censusAcsMeasures.map(({ tableId }) => tableId))].sort().map((tableId) => [
      tableId,
      `${CENSUS_ACS_TABLE_ROOT}/acsdt5y2024-${tableId.toLowerCase()}.dat`
    ])
  );
}

const HRSA_SOURCE_URL = "https://data.hrsa.gov/data/download";
const HRSA_DATASET_NAME = "HRSA Shortage Areas daily data download";
const hrsaSources = [
  {
    key: "primary_care",
    fileUrl: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_PC.csv",
    id: "hrsa_active_primary_care_hpsa_component_count",
    label: "Active primary care HPSA designations intersecting tract",
    discipline: "Primary Care"
  },
  {
    key: "dental_health",
    fileUrl: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_DH.csv",
    id: "hrsa_active_dental_health_hpsa_component_count",
    label: "Active dental health HPSA designations intersecting tract",
    discipline: "Dental Health"
  },
  {
    key: "mental_health",
    fileUrl: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_MH.csv",
    id: "hrsa_active_mental_health_hpsa_component_count",
    label: "Active mental health HPSA designations intersecting tract",
    discipline: "Mental Health"
  },
  {
    key: "muap",
    fileUrl: "https://data.hrsa.gov/DataDownload/DD_Files/MUA_DET.csv",
    id: "hrsa_active_muap_component_count",
    label: "Active MUA/P designations intersecting tract"
  }
].map((source) => ({
  ...source,
  evidenceLayer: "official_shortage",
  unit: "active_designations"
}));

export {
  CDC_SVI_CSV_URL,
  CDC_SVI_DATASET_NAME,
  CDC_SVI_RELEASE_YEAR,
  CDC_SVI_SOURCE_URL,
  CENSUS_ACS_DATASET_NAME,
  CENSUS_ACS_RELEASE_YEAR,
  CENSUS_ACS_SOURCE_URL,
  HRSA_DATASET_NAME,
  HRSA_SOURCE_URL,
  buildCensusAcsTableUrls,
  cdcSviMeasures,
  censusAcsMeasures,
  hrsaSources
};
