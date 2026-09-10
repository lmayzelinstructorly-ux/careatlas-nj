const doctorOfficeSpecialties = [
  {
    id: "pediatrics",
    label: "Pediatrics",
    sourceSpecialties: ["PEDIATRIC MEDICINE"]
  },
  {
    id: "dermatology",
    label: "Dermatology",
    sourceSpecialties: ["DERMATOLOGY"]
  },
  {
    id: "oncology",
    label: "Oncology",
    sourceSpecialties: [
      "MEDICAL ONCOLOGY",
      "HEMATOLOGY/ONCOLOGY",
      "SURGICAL ONCOLOGY",
      "RADIATION ONCOLOGY",
      "GYNECOLOGICAL ONCOLOGY"
    ]
  }
];

const doctorOfficeSourceConfig = {
  checkedDate: "2026-08-30",
  cms: {
    apiUrl:
      "https://data.cms.gov/provider-data/api/1/datastore/query/mj5m-pzi6/0",
    dataDate: "2026-07-31",
    datasetId: "mj5m-pzi6",
    datasetUrl: "https://data.cms.gov/provider-data/dataset/mj5m-pzi6",
    metadataUrl:
      "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/mj5m-pzi6",
    nextUpdateDate: "2026-09-10",
    releaseDate: "2026-08-13"
  },
  censusGeocoder: {
    benchmark: "Public_AR_Current",
    checkedDate: "2026-08-30",
    serviceUrl:
      "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
    sourceUrl:
      "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html"
  },
  nppes: {
    deactivationZipUrl:
      "https://download.cms.gov/nppes/NPPES_Deactivated_NPI_Report_081026_V2.zip",
    downloadPageUrl: "https://download.cms.gov/nppes/NPI_Files.html",
    reportTitleIncludes: "Aug 10 2026",
    releaseDate: "2026-08-10"
  },
  refreshPolicy: {
    cadence: "monthly",
    nextReviewDate: "2026-09-10",
    staleAfterDays: 45
  },
  state: "NJ",
  stateFips: "34"
};

export { doctorOfficeSourceConfig, doctorOfficeSpecialties };
