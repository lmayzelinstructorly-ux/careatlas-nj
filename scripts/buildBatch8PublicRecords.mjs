import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const tractRoot = path.join(projectRoot, "public", "data", "tracts", "nj");
const geometryRoot = path.join(tractRoot, "by-county");
const classificationRoot = path.join(
  tractRoot,
  "classifications",
  "access-gap-rule-v1",
  "by-county"
);
const evidenceRoot = path.join(tractRoot, "evidence");
const outputRoot = path.join(tractRoot, "public-records");
const tractOutputRoot = path.join(outputRoot, "tracts", "by-county");
const countyOutputRoot = path.join(outputRoot, "counties");
const reportOutputRoot = path.join(outputRoot, "reports");
const facilityPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
const rulePath = path.join(tractRoot, "access-gap-rule.v1.json");
const ruleSummaryPath = path.join(tractRoot, "access-gap-rule-v1-summary.json");
const foundationPath = path.join(tractRoot, "tract-foundation.json");
const sourceSlugs = ["cdc-places", "cdc-svi", "census-acs", "hrsa-shortage"];
const generatedDate = "2026-07-14";
const earthRadiusMiles = 3958.7613;

const gapDriverDefinitions = [
  {
    id: "transportation_access",
    label: "Transportation access",
    summary: "Transportation conditions can affect whether care is practically reachable. These estimates do not establish why any person did or did not receive care.",
    relatedMeasureIds: [
      "cdc_places_lack_reliable_transportation_crude_prevalence",
      "acs_households_without_vehicle_percent",
      "cdc_svi_housing_transportation_percentile_rank"
    ]
  },
  {
    id: "coverage_and_affordability",
    label: "Coverage and affordability context",
    summary: "Insurance and economic conditions can shape access, but tract estimates do not determine an individual's eligibility, coverage or ability to pay.",
    relatedMeasureIds: [
      "acs_uninsured_population_percent",
      "acs_population_below_poverty_percent",
      "cdc_svi_socioeconomic_status_percentile_rank"
    ]
  },
  {
    id: "ongoing_care_context",
    label: "Ongoing care context",
    summary: "Modeled chronic-condition and preventive-care estimates describe community context. They are not diagnoses and do not prove a cause of access conditions.",
    relatedMeasureIds: [
      "cdc_places_diagnosed_diabetes_crude_prevalence",
      "cdc_places_coronary_heart_disease_crude_prevalence",
      "cdc_places_annual_checkup_crude_prevalence",
      "cdc_places_cholesterol_screening_crude_prevalence"
    ]
  },
  {
    id: "documented_shortage_context",
    label: "Documented shortage context",
    summary: "Active HRSA designations document reviewed workforce or underserved-area conditions. Different designation families remain separate.",
    relatedMeasureIds: [
      "hrsa_active_primary_care_hpsa_component_count",
      "hrsa_active_muap_component_count",
      "hrsa_active_dental_health_hpsa_component_count",
      "hrsa_active_mental_health_hpsa_component_count"
    ]
  }
];

const actionPathDefinitions = [
  {
    id: "find_health_center",
    title: "Verify nearby safety-net care",
    summary: "Use HRSA's official locator to confirm current health-center locations, services and contact information.",
    relatedMeasureIds: [
      "hrsa_active_primary_care_hpsa_component_count",
      "hrsa_active_muap_component_count"
    ],
    officialResource: {
      agency: "Health Resources and Services Administration",
      name: "Find a Health Center",
      url: "https://findahealthcenter.hrsa.gov/"
    },
    limitation: "A nearby location does not confirm appointment availability, services, insurance acceptance, affordability or suitability."
  },
  {
    id: "check_nj_familycare",
    title: "Review coverage information",
    summary: "NJ FamilyCare provides official information about New Jersey's publicly funded health coverage.",
    relatedMeasureIds: [
      "acs_uninsured_population_percent",
      "acs_population_below_poverty_percent"
    ],
    officialResource: {
      agency: "New Jersey Department of Human Services",
      name: "NJ FamilyCare information",
      url: "https://www.nj.gov/humanservices/dmahs/home/"
    },
    limitation: "CareAtlas does not determine eligibility, enrollment, benefits, costs or provider network participation."
  },
  {
    id: "review_transportation_support",
    title: "Review transportation support",
    summary: "Eligible NJ FamilyCare members can review the state's non-emergency medical transportation benefit.",
    relatedMeasureIds: [
      "cdc_places_lack_reliable_transportation_crude_prevalence",
      "acs_households_without_vehicle_percent"
    ],
    officialResource: {
      agency: "New Jersey Department of Human Services",
      name: "NJ FamilyCare transportation",
      url: "https://www.nj.gov/humanservices/dmahs/individuals-families/transportation/"
    },
    limitation: "This program is limited to eligible members and covered services; the tract estimates do not establish individual eligibility or transportation need."
  },
  {
    id: "review_workforce_programs",
    title: "Explore workforce-response programs",
    summary: "HRSA workforce programs describe public approaches used in communities with documented professional shortages.",
    relatedMeasureIds: [
      "hrsa_active_primary_care_hpsa_component_count",
      "hrsa_active_dental_health_hpsa_component_count",
      "hrsa_active_mental_health_hpsa_component_count"
    ],
    officialResource: {
      agency: "Health Resources and Services Administration",
      name: "National Health Service Corps",
      url: "https://nhsc.hrsa.gov/"
    },
    limitation: "This is a planning resource, not a recommendation that a particular program or new site will resolve conditions in this tract.",
    requiresActiveShortage: true
  }
];

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, "utf8");
}

async function writeJson(filePath, value) {
  await writeText(filePath, `${JSON.stringify(value)}\n`);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function greatCircleMiles(first, second) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

function formatNumber(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function isMissingText(value) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" && value.trim().toLowerCase() === "unknown")
  );
}

function getFacilityMissingFields(facility) {
  const missing = [];
  if (isMissingText(facility.phone)) missing.push("phone");
  if (isMissingText(facility.website)) missing.push("website");
  if (!Array.isArray(facility.services) || facility.services.length === 0) {
    missing.push("services");
  }
  if (!facility.hours || Object.keys(facility.hours).length === 0) {
    missing.push("hours");
  }
  if (!facility.priceInfo || facility.priceInfo.priceLevel === "unknown") {
    missing.push("price details");
  }
  if (!facility.insuranceInfo || Object.keys(facility.insuranceInfo).length === 0) {
    missing.push("insurance details");
  }
  return missing;
}

function summarizeFacility(facility) {
  return {
    id: facility.id,
    name: facility.name,
    facilityType: facility.facilityType,
    address: facility.address ?? null,
    city: facility.city ?? null,
    state: facility.state ?? null,
    postalCode: facility.postalCode ?? null,
    phone: facility.phone ?? null,
    website: facility.website ?? null,
    latitude: facility.latitude ?? null,
    longitude: facility.longitude ?? null,
    source: {
      agency:
        facility.facilityType === "community_health_center"
          ? "Health Resources and Services Administration"
          : "Centers for Medicare & Medicaid Services",
      dataset: facility.sourceDataset,
      sourceId: facility.sourceId ?? null,
      url: facility.sourceInfo?.sourceUrl ?? null,
      checkedDate:
        facility.sourceInfo?.lastChecked ?? facility.lastVerified ?? null
    },
    contactAndSourceNotes: facility.sourceInfo?.notes ?? null,
    missingFields: getFacilityMissingFields(facility),
    dataCompletenessNotes: facility.dataCompletenessNotes ?? null
  };
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, columns) {
  return [
    columns.map(({ header }) => csvCell(header)).join(","),
    ...rows.map((row) =>
      columns.map(({ value }) => csvCell(value(row))).join(",")
    )
  ].join("\n") + "\n";
}

function getRequiredContractById(rule) {
  return new Map(
    [rule.communityHealthNeed, rule.socialBarriers, rule.documentedShortage]
      .flatMap(({ requiredMeasures }) => requiredMeasures)
      .map((measure) => [measure.id, measure])
  );
}

function getEvidenceSection(observations, evidenceLayer) {
  return observations
    .filter((observation) => observation.measure.evidenceLayer === evidenceLayer)
    .sort((first, second) =>
      first.measure.label.localeCompare(second.measure.label)
    );
}

function getReferencePoint(feature) {
  const latitude = Number(feature.properties?.INTPTLAT);
  const longitude = Number(feature.properties?.INTPTLON);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`${feature.properties?.GEOID} lacks an official Census internal point.`);
  }
  return {
    latitude,
    longitude,
    method: "Official 2024 Census tract internal point",
    sourceAgency: "United States Census Bureau",
    sourceDataset: "TIGERweb ACS 2024 Census Tracts",
    checkedDate: "2026-07-11"
  };
}

function buildNearestCenter(referencePoint, safetyNetFacilities) {
  let nearest = null;
  for (const facility of safetyNetFacilities) {
    const distance = greatCircleMiles(referencePoint, facility);
    if (!nearest || distance < nearest.distanceMiles) {
      nearest = { distanceMiles: distance, facility };
    }
  }
  if (!nearest) return null;
  return {
    distanceMiles: formatNumber(nearest.distanceMiles, 2),
    distanceMethod: {
      name: "Haversine great-circle distance",
      units: "miles",
      earthRadiusMiles,
      note: "Straight-line distance from the official Census tract internal point to source-backed facility coordinates. It is not travel distance and does not imply that the nearest loaded center is the best or most appropriate center."
    },
    facility: summarizeFacility(nearest.facility)
  };
}

function buildSources(observations, facilities) {
  const sourceByKey = new Map();
  for (const observation of observations) {
    const key = `${observation.source.agency}|${observation.source.dataset}|${observation.source.releaseYear}|${observation.source.url}|${observation.provenance.checkedDate}`;
    sourceByKey.set(key, {
      agency: observation.source.agency,
      dataset: observation.source.dataset,
      releaseYear: observation.source.releaseYear,
      url: observation.source.url,
      checkedDate: observation.provenance.checkedDate
    });
  }
  for (const facility of facilities) {
    const source = facility.source;
    const key = `${source.agency}|${source.dataset}|${source.url}|${source.checkedDate}`;
    sourceByKey.set(key, source);
  }
  return [...sourceByKey.values()].sort((first, second) =>
    `${first.agency}|${first.dataset}`.localeCompare(
      `${second.agency}|${second.dataset}`
    )
  );
}

function buildGapDrivers(observations) {
  const observationById = new Map(
    observations.map((observation) => [observation.measure.id, observation])
  );
  return gapDriverDefinitions.map((definition) => {
    const availableMeasureIds = definition.relatedMeasureIds.filter(
      (measureId) => !observationById.get(measureId)?.missingness.isMissing
    );
    return {
      ...definition,
      availableMeasureIds,
      missingMeasureIds: definition.relatedMeasureIds.filter(
        (measureId) => !availableMeasureIds.includes(measureId)
      ),
      interpretation: "Context only. This driver does not create, remove or change the tract's screening state."
    };
  });
}

function buildActionPaths(observations) {
  const observationById = new Map(
    observations.map((observation) => [observation.measure.id, observation])
  );
  const hasActiveShortage = [
    "hrsa_active_primary_care_hpsa_component_count",
    "hrsa_active_dental_health_hpsa_component_count",
    "hrsa_active_mental_health_hpsa_component_count"
  ].some((measureId) => Number(observationById.get(measureId)?.value ?? 0) > 0);

  return actionPathDefinitions
    .filter((path) => !path.requiresActiveShortage || hasActiveShortage)
    .map(({ requiresActiveShortage: _requiresActiveShortage, ...path }) => ({
      ...path,
      framing: "Official resource to investigate, not a personalized recommendation or guaranteed solution."
    }));
}

function buildTractRecord({
  classification,
  evidence,
  feature,
  foundation,
  facilitiesById,
  requiredContractById,
  safetyNetFacilities
}) {
  const referencePoint = getReferencePoint(feature);
  const assignedFacilityIds = [
    ...foundation.documentedCapacity.hrsaHealthCenterIds,
    ...foundation.documentedCapacity.cmsHospitalIds
  ];
  const assignedFacilities = assignedFacilityIds
    .map((id) => facilitiesById.get(id))
    .filter(Boolean)
    .map(summarizeFacility);
  const ruleInputs = classification.ruleInputs.map((input) => {
    const observation = evidence.find(
      ({ measure }) => measure.id === input.measureId
    );
    const contract = requiredContractById.get(input.measureId);
    return {
      ...input,
      label: observation?.measure.label ?? input.measureId,
      meaning: contract?.meaning ?? null,
      estimateType: observation?.estimateType ?? "unavailable",
      source: observation?.source ?? null,
      checkedDate: observation?.provenance.checkedDate ?? null,
      transformation: observation?.provenance.transformation ?? null
    };
  });
  const missingEvidence = evidence
    .filter(({ missingness }) => missingness.isMissing)
    .map((observation) => ({
      measureId: observation.measure.id,
      label: observation.measure.label,
      reason: observation.missingness.reason,
      requiredByRule: requiredContractById.has(observation.measure.id)
    }));

  return {
    schemaVersion: "1.1.0",
    recordType: "tract_access_gap_screening_record",
    ruleVersion: classification.ruleVersion,
    generatedDate,
    geography: {
      ...foundation.geography,
      officialInternalPoint: referencePoint
    },
    screening: {
      state: classification.state,
      label: classification.label,
      findings: classification.findings,
      ruleInputs
    },
    evidence: {
      communityHealthNeed: getEvidenceSection(evidence, "community_health_need"),
      socialBarriers: getEvidenceSection(evidence, "social_barriers"),
      officialShortage: getEvidenceSection(evidence, "official_shortage")
    },
    documentedFacilityContext: {
      countsByType: {
        hrsaCommunityHealthCenters:
          foundation.documentedCapacity.hrsaHealthCenterCount,
        cmsHospitals: foundation.documentedCapacity.cmsHospitalCount
      },
      loadedFacilitiesInTract: assignedFacilities,
      nearestSourceBackedSafetyNetCenter: buildNearestCenter(
        referencePoint,
        safetyNetFacilities
      ),
      limitations: [
        "HRSA community health centers and CMS hospitals are shown as separate facility types.",
        "A CMS hospital is not counted as primary-care capacity without supporting source evidence.",
        "The loaded facility layer is not a complete provider directory, and missing pins do not mean zero healthcare.",
        "Nearest means shortest straight-line distance among loaded source-backed HRSA community health centers; it does not mean best, highest quality or most appropriate."
      ]
    },
    gapDrivers: buildGapDrivers(evidence),
    actionPaths: buildActionPaths(evidence),
    missingEvidence,
    explanations: classification.explanations,
    limitations: classification.limitations,
    sources: buildSources(evidence, assignedFacilities)
  };
}

function buildMeasureCoverage(records, requiredContractById) {
  const observations = records.flatMap((record) => [
    ...record.evidence.communityHealthNeed,
    ...record.evidence.socialBarriers,
    ...record.evidence.officialShortage
  ]);
  const byMeasure = new Map();
  for (const observation of observations) {
    const current = byMeasure.get(observation.measure.id) ?? {
      measureId: observation.measure.id,
      label: observation.measure.label,
      unit: observation.unit,
      estimateType: observation.estimateType,
      evidenceLayer: observation.measure.evidenceLayer,
      requiredByRule: requiredContractById.has(observation.measure.id),
      nonMissingCount: 0,
      missingCount: 0,
      source: {
        ...observation.source,
        checkedDate: observation.provenance.checkedDate
      }
    };
    if (observation.missingness.isMissing) current.missingCount += 1;
    else current.nonMissingCount += 1;
    byMeasure.set(observation.measure.id, current);
  }
  return [...byMeasure.values()].sort((first, second) =>
    first.measureId.localeCompare(second.measureId)
  );
}

function buildCountyRecord(countyFips, tractRecords, rule, requiredContractById) {
  const stateCounts = Object.fromEntries(
    Object.keys(rule.stateLabels).map((state) => [
      state,
      tractRecords.filter((record) => record.screening.state === state).length
    ])
  );
  const statePercentages = Object.fromEntries(
    Object.entries(stateCounts).map(([state, count]) => [
      state,
      formatNumber((count / tractRecords.length) * 100, 1)
    ])
  );
  const first = tractRecords[0];
  const measureCoverage = buildMeasureCoverage(
    tractRecords,
    requiredContractById
  );

  return {
    schemaVersion: "1.1.0",
    recordType: "county_access_gap_screening_summary",
    ruleVersion: rule.ruleVersion,
    generatedDate,
    geography: {
      type: "county",
      stateFips: "34",
      countyFips,
      geoid: `34${countyFips}`,
      name: first.geography.countyName
    },
    tractCount: tractRecords.length,
    screeningStateCounts: stateCounts,
    screeningStatePercentagesOfTracts: statePercentages,
    requiredRuleInputs: [
      rule.communityHealthNeed,
      rule.socialBarriers,
      rule.documentedShortage
    ].flatMap(({ requiredMeasures }) => requiredMeasures),
    measureCoverage,
    missingness: {
      tractsWithMissingRequiredEvidence: tractRecords.filter(
        (record) => record.screening.state === "insufficient_evidence"
      ).length,
      note: "Missing required evidence remains Insufficient evidence and is never converted to zero."
    },
    facilityCountsByType: {
      hrsaCommunityHealthCenters: tractRecords.reduce(
        (sum, record) =>
          sum + record.documentedFacilityContext.countsByType.hrsaCommunityHealthCenters,
        0
      ),
      cmsHospitals: tractRecords.reduce(
        (sum, record) =>
          sum + record.documentedFacilityContext.countsByType.cmsHospitals,
        0
      )
    },
    explanations: [
      "County counts and percentages are generated from validated tract screening records.",
      "Percentages use all foundation tracts in the county as the denominator.",
      "CareAtlas does not average percentile ranks or designation counts into a county score or ranking."
    ],
    limitations: rule.limitations,
    sources: buildSources(
      tractRecords.flatMap((record) => [
        ...record.evidence.communityHealthNeed,
        ...record.evidence.socialBarriers,
        ...record.evidence.officialShortage
      ]),
      []
    )
  };
}

function getTractCsvColumns(measureIds) {
  const columns = [
    ["tract_geoid", (row) => row.geography.geoid],
    ["tract_name", (row) => row.geography.name],
    ["county_fips", (row) => row.geography.countyFips],
    ["county_name", (row) => row.geography.countyName],
    ["rule_version", (row) => row.ruleVersion],
    ["screening_state", (row) => row.screening.state],
    ["screening_label", (row) => row.screening.label],
    ["census_internal_point_latitude", (row) => row.geography.officialInternalPoint.latitude],
    ["census_internal_point_longitude", (row) => row.geography.officialInternalPoint.longitude],
    ["hrsa_community_health_center_count", (row) => row.documentedFacilityContext.countsByType.hrsaCommunityHealthCenters],
    ["cms_hospital_count", (row) => row.documentedFacilityContext.countsByType.cmsHospitals],
    ["nearest_safety_net_center_id", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.id],
    ["nearest_safety_net_center_name", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.name],
    ["nearest_safety_net_center_distance_miles", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.distanceMiles],
    ["nearest_safety_net_center_address", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.address],
    ["nearest_safety_net_center_city", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.city],
    ["nearest_safety_net_center_postal_code", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.postalCode],
    ["nearest_safety_net_center_phone", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.phone],
    ["nearest_safety_net_center_website", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.website],
    ["nearest_safety_net_center_source_agency", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.source.agency],
    ["nearest_safety_net_center_source_dataset", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.source.dataset],
    ["nearest_safety_net_center_source_id", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.source.sourceId],
    ["nearest_safety_net_center_source_url", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.source.url],
    ["nearest_safety_net_center_checked_date", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.source.checkedDate],
    ["nearest_safety_net_center_missing_fields_json", (row) => row.documentedFacilityContext.nearestSourceBackedSafetyNetCenter?.facility.missingFields],
    ["loaded_facilities_in_tract_json", (row) => row.documentedFacilityContext.loadedFacilitiesInTract]
  ].map(([header, value]) => ({ header, value }));

  for (const measureId of measureIds) {
    const getObservation = (row) => [
      ...row.evidence.communityHealthNeed,
      ...row.evidence.socialBarriers,
      ...row.evidence.officialShortage
    ].find(({ measure }) => measure.id === measureId);
    const getRuleInput = (row) => row.screening.ruleInputs.find(
      (input) => input.measureId === measureId
    );
    columns.push(
      { header: `${measureId}__value`, value: (row) => getObservation(row)?.value },
      { header: `${measureId}__unit`, value: (row) => getObservation(row)?.unit },
      { header: `${measureId}__estimate_type`, value: (row) => getObservation(row)?.estimateType },
      { header: `${measureId}__missing`, value: (row) => getObservation(row)?.missingness.isMissing },
      { header: `${measureId}__missing_reason`, value: (row) => getObservation(row)?.missingness.reason },
      { header: `${measureId}__operator`, value: (row) => getRuleInput(row)?.operator },
      { header: `${measureId}__threshold`, value: (row) => getRuleInput(row)?.threshold },
      { header: `${measureId}__triggered`, value: (row) => getRuleInput(row)?.triggered },
      { header: `${measureId}__source_agency`, value: (row) => getObservation(row)?.source.agency },
      { header: `${measureId}__dataset`, value: (row) => getObservation(row)?.source.dataset },
      { header: `${measureId}__release_year`, value: (row) => getObservation(row)?.source.releaseYear },
      { header: `${measureId}__checked_date`, value: (row) => getObservation(row)?.provenance.checkedDate }
    );
  }
  columns.push(
    { header: "gap_drivers_json", value: (row) => row.gapDrivers },
    { header: "action_paths_json", value: (row) => row.actionPaths },
    { header: "missing_evidence_json", value: (row) => row.missingEvidence },
    { header: "explanations_json", value: (row) => row.explanations },
    { header: "limitations_json", value: (row) => row.limitations },
    { header: "facility_context_limitations_json", value: (row) => row.documentedFacilityContext.limitations },
    { header: "sources_json", value: (row) => row.sources }
  );
  return columns;
}

function getCountyCsvColumns() {
  return [
    ["county_geoid", (row) => row.geography.geoid],
    ["county_fips", (row) => row.geography.countyFips],
    ["county_name", (row) => row.geography.name],
    ["rule_version", (row) => row.ruleVersion],
    ["tract_count", (row) => row.tractCount],
    ["potential_access_gap_count", (row) => row.screeningStateCounts.potential_access_gap],
    ["potential_access_gap_percent", (row) => row.screeningStatePercentagesOfTracts.potential_access_gap],
    ["elevated_need_without_documented_shortage_count", (row) => row.screeningStateCounts.elevated_need_without_documented_shortage],
    ["elevated_need_without_documented_shortage_percent", (row) => row.screeningStatePercentagesOfTracts.elevated_need_without_documented_shortage],
    ["no_current_gap_flag_count", (row) => row.screeningStateCounts.no_current_gap_flag],
    ["no_current_gap_flag_percent", (row) => row.screeningStatePercentagesOfTracts.no_current_gap_flag],
    ["insufficient_evidence_count", (row) => row.screeningStateCounts.insufficient_evidence],
    ["insufficient_evidence_percent", (row) => row.screeningStatePercentagesOfTracts.insufficient_evidence],
    ["hrsa_community_health_center_count", (row) => row.facilityCountsByType.hrsaCommunityHealthCenters],
    ["cms_hospital_count", (row) => row.facilityCountsByType.cmsHospitals],
    ["required_rule_inputs_json", (row) => row.requiredRuleInputs],
    ["measure_coverage_json", (row) => row.measureCoverage],
    ["missingness_json", (row) => row.missingness],
    ["explanations_json", (row) => row.explanations],
    ["limitations_json", (row) => row.limitations],
    ["sources_json", (row) => row.sources]
  ].map(([header, value]) => ({ header, value }));
}

function buildReport(rule, summary, countyRecords, allRecords) {
  const measureCoverage = buildMeasureCoverage(
    allRecords,
    getRequiredContractById(rule)
  );
  const lines = [
    "# New Jersey statewide access-gap screening report",
    "",
    `Generated ${generatedDate} from CareAtlas rule version ${rule.ruleVersion}.`,
    "",
    "## What CareAtlas measures",
    "",
    "CareAtlas combines four CDC PLACES modeled community-health estimates, the official CDC/ATSDR SVI overall percentile rank and reviewed HRSA primary-care HPSA/MUA/P designation evidence through a transparent screening rule. A fifth CDC PLACES transportation-barrier estimate, additional SVI themes, Census ACS survey-derived estimates, dental and mental-health HPSA evidence and source-backed facility records remain visible context without changing the rule.",
    "",
    "The output is a public-health screening record. It is not a ranking, diagnosis, medical advice, individual-level statement or proof of cause.",
    "",
    "## Four screening states",
    "",
    "- **Potential access gap:** elevated community health need or social barriers plus documented primary-care shortage evidence.",
    "- **Elevated need without documented shortage:** elevated need evidence without a matching active reviewed primary-care HPSA or MUA/P component.",
    "- **No current gap flag:** this rule's elevated-need condition was not met. This does not prove adequate access.",
    "- **Insufficient evidence:** at least one required value is missing. Missing evidence is never converted to zero.",
    "",
    "## Rule thresholds",
    "",
    "| Required input | Operator | Threshold | Unit |",
    "|---|---:|---:|---|",
    ...[rule.communityHealthNeed, rule.socialBarriers, rule.documentedShortage]
      .flatMap(({ requiredMeasures }) => requiredMeasures)
      .map((measure) => `| ${measure.id} | ${measure.operator} | ${measure.threshold} | ${measure.unit} |`),
    "",
    "Community health need is elevated when at least two of the four PLACES thresholds trigger. Social barriers are elevated when overall SVI is at or above 0.75. Documented shortage is present when at least one reviewed active primary-care HPSA or MUA/P component intersects the tract.",
    "",
    "## Statewide results",
    "",
    `- Potential access gap: ${summary.stateCounts.potential_access_gap.toLocaleString("en-US")}`,
    `- Elevated need without documented shortage: ${summary.stateCounts.elevated_need_without_documented_shortage.toLocaleString("en-US")}`,
    `- No current gap flag: ${summary.stateCounts.no_current_gap_flag.toLocaleString("en-US")}`,
    `- Insufficient evidence: ${summary.stateCounts.insufficient_evidence.toLocaleString("en-US")}`,
    `- Total New Jersey tracts: ${summary.tractCount.toLocaleString("en-US")}`,
    "",
    "## County summaries",
    "",
    "Counts and percentages below use validated tract records. CareAtlas does not average percentile ranks or designation counts into a county score.",
    "",
    "| County | Tracts | Potential access gap | Elevated need, no documented shortage | No current gap flag | Insufficient evidence | HRSA centers | CMS hospitals |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...countyRecords.map((county) => {
      const count = county.screeningStateCounts;
      const percent = county.screeningStatePercentagesOfTracts;
      return `| ${county.geography.name} | ${county.tractCount} | ${count.potential_access_gap} (${percent.potential_access_gap}%) | ${count.elevated_need_without_documented_shortage} (${percent.elevated_need_without_documented_shortage}%) | ${count.no_current_gap_flag} (${percent.no_current_gap_flag}%) | ${count.insufficient_evidence} (${percent.insufficient_evidence}%) | ${county.facilityCountsByType.hrsaCommunityHealthCenters} | ${county.facilityCountsByType.cmsHospitals} |`;
    }),
    "",
    "## Source coverage",
    "",
    "| Evidence measure | Non-missing tracts | Missing tracts | Estimate type | Source | Release |",
    "|---|---:|---:|---|---|---:|",
    ...measureCoverage.map((measure) => `| ${measure.label} | ${measure.nonMissingCount} | ${measure.missingCount} | ${measure.estimateType} | ${measure.source.agency} - ${measure.source.dataset} | ${measure.source.releaseYear} |`),
    "",
    "## Missing evidence",
    "",
    `${summary.stateCounts.insufficient_evidence} tracts have at least one missing required input and remain Insufficient evidence. Missing values are unknown, not zero. Missing facility pins do not mean zero healthcare.`,
    "",
    "## Facility context and distance method",
    "",
    "HRSA community health centers and CMS hospitals remain separate. Hospitals are not counted as primary-care capacity without supporting source evidence. Nearest safety-net center is the shortest Haversine great-circle distance from the official 2024 Census tract internal point to source-backed New Jersey HRSA community health-center coordinates, using an Earth radius of 3,958.7613 miles. This is straight-line distance, not travel distance, and nearest does not mean best or most appropriate.",
    "",
    "## Gap drivers and action paths",
    "",
    "Each tract record groups validated observations into transportation, coverage and affordability, ongoing-care and documented-shortage context. These groups do not add scores, rankings or new classification thresholds. The record also links to official HRSA and New Jersey resources that a user may investigate. Those links are not personalized recommendations, eligibility decisions or guaranteed solutions.",
    "",
    "## Limitations",
    "",
    ...rule.limitations.map((limitation) => `- ${limitation}`),
    "- CDC PLACES values are modeled population estimates, not individual diagnoses.",
    "- ACS values are survey-derived estimates; CareAtlas does not claim they cause healthcare access conditions.",
    "- SVI values are official national percentile ranks, not CareAtlas rankings.",
    "- HRSA designations can apply to whole areas, parts of areas or defined population groups.",
    "- The loaded facility layer is not a complete provider directory and does not measure medical quality.",
    "",
    "CareAtlas provides public-health planning context only. These findings are not diagnoses, clinical guidance or medical advice.",
    ""
  ];
  return lines.join("\n");
}

async function main() {
  const [rule, summary, foundation, facilities] = await Promise.all([
    readJson(rulePath),
    readJson(ruleSummaryPath),
    readJson(foundationPath),
    readJson(facilityPath)
  ]);
  const countyFiles = (await fs.readdir(geometryRoot))
    .filter((file) => /^\d{3}\.geojson$/.test(file))
    .sort();
  const facilitiesById = new Map(facilities.map((facility) => [facility.id, facility]));
  const foundationByGeoid = new Map(
    foundation.records.map((record) => [record.geography.geoid, record])
  );
  const safetyNetFacilities = facilities.filter(
    (facility) =>
      facility.state === "NJ" &&
      facility.facilityType === "community_health_center" &&
      Number.isFinite(facility.latitude) &&
      Number.isFinite(facility.longitude)
  );
  const requiredContractById = getRequiredContractById(rule);
  const measureIds = [];
  const allRecords = [];
  const countyRecords = [];
  const manifestCounties = [];

  await fs.rm(outputRoot, { recursive: true, force: true });

  for (const fileName of countyFiles) {
    const countyFips = fileName.slice(0, 3);
    const [geometry, classifications, ...evidenceShards] = await Promise.all([
      readJson(path.join(geometryRoot, fileName)),
      readJson(path.join(classificationRoot, `${countyFips}.json`)),
      ...sourceSlugs.map((slug) =>
        readJson(path.join(evidenceRoot, slug, "by-county", `${countyFips}.json`))
      )
    ]);
    const featureByGeoid = new Map(
      geometry.features.map((feature) => [feature.properties.GEOID, feature])
    );
    const evidenceByGeoid = new Map();
    for (const observation of evidenceShards.flat()) {
      const records = evidenceByGeoid.get(observation.geography.geoid) ?? [];
      records.push(observation);
      evidenceByGeoid.set(observation.geography.geoid, records);
      if (!measureIds.includes(observation.measure.id)) {
        measureIds.push(observation.measure.id);
      }
    }
    const records = classifications.map((classification) =>
      buildTractRecord({
        classification,
        evidence: evidenceByGeoid.get(classification.geography.geoid) ?? [],
        feature: featureByGeoid.get(classification.geography.geoid),
        foundation: foundationByGeoid.get(classification.geography.geoid),
        facilitiesById,
        requiredContractById,
        safetyNetFacilities
      })
    );
    const countyRecord = buildCountyRecord(
      countyFips,
      records,
      rule,
      requiredContractById
    );
    const jsonRelativePath = `tracts/by-county/${countyFips}.json`;
    const csvRelativePath = `tracts/by-county/${countyFips}.csv`;
    await Promise.all([
      writeJson(path.join(outputRoot, jsonRelativePath), records),
      writeText(
        path.join(outputRoot, csvRelativePath),
        toCsv(records, getTractCsvColumns(measureIds.sort()))
      )
    ]);
    allRecords.push(...records);
    countyRecords.push(countyRecord);
    manifestCounties.push({
      countyFips,
      countyName: countyRecord.geography.name,
      tractCount: records.length,
      jsonUrl: `/data/tracts/nj/public-records/${jsonRelativePath}`,
      csvUrl: `/data/tracts/nj/public-records/${csvRelativePath}`
    });
  }

  await Promise.all([
    writeJson(path.join(countyOutputRoot, "new-jersey-counties.json"), countyRecords),
    writeText(
      path.join(countyOutputRoot, "new-jersey-counties.csv"),
      toCsv(countyRecords, getCountyCsvColumns())
    ),
    writeText(
      path.join(reportOutputRoot, "new-jersey-access-gap-report.md"),
      buildReport(rule, summary, countyRecords, allRecords)
    ),
    writeJson(path.join(outputRoot, "download-manifest.json"), {
      schemaVersion: "1.1.0",
      ruleVersion: rule.ruleVersion,
      generatedDate,
      pilotState: "New Jersey",
      stateFips: "34",
      tractCount: allRecords.length,
      countyCount: countyRecords.length,
      tractRecords: {
        format: "county-sharded tract-level records",
        counties: manifestCounties
      },
      countyRecords: {
        jsonUrl: "/data/tracts/nj/public-records/counties/new-jersey-counties.json",
        csvUrl: "/data/tracts/nj/public-records/counties/new-jersey-counties.csv"
      },
      statewideReportUrl:
        "/data/tracts/nj/public-records/reports/new-jersey-access-gap-report.md",
      distanceMethod: {
        name: "Haversine great-circle distance",
        earthRadiusMiles,
        origin: "Official 2024 Census tract internal point",
        destination: "Source-backed New Jersey HRSA community health center coordinates"
      },
      limitations: rule.limitations
    })
  ]);

  console.log(
    `Generated Batch 8 public records for ${allRecords.length} tracts and ${countyRecords.length} counties.`
  );
  console.log(
    `Nearest-center context used ${safetyNetFacilities.length} source-backed New Jersey HRSA community health centers.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
