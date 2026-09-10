import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import {
  doctorOfficeSourceConfig,
  doctorOfficeSpecialties
} from "./doctorOfficeSourceConfig.mjs";

const specialtyFields = [
  "pri_spec",
  "sec_spec_1",
  "sec_spec_2",
  "sec_spec_3",
  "sec_spec_4"
];
const specialtyIdBySourceLabel = new Map(
  doctorOfficeSpecialties.flatMap((specialty) =>
    specialty.sourceSpecialties.map((sourceSpecialty) => [
      sourceSpecialty,
      specialty.id
    ])
  )
);

function text(value) {
  return String(value ?? "").trim();
}

function normalizeSourceLabel(value) {
  return text(value).toUpperCase().replace(/\s+/gu, " ");
}

function uniqueSorted(values) {
  return [...new Set(values.map(text).filter(Boolean))].sort((first, second) =>
    first.localeCompare(second)
  );
}

function getSpecialtyIds(row) {
  return uniqueSorted(
    specialtyFields.flatMap((field) => {
      const specialtyId = specialtyIdBySourceLabel.get(
        normalizeSourceLabel(row[field])
      );
      return specialtyId ? [specialtyId] : [];
    })
  );
}

function getSourceRowId(row) {
  return [
    text(row.npi),
    text(row.ind_enrl_id),
    text(row.org_pac_id) || "solo",
    text(row.adrs_id)
  ].join("|");
}

function normalizeAddressPart(value) {
  return normalizeSourceLabel(value).replace(/[.,]/gu, "");
}

function getOfficeGroupKey(row) {
  return [
    text(row.adrs_id),
    normalizeAddressPart(row.adr_ln_1),
    normalizeAddressPart(row.adr_ln_2),
    normalizeAddressPart(row.citytown),
    normalizeAddressPart(row.state),
    normalizeAddressPart(row.zip_code)
  ].join("|");
}

function getProviderDisplayName(row) {
  return [
    row.provider_first_name,
    row.provider_middle_name,
    row.provider_last_name,
    row.suff
  ].map(text).filter(Boolean).join(" ");
}

function getPrimarySpecialties(row) {
  const value = normalizeSourceLabel(row.pri_spec);
  return value ? [value] : [];
}

function getSecondarySpecialties(row) {
  return uniqueSorted(
    specialtyFields.slice(1).map((field) => normalizeSourceLabel(row[field]))
  );
}

function getRequiredFieldIssue(row) {
  const requiredFields = [
    "npi",
    "ind_enrl_id",
    "adrs_id",
    "adr_ln_1",
    "citytown",
    "zip_code"
  ];
  return requiredFields.find((field) => !text(row[field])) ?? null;
}

function formatDisplayName(rows, providers, practiceNames) {
  if (practiceNames.length === 1) return practiceNames[0];
  if (practiceNames.length > 1) return "Multiple practices at this address";
  if (providers.length === 1) {
    return `${providers[0].displayName} practice location`;
  }
  return "CMS-listed practice location";
}

function stableOfficeId(groupKey) {
  return `cms-office-${createHash("sha256")
    .update(groupKey)
    .digest("hex")
    .slice(0, 20)}`;
}

function groupEligibleRows(rows, nppesDeactivations) {
  const exclusions = {
    deactivatedNpi: 0,
    duplicateQueryResult: 0,
    missingRequiredFields: 0,
    noMappedSpecialty: 0,
    outsideRequestedState: 0
  };
  const seenSourceRows = new Set();
  const eligibleRows = [];

  for (const row of rows) {
    if (normalizeSourceLabel(row.state) !== doctorOfficeSourceConfig.state) {
      exclusions.outsideRequestedState += 1;
      continue;
    }
    if (getRequiredFieldIssue(row)) {
      exclusions.missingRequiredFields += 1;
      continue;
    }
    const specialtyIds = getSpecialtyIds(row);
    if (specialtyIds.length === 0) {
      exclusions.noMappedSpecialty += 1;
      continue;
    }
    if (nppesDeactivations.has(text(row.npi))) {
      exclusions.deactivatedNpi += 1;
      continue;
    }
    const sourceRowId = getSourceRowId(row);
    if (seenSourceRows.has(sourceRowId)) {
      exclusions.duplicateQueryResult += 1;
      continue;
    }
    seenSourceRows.add(sourceRowId);
    eligibleRows.push({ ...row, sourceRowId, specialtyIds });
  }

  const rowsByOfficeKey = new Map();
  for (const row of eligibleRows) {
    const groupKey = getOfficeGroupKey(row);
    const groupRows = rowsByOfficeKey.get(groupKey) ?? [];
    groupRows.push(row);
    rowsByOfficeKey.set(groupKey, groupRows);
  }

  const candidates = [...rowsByOfficeKey.entries()].map(([groupKey, groupRows]) => {
    const providerRows = new Map();
    for (const row of groupRows) {
      const rowsForProvider = providerRows.get(text(row.npi)) ?? [];
      rowsForProvider.push(row);
      providerRows.set(text(row.npi), rowsForProvider);
    }
    const providers = [...providerRows.entries()].map(([npi, rowsForProvider]) => ({
      credentials: uniqueSorted(rowsForProvider.map((row) => row.cred)),
      displayName: getProviderDisplayName(rowsForProvider[0]),
      enrollmentIds: uniqueSorted(
        rowsForProvider.map((row) => row.ind_enrl_id)
      ),
      groupNames: uniqueSorted(rowsForProvider.map((row) => row.facility_name)),
      normalizedSpecialtyIds: uniqueSorted(
        rowsForProvider.flatMap((row) => row.specialtyIds)
      ),
      npi,
      nppesStatus: "not_deactivated_in_snapshot",
      primarySpecialties: uniqueSorted(
        rowsForProvider.flatMap(getPrimarySpecialties)
      ),
      secondarySpecialties: uniqueSorted(
        rowsForProvider.flatMap(getSecondarySpecialties)
      )
    })).sort((first, second) =>
      first.displayName.localeCompare(second.displayName) ||
      first.npi.localeCompare(second.npi)
    );
    const practiceNames = uniqueSorted(groupRows.map((row) => row.facility_name));
    const phones = uniqueSorted(groupRows.map((row) => row.telephone_number));
    const first = groupRows[0];
    const addressLine2Suppressed = groupRows.some(
      (row) => normalizeSourceLabel(row.ln_2_sprs) === "Y"
    );

    return {
      addressLine1: text(first.adr_ln_1),
      addressLine2: addressLine2Suppressed ? null : text(first.adr_ln_2) || null,
      addressPrecision:
        addressLine2Suppressed || !text(first.adr_ln_2)
          ? "building"
          : "suite",
      city: text(first.citytown),
      displayName: formatDisplayName(groupRows, providers, practiceNames),
      groupKey,
      id: stableOfficeId(groupKey),
      phone: phones.length === 1 ? phones[0] : null,
      postalCode: text(first.zip_code),
      practiceNames,
      providers,
      sourceRowIds: uniqueSorted(groupRows.map((row) => row.sourceRowId)),
      specialtyIds: uniqueSorted(groupRows.flatMap((row) => row.specialtyIds)),
      state: "NJ"
    };
  });

  candidates.sort((first, second) => first.id.localeCompare(second.id));
  return { candidates, eligibleRows, exclusions };
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, "&");
}

function parseSharedStrings(xml) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/gu)].map((match) =>
    decodeXml(
      [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gu)]
        .map((textMatch) => textMatch[1])
        .join("")
    )
  );
}

function parseNppesDeactivationZip(zipBuffer) {
  const outerZip = new AdmZip(zipBuffer);
  const workbookEntry = outerZip
    .getEntries()
    .find((entry) => entry.entryName.toLowerCase().endsWith(".xlsx"));
  if (!workbookEntry) {
    throw new Error("NPPES deactivation ZIP does not contain an XLSX workbook.");
  }

  const workbookZip = new AdmZip(workbookEntry.getData());
  const sharedStringsEntry = workbookZip.getEntry("xl/sharedStrings.xml");
  const sheetEntry = workbookZip.getEntry("xl/worksheets/sheet1.xml");
  if (!sharedStringsEntry || !sheetEntry) {
    throw new Error("NPPES deactivation workbook is missing required XML parts.");
  }
  const sharedStrings = parseSharedStrings(
    sharedStringsEntry.getData().toString("utf8")
  );
  const sheetXml = sheetEntry.getData().toString("utf8");
  const deactivations = new Map();
  let reportTitle = "";

  for (const rowMatch of sheetXml.matchAll(/<row\s[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/gu)) {
    const rowNumber = Number(rowMatch[1]);
    const cells = new Map();
    for (const cellMatch of rowMatch[2].matchAll(
      /<c\s([^>]*)>([\s\S]*?)<\/c>/gu
    )) {
      const reference = cellMatch[1].match(/\br="([A-Z]+)\d+"/u)?.[1];
      const valueType = cellMatch[1].match(/\bt="([^"]+)"/u)?.[1];
      const valueMatch = cellMatch[2].match(/<v>([\s\S]*?)<\/v>/u);
      if (!reference) continue;
      if (!valueMatch) continue;
      const rawValue = decodeXml(valueMatch[1]);
      cells.set(
        reference,
        valueType === "s"
          ? sharedStrings[Number(rawValue)] ?? ""
          : rawValue
      );
    }
    if (rowNumber === 1) reportTitle = text(cells.get("A"));
    if (rowNumber <= 2) continue;
    const npi = text(cells.get("A"));
    const sourceDate = text(cells.get("B"));
    if (!/^\d{10}$/u.test(npi)) continue;
    const dateMatch = sourceDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/u);
    if (!dateMatch) {
      throw new Error(`Invalid NPPES deactivation date for NPI ${npi}.`);
    }
    deactivations.set(npi, `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`);
  }

  if (deactivations.size === 0) {
    throw new Error("NPPES deactivation workbook produced no NPI records.");
  }
  return { deactivations, reportTitle, workbookName: workbookEntry.entryName };
}

function parseCsvMatrix(raw) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (quoted) {
      if (character === '"' && raw[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("CSV ended inside a quoted field.");
  if (field || row.length) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => text(value)));
}

function isPointInRing(latitude, longitude, ring) {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [currentLongitude, currentLatitude] = ring[index];
    const [previousLongitude, previousLatitude] = ring[previous];
    const crosses = currentLatitude > latitude !== previousLatitude > latitude;
    const crossingLongitude =
      ((previousLongitude - currentLongitude) *
        (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude;
    if (crosses && longitude < crossingLongitude) inside = !inside;
  }
  return inside;
}

function isPointInFeature(latitude, longitude, feature) {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.type === "MultiPolygon"
      ? feature.geometry.coordinates
      : [];
  return polygons.some((polygon) =>
    polygon[0] &&
    isPointInRing(latitude, longitude, polygon[0]) &&
    polygon.slice(1).every((hole) => !isPointInRing(latitude, longitude, hole))
  );
}

function publishGeocodedOffices(candidates, geocodes, counties) {
  const offices = [];
  const rejected = {
    outsideNewJerseyBoundary: 0,
    unmatchedGeocode: 0
  };

  for (const candidate of candidates) {
    const geocode = geocodes.get(candidate.id);
    if (!geocode) {
      rejected.unmatchedGeocode += 1;
      continue;
    }
    const matchingCounties = counties.filter((county) =>
      isPointInFeature(geocode.latitude, geocode.longitude, county)
    );
    if (matchingCounties.length !== 1) {
      rejected.outsideNewJerseyBoundary += 1;
      continue;
    }
    offices.push({
      addressLine1: candidate.addressLine1,
      addressLine2: candidate.addressLine2,
      addressPrecision: candidate.addressPrecision,
      city: candidate.city,
      countyFips: text(matchingCounties[0].properties?.COUNTYFP),
      displayName: candidate.displayName,
      id: candidate.id,
      latitude: geocode.latitude,
      longitude: geocode.longitude,
      phone: candidate.phone,
      postalCode: candidate.postalCode,
      practiceNames: candidate.practiceNames,
      providers: candidate.providers,
      provenance: {
        censusGeocoderBenchmark:
          doctorOfficeSourceConfig.censusGeocoder.benchmark,
        censusGeocoderCheckedDate:
          doctorOfficeSourceConfig.censusGeocoder.checkedDate,
        censusGeocoderMatchedAddress: geocode.matchedAddress,
        censusGeocoderMatchType: geocode.matchType,
        cmsAddressId: candidate.groupKey.split("|", 1)[0],
        cmsDatasetId: doctorOfficeSourceConfig.cms.datasetId,
        cmsReleaseDate: doctorOfficeSourceConfig.cms.releaseDate,
        nppesCheckedDate: doctorOfficeSourceConfig.checkedDate,
        sourceRowIds: candidate.sourceRowIds
      },
      specialtyIds: candidate.specialtyIds,
      state: candidate.state
    });
  }
  offices.sort((first, second) => first.id.localeCompare(second.id));
  return { offices, rejected };
}

function buildUnmatchedGeocodeReview({ candidates, geocodes, previousReview }) {
  const previousRecords = new Map(
    (previousReview?.records ?? []).map((record) => [record.id, record])
  );
  const records = candidates
    .filter((candidate) => !geocodes.has(candidate.id))
    .map((candidate) => {
      const previous = previousRecords.get(candidate.id);
      return {
        id: candidate.id,
        cmsAddressId: candidate.groupKey.split("|", 1)[0],
        displayName: candidate.displayName,
        sourceAddress: {
          addressLine1: candidate.addressLine1,
          addressLine2: candidate.addressLine2,
          city: candidate.city,
          state: candidate.state,
          postalCode: candidate.postalCode
        },
        practiceNames: candidate.practiceNames,
        providerCount: candidate.providers.length,
        specialtyIds: candidate.specialtyIds,
        reason: "census_geocoder_unmatched",
        review: previous?.review ?? {
          evidenceUrl: null,
          notes: null,
          reviewedAt: null,
          status: "pending"
        }
      };
    });

  return {
    schemaVersion: "1.0.0",
    generatedAt: doctorOfficeSourceConfig.checkedDate,
    productionPublicationRule:
      "Review records never publish coordinates. A location remains excluded until a later official-source import receives an accepted Census geocode inside exactly one New Jersey county.",
    source: {
      cmsDatasetId: doctorOfficeSourceConfig.cms.datasetId,
      cmsReleaseDate: doctorOfficeSourceConfig.cms.releaseDate,
      censusBenchmark: doctorOfficeSourceConfig.censusGeocoder.benchmark
    },
    recordCount: records.length,
    records
  };
}

function buildArtifact({
  cmsQueryRowCount,
  eligibleRows,
  exclusions,
  geocoderResultDigestSha256,
  nppesRecordCount,
  nppesSourceDigestSha256,
  offices,
  candidateOfficeCount,
  rejected
}) {
  const allProviderNpis = new Set(
    offices.flatMap((office) => office.providers.map((provider) => provider.npi))
  );
  const specialties = doctorOfficeSpecialties.map((specialty) => {
    const matchingOffices = offices.filter((office) =>
      office.specialtyIds.includes(specialty.id)
    );
    const matchingNpis = new Set(
      matchingOffices.flatMap((office) =>
        office.providers
          .filter((provider) =>
            provider.normalizedSpecialtyIds.includes(specialty.id)
          )
          .map((provider) => provider.npi)
      )
    );
    return {
      ...specialty,
      officeCount: matchingOffices.length,
      providerCount: matchingNpis.size
    };
  });
  const sourceRowDigestSha256 = createHash("sha256")
    .update(eligibleRows
      .map((row) => JSON.stringify(
        Object.fromEntries(
          Object.entries(row)
            .filter(([key]) => key !== "specialtyIds")
            .sort(([first], [second]) => first.localeCompare(second))
        )
      ))
      .sort()
      .join("\n"))
    .digest("hex");

  return {
    schemaVersion: "1.0.0",
    specialtyNormalizationVersion: "1.0.0",
    publicationStatus: "validated_pilot",
    generatedAt: doctorOfficeSourceConfig.checkedDate,
    state: doctorOfficeSourceConfig.state,
    stateFips: doctorOfficeSourceConfig.stateFips,
    refreshPolicy: doctorOfficeSourceConfig.refreshPolicy,
    coverage: {
      isComplete: false,
      officeCount: offices.length,
      providerCount: allProviderNpis.size,
      cmsQueryRowCount,
      eligibleSourceRowCount: eligibleRows.length,
      candidateOfficeCount,
      nppesDeactivationRecordCount: nppesRecordCount,
      nppesSourceDigestSha256,
      geocoderResultDigestSha256,
      sourceRowDigestSha256,
      exclusions: { ...exclusions, ...rejected },
      explanation:
        "This validated pilot includes geocoded New Jersey CMS Doctors and Clinicians practice-location rows for the published specialty families after NPPES deactivation screening. It is not a complete provider directory."
    },
    specialties,
    offices,
    sources: [
      {
        name: "CMS Doctors and Clinicians National Downloadable File",
        datasetId: doctorOfficeSourceConfig.cms.datasetId,
        url: doctorOfficeSourceConfig.cms.datasetUrl,
        dataDate: doctorOfficeSourceConfig.cms.dataDate,
        nextUpdateDate: doctorOfficeSourceConfig.cms.nextUpdateDate,
        releaseDate: doctorOfficeSourceConfig.cms.releaseDate,
        checkedDate: doctorOfficeSourceConfig.checkedDate
      },
      {
        name: "CMS National Plan and Provider Enumeration System (NPPES)",
        url: doctorOfficeSourceConfig.nppes.downloadPageUrl,
        downloadUrl: doctorOfficeSourceConfig.nppes.deactivationZipUrl,
        releaseDate: doctorOfficeSourceConfig.nppes.releaseDate,
        checkedDate: doctorOfficeSourceConfig.checkedDate
      },
      {
        name: "U.S. Census Bureau Geocoding Services",
        url: doctorOfficeSourceConfig.censusGeocoder.sourceUrl,
        serviceUrl: doctorOfficeSourceConfig.censusGeocoder.serviceUrl,
        checkedDate: doctorOfficeSourceConfig.censusGeocoder.checkedDate
      }
    ],
    limitations: [
      "This is not a complete directory of New Jersey clinicians or practices; it is limited to the selected specialties in the CMS Doctors and Clinicians source.",
      "A CMS-listed practice address does not establish current appointment availability, patient acceptance, insurance acceptance, capacity or medical quality.",
      "An NPI absent from the pinned deactivation report is described only as not deactivated in that snapshot; CareAtlas does not claim current licensure or practice activity.",
      "Census geocoder coordinates are calculated address-range locations and do not verify that a medical practice currently operates at the point.",
      "Doctor-office records never affect CareAtlas potential-access-gap classifications."
    ]
  };
}

export {
  buildArtifact,
  buildUnmatchedGeocodeReview,
  getOfficeGroupKey,
  getSourceRowId,
  getSpecialtyIds,
  groupEligibleRows,
  parseCsvMatrix,
  parseNppesDeactivationZip,
  publishGeocodedOffices,
  specialtyFields,
  text
};
