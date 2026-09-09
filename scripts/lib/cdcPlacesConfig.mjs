const CDC_PLACES_DATASET_ID = "cwsq-ngmh";
const CDC_PLACES_RELEASE_YEAR = 2025;
const CDC_PLACES_DATA_YEAR = 2023;
const CDC_PLACES_CHECKED_DATE = "2026-07-14";
const CDC_PLACES_DATASET_NAME =
  "PLACES: Local Data for Better Health, Census Tract Data, 2025 release";
const CDC_PLACES_SOURCE_URL = `https://data.cdc.gov/d/${CDC_PLACES_DATASET_ID}`;
const CDC_PLACES_API_ROOT = `https://data.cdc.gov/resource/${CDC_PLACES_DATASET_ID}.json`;

const selectedCdcPlacesMeasures = [
  {
    sourceMeasureId: "CHD",
    id: "cdc_places_coronary_heart_disease_crude_prevalence",
    label: "Coronary heart disease among adults",
    category: "Health Outcomes",
    evidenceLayer: "community_health_need",
    dataValueTypeId: "CrdPrv",
    dataValueType: "Crude prevalence",
    unit: "percent",
    sourceUnit: "%",
    dataYear: CDC_PLACES_DATA_YEAR,
    rationale:
      "Represents a chronic cardiovascular condition that can require sustained outpatient management."
  },
  {
    sourceMeasureId: "DIABETES",
    id: "cdc_places_diagnosed_diabetes_crude_prevalence",
    label: "Diagnosed diabetes among adults",
    category: "Health Outcomes",
    evidenceLayer: "community_health_need",
    dataValueTypeId: "CrdPrv",
    dataValueType: "Crude prevalence",
    unit: "percent",
    sourceUnit: "%",
    dataYear: CDC_PLACES_DATA_YEAR,
    rationale:
      "Represents a chronic metabolic condition that can require regular monitoring and continuing care."
  },
  {
    sourceMeasureId: "CHECKUP",
    id: "cdc_places_annual_checkup_crude_prevalence",
    label: "Routine checkup within the past year among adults",
    category: "Prevention",
    evidenceLayer: "community_health_need",
    dataValueTypeId: "CrdPrv",
    dataValueType: "Crude prevalence",
    unit: "percent",
    sourceUnit: "%",
    dataYear: CDC_PLACES_DATA_YEAR,
    rationale:
      "Provides a preventive-care use estimate without claiming why an adult did or did not receive a checkup."
  },
  {
    sourceMeasureId: "LACKTRPT",
    id: "cdc_places_lack_reliable_transportation_crude_prevalence",
    label: "Lack of reliable transportation in the past 12 months among adults",
    category: "Health-Related Social Needs",
    evidenceLayer: "social_barriers",
    dataValueTypeId: "CrdPrv",
    dataValueType: "Crude prevalence",
    unit: "percent",
    sourceUnit: "%",
    dataYear: CDC_PLACES_DATA_YEAR,
    rationale:
      "Adds a direct modeled transportation-barrier estimate without claiming why an individual could or could not reach care."
  },
  {
    sourceMeasureId: "CHOLSCREEN",
    id: "cdc_places_cholesterol_screening_crude_prevalence",
    label: "Cholesterol screening among adults",
    category: "Prevention",
    evidenceLayer: "community_health_need",
    dataValueTypeId: "CrdPrv",
    dataValueType: "Crude prevalence",
    unit: "percent",
    sourceUnit: "%",
    dataYear: CDC_PLACES_DATA_YEAR,
    rationale:
      "Provides a preventive screening estimate related to cardiovascular risk detection."
  }
];

const sourceFields = [
  "year",
  "stateabbr",
  "countyname",
  "countyfips",
  "locationid",
  "datasource",
  "category",
  "measure",
  "data_value_unit",
  "data_value_type",
  "data_value",
  "data_value_footnote_symbol",
  "data_value_footnote",
  "low_confidence_limit",
  "high_confidence_limit",
  "measureid",
  "datavaluetypeid",
  "short_question_text"
];

function buildCdcPlacesApiUrl() {
  const measureIds = selectedCdcPlacesMeasures
    .map(({ sourceMeasureId }) => `"${sourceMeasureId}"`)
    .join(",");
  const params = new URLSearchParams({
    "$select": sourceFields.join(","),
    "$where":
      `stateabbr="NJ" and datavaluetypeid="CrdPrv" and measureid in(${measureIds})`,
    "$order": "locationid,measureid",
    "$limit": "50000"
  });

  return `${CDC_PLACES_API_ROOT}?${params}`;
}

export {
  CDC_PLACES_API_ROOT,
  CDC_PLACES_CHECKED_DATE,
  CDC_PLACES_DATASET_ID,
  CDC_PLACES_DATASET_NAME,
  CDC_PLACES_DATA_YEAR,
  CDC_PLACES_RELEASE_YEAR,
  CDC_PLACES_SOURCE_URL,
  buildCdcPlacesApiUrl,
  selectedCdcPlacesMeasures
};
