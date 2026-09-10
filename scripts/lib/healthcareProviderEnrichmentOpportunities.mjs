import path from "node:path";
import {
  accessCategoryFields,
  facilitiesPath,
  hasText,
  projectRoot,
  readFacilities,
  readOptionalJson,
  tmpDirectory,
  uniqueItems
} from "./healthcareAccessReporting.mjs";

export const providerOpportunityJsonPath = path.join(
  tmpDirectory,
  "healthcare-provider-enrichment-opportunities.json"
);
export const providerOpportunityCsvPath = path.join(
  tmpDirectory,
  "healthcare-provider-enrichment-opportunities.csv"
);
export const providerReviewPacketDirectory = path.join(
  tmpDirectory,
  "provider-review-packets"
);
export const worklistPath = path.join(tmpDirectory, "healthcare-enrichment-worklist.json");
export const discoveryReportPath = path.join(
  tmpDirectory,
  "healthcare-official-source-discovery-report.json"
);
export const reviewReportPath = path.join(
  tmpDirectory,
  "healthcare-official-enrichment-review-report.json"
);

const providerSuffixPattern =
  /\b(inc|llc|corp|corporation|company|co|health|healthcare|medical|clinic|clinics|center|centers|hospital|hospitals|system|systems|services|service|community|federally|qualified|fqhc|site|location)\b/g;
const bannedWebsiteHostPattern =
  /\b(google|yelp|facebook|instagram|x\.com|twitter|healthgrades|zocdoc|webmd|sharecare|yellowpages|mapquest)\b/i;
const datasetWideHosts = new Set([
  "data.hrsa.gov",
  "data.cms.gov",
  "cms.gov",
  "hrsa.gov",
  "medicare.gov"
]);

export function normalizeHostname(value) {
  if (!hasText(value)) {
    return "";
  }

  const raw = String(value).trim();

  if (/^(n\/?a|none|null|unknown|not listed|not available|no website|n)$/i.test(raw)) {
    return "";
  }

  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (!host.includes(".") || bannedWebsiteHostPattern.test(host)) {
      return "";
    }

    return host;
  } catch {
    return "";
  }
}

function normalizeProviderName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(providerSuffixPattern, " ")
    .replace(/\b(the|of|at|and|for|in|on|site|location)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value ?? "")
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function hostLabel(host) {
  if (!host) {
    return "";
  }

  const parts = host.split(".");
  const registrable = parts.length >= 2 ? parts.at(-2) : parts[0];
  return titleCase(registrable);
}

function inferProviderName(facility, worklistItem, host) {
  const websiteLabel = hostLabel(host);

  if (websiteLabel) {
    return websiteLabel;
  }

  const candidates = [
    facility.sourceInfo?.sourceName,
    worklistItem?.sourceInfo?.sourceName,
    facility.sourceDataset,
    facility.name
  ];

  for (const candidate of candidates) {
    const normalized = normalizeProviderName(candidate);

    if (normalized) {
      return titleCase(normalized);
    }
  }

  return "Unknown Provider";
}

function groupKeyFor(facility, worklistItem) {
  const websiteHost = normalizeHostname(facility.website ?? worklistItem?.website);
  const sourceName = facility.sourceInfo?.sourceName ?? worklistItem?.sourceInfo?.sourceName ?? "";
  const sourceDataset = facility.sourceDataset ?? worklistItem?.sourceInfo?.sourceDataset ?? "";
  const providerName = inferProviderName(facility, worklistItem, websiteHost);

  if (websiteHost) {
    return {
      key: `website:${websiteHost}`,
      providerName,
      websiteHost,
      sourceDataset,
      sourceName
    };
  }

  return {
    key: `source:${normalizeProviderName(providerName)}:${normalizeProviderName(sourceName)}:${normalizeProviderName(sourceDataset)}`,
    providerName,
    websiteHost,
    sourceDataset,
    sourceName
  };
}

function worklistItemsFrom(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.items) ? data.items : [];
}

function discoveryItemsFrom(data) {
  return Array.isArray(data?.items) ? data.items : [];
}

function reviewItemsFrom(data) {
  return Array.isArray(data?.items) ? data.items : [];
}

function increment(map, key, count = 1) {
  if (!hasText(key)) {
    return;
  }

  map.set(key, (map.get(key) ?? 0) + count);
}

function topEntries(map, limit = 5) {
  return [...map.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function missingFieldsFor(worklistItem) {
  return uniqueItems([
    ...(worklistItem?.missingAccessCategories ?? []),
    ...(worklistItem?.missingRawFields ?? []).map((item) => item.field),
    ...(worklistItem?.rawValuePresentButFieldSourcesMissingOrInvalid ?? []).map((item) =>
      typeof item === "string" ? item : item.field
    )
  ]).filter((field) => accessCategoryFields.includes(field));
}

function hasUsableOfficialWebsite(host) {
  return Boolean(host && !datasetWideHosts.has(host) && !bannedWebsiteHostPattern.test(host));
}

function discoverySignalsFor(items) {
  const foundLocationSpecific = items.some(
    (item) =>
      (item.selectedLocationSpecificPages ?? []).length > 0 ||
      (item.candidatePagesInspected ?? []).some(
        (candidate) => candidate.classification === "location_specific_source"
      )
  );
  const inspectedPages = items.flatMap((item) => item.candidatePagesInspected ?? []);
  const onlyDatasetWide =
    items.length > 0 &&
    !foundLocationSpecific &&
    inspectedPages.length > 0 &&
    inspectedPages.every((page) =>
      ["dataset_wide_source", "organization_wide_source"].includes(page.classification)
    );

  return {
    foundLocationSpecific,
    onlyOrganizationOrDatasetWide: onlyDatasetWide
  };
}

function priorityScore(group) {
  let score = group.hasUsableOfficialWebsite
    ? 70 + group.facilityCount * 6
    : Math.min(40, group.facilityCount);

  if (group.hasUsableOfficialWebsite) {
    score += 30;
  }

  if (group.previousDiscoveryFoundLocationSpecificPage) {
    score += 20;
  }

  if (group.previousDiscoveryOnlyFoundOrganizationOrDatasetWidePages) {
    score += 10;
  }

  score += Math.min(35, group.needsServicesCount * 3);
  score += Math.min(35, group.needsHoursCount * 3);
  score += Math.min(20, group.needsInsuranceCount * 2);
  score += Math.min(20, group.needsCostCount * 2);

  if (!group.websiteHost) {
    score -= 100;
  }

  if (datasetWideHosts.has(group.websiteHost)) {
    score -= 40;
  }

  return Math.max(0, Math.round(score));
}

export async function buildProviderEnrichmentOpportunities() {
  const [facilities, worklist, discoveryReport, reviewReport] = await Promise.all([
    readFacilities(facilitiesPath),
    readOptionalJson(worklistPath),
    readOptionalJson(discoveryReportPath),
    readOptionalJson(reviewReportPath)
  ]);
  const worklistById = new Map(worklistItemsFrom(worklist).map((item) => [item.id, item]));
  const discoveryById = new Map();
  const reviewById = new Map();

  for (const item of discoveryItemsFrom(discoveryReport)) {
    if (!item?.id) {
      continue;
    }

    const existing = discoveryById.get(item.id) ?? [];
    existing.push(item);
    discoveryById.set(item.id, existing);
  }

  for (const item of reviewItemsFrom(reviewReport)) {
    if (!item?.facilityId) {
      continue;
    }

    const existing = reviewById.get(item.facilityId) ?? [];
    existing.push(item);
    reviewById.set(item.facilityId, existing);
  }

  const groups = new Map();

  for (const facility of facilities) {
    const worklistItem = worklistById.get(facility.id);

    if (!worklistItem) {
      continue;
    }

    const groupKey = groupKeyFor(facility, worklistItem);
    const group =
      groups.get(groupKey.key) ??
      {
        key: groupKey.key,
        providerName: groupKey.providerName,
        websiteHost: groupKey.websiteHost,
        sourceName: groupKey.sourceName,
        sourceDataset: groupKey.sourceDataset,
        sourceUrls: new Set(),
        facilityCount: 0,
        facilityIds: [],
        sampleFacilities: [],
        counties: new Set(),
        cities: new Set(),
        states: new Set(),
        fieldsMissingAcrossGroup: new Set(),
        missingFieldCounts: Object.fromEntries(accessCategoryFields.map((field) => [field, 0])),
        discoveryItems: [],
        reviewReasonCounts: new Map()
      };

    group.facilityCount += 1;
    group.facilityIds.push(facility.id);

    if (group.sampleFacilities.length < 8) {
      group.sampleFacilities.push({
        id: facility.id,
        name: facility.name,
        city: facility.city ?? null,
        county: facility.county ?? null,
        state: facility.state ?? null
      });
    }

    for (const value of [facility.county, worklistItem.county]) {
      if (hasText(value)) {
        group.counties.add(value);
      }
    }

    for (const value of [facility.city, worklistItem.city]) {
      if (hasText(value)) {
        group.cities.add(value);
      }
    }

    for (const value of [facility.state, worklistItem.state]) {
      if (hasText(value)) {
        group.states.add(value);
      }
    }

    for (const value of [facility.website, facility.sourceInfo?.sourceUrl, worklistItem.sourceInfo?.sourceUrl]) {
      if (hasText(value)) {
        group.sourceUrls.add(value);
      }
    }

    for (const field of missingFieldsFor(worklistItem)) {
      group.fieldsMissingAcrossGroup.add(field);
      group.missingFieldCounts[field] += 1;
    }

    for (const item of discoveryById.get(facility.id) ?? []) {
      group.discoveryItems.push(item);
    }

    for (const item of reviewById.get(facility.id) ?? []) {
      increment(group.reviewReasonCounts, item.reasonBlocked ?? "unknown");
    }

    groups.set(groupKey.key, group);
  }

  const normalizedGroups = [...groups.values()].map((group) => {
    const discoverySignals = discoverySignalsFor(group.discoveryItems);
    const normalized = {
      key: group.key,
      providerName: group.providerName,
      websiteHost: group.websiteHost || null,
      sourceName: group.sourceName || null,
      sourceDataset: group.sourceDataset || null,
      facilityCount: group.facilityCount,
      facilityIds: group.facilityIds,
      sampleFacilities: group.sampleFacilities,
      sampleFacilityIds: group.sampleFacilities.map((facility) => facility.id),
      sampleFacilityNames: group.sampleFacilities.map((facility) => facility.name),
      countiesCovered: [...group.counties].sort(),
      citiesCovered: [...group.cities].sort(),
      statesCovered: [...group.states].sort(),
      fieldsMissingAcrossGroup: [...group.fieldsMissingAcrossGroup].sort(),
      needsServicesCount: group.missingFieldCounts.services,
      needsHoursCount: group.missingFieldCounts.hours,
      needsInsuranceCount: group.missingFieldCounts.insurance,
      needsCostCount: group.missingFieldCounts.cost,
      needsAccessibilityCount: group.missingFieldCounts.accessibility,
      missingFieldCounts: group.missingFieldCounts,
      hasUsableOfficialWebsite: hasUsableOfficialWebsite(group.websiteHost),
      previousDiscoveryFoundLocationSpecificPage: discoverySignals.foundLocationSpecific,
      previousDiscoveryOnlyFoundOrganizationOrDatasetWidePages:
        discoverySignals.onlyOrganizationOrDatasetWide,
      topBlockedReasonsFromReviewReport: topEntries(group.reviewReasonCounts),
      officialWebsiteOrSourceLinks: [...group.sourceUrls].sort().slice(0, 12)
    };

    return {
      ...normalized,
      priorityScore: priorityScore(normalized)
    };
  });

  normalizedGroups.sort(
    (first, second) =>
      second.priorityScore - first.priorityScore ||
      second.facilityCount - first.facilityCount ||
      first.providerName.localeCompare(second.providerName)
  );

  return {
    generatedAt: new Date().toISOString(),
    inputs: {
      facilities: path.relative(projectRoot, facilitiesPath).replaceAll("\\", "/"),
      worklist: worklist ? path.relative(projectRoot, worklistPath).replaceAll("\\", "/") : null,
      discoveryReport: discoveryReport
        ? path.relative(projectRoot, discoveryReportPath).replaceAll("\\", "/")
        : null,
      reviewReport: reviewReport
        ? path.relative(projectRoot, reviewReportPath).replaceAll("\\", "/")
        : null
    },
    summary: {
      totalFacilities: facilities.length,
      worklistFacilitiesGrouped: normalizedGroups.reduce(
        (total, group) => total + group.facilityCount,
        0
      ),
      providerGroupCount: normalizedGroups.length,
      groupsWithUsableOfficialWebsite: normalizedGroups.filter(
        (group) => group.hasUsableOfficialWebsite
      ).length,
      groupsWithPreviousLocationSpecificDiscovery: normalizedGroups.filter(
        (group) => group.previousDiscoveryFoundLocationSpecificPage
      ).length,
      topRecommendation:
        normalizedGroups[0]?.hasUsableOfficialWebsite === true
          ? "provider-level manual review"
          : "row-level evidence audit before provider-level review",
      note:
        "Read-only provider/domain opportunity audit. Production healthcare data is not mutated."
    },
    groups: normalizedGroups
  };
}

export function providerSlug(group, usedSlugs = new Set()) {
  const base = `${group.providerName}-${group.websiteHost ?? group.sourceDataset ?? group.sourceName ?? "provider"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "provider";
  let slug = base;
  let index = 2;

  while (usedSlugs.has(slug)) {
    slug = `${base.slice(0, 64)}-${index}`;
    index += 1;
  }

  usedSlugs.add(slug);
  return slug;
}
