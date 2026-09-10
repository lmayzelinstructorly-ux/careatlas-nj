import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildProviderEnrichmentOpportunities,
  providerOpportunityJsonPath,
  providerReviewPacketDirectory,
  providerSlug
} from "./lib/healthcareProviderEnrichmentOpportunities.mjs";
import {
  accessCategoryFields,
  dayKeys,
  facilitiesPath,
  hasText,
  readFacilities,
  sha256File,
  toProjectPath,
  writeCsv,
  writeJson
} from "./lib/healthcareAccessReporting.mjs";

const indexJsonPath = path.join(providerReviewPacketDirectory, "index.json");
const indexCsvPath = path.join(providerReviewPacketDirectory, "index.csv");
const reviewedTemplateDirectory = path.join(providerReviewPacketDirectory, "reviewed-template");

function emptyValueForField(field) {
  if (field === "services") {
    return [];
  }

  if (field === "hours") {
    return Object.fromEntries(["notes", ...dayKeys].map((key) => [key, ""]));
  }

  if (field === "insurance") {
    return {
      acceptsMedicaid: null,
      acceptsMedicare: null,
      acceptsUninsured: null,
      insuranceNotes: ""
    };
  }

  if (field === "cost") {
    return {
      acceptsSlidingScale: null,
      estimatedVisitCost: "",
      priceLevel: "unknown",
      priceNotes: ""
    };
  }

  if (field === "accessibility") {
    return "";
  }

  return null;
}

function enrichmentKey(field) {
  if (field === "insurance") {
    return "insuranceInfo";
  }

  if (field === "cost") {
    return "priceInfo";
  }

  if (field === "accessibility") {
    return "accessibilityInfo";
  }

  return field;
}

function fieldSourceTemplate(field) {
  return {
    checkedDate: "",
    field,
    locationSpecific: true,
    reviewerNote:
      "Human reviewer must confirm whether this source applies to this facility location before planning enrichment.",
    sourceLocationScope: "facility_location",
    sourceTitle: "",
    sourceType: "",
    sourceUrl: "",
    status: "source_backed"
  };
}

async function cleanGeneratedPacketFiles() {
  await mkdir(providerReviewPacketDirectory, { recursive: true });

  const entries = await readdir(providerReviewPacketDirectory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "reviewed") {
      continue;
    }

    await rm(path.join(providerReviewPacketDirectory, entry.name), {
      force: true,
      recursive: entry.isDirectory()
    });
  }
}

function templateRecord(facility, fields) {
  const fieldsNeedingRawValues = fields.filter((field) => {
    if (field === "hours") {
      return !facility.hours || !dayKeys.some((day) => hasText(facility.hours?.[day]));
    }

    if (field === "services") {
      return !Array.isArray(facility.services) || facility.services.length === 0;
    }

    if (field === "insurance") {
      return !facility.insuranceInfo || Object.keys(facility.insuranceInfo).length === 0;
    }

    if (field === "cost") {
      return !facility.priceInfo || facility.priceInfo.priceLevel === "unknown";
    }

    if (field === "accessibility") {
      return !hasText(facility.accessibilityInfo);
    }

    return true;
  });
  const enrichment = {};

  for (const field of fieldsNeedingRawValues) {
    enrichment[enrichmentKey(field)] = emptyValueForField(field);
  }

  return {
    id: facility.id,
    name: facility.name,
    providerReviewPacket: true,
    enrichment,
    fieldSources: Object.fromEntries(fields.map((field) => [field, fieldSourceTemplate(field)]))
  };
}

function reviewedFieldTemplate(field) {
  return {
    apply: false,
    value: emptyValueForField(field),
    evidence: ""
  };
}

function reviewedJsonTemplate(group) {
  return {
    _reviewInstructions:
      "Copy this file to tmp/provider-review-packets/reviewed/<provider-slug>.reviewed.json, then fill only source-backed fields. Do not use Google Maps, Yelp, reviews, ratings, random directories, weekly hours as daily hours, or facility type as services.",
    _allowedSourceTypes: [
      "official_facility_page",
      "health_system_location_page",
      "other_official"
    ],
    _allowedSourceApplicability: [
      "single_location",
      "all_listed_locations",
      "organization_wide_policy"
    ],
    _applicabilityRule:
      "organization_wide_policy may be used only for cost or insurance; all_listed_locations must list exact facilityIds and evidence saying why the source applies to those locations.",
    providerGroup: group.providerName,
    facilityIds: group.facilityIds,
    officialSourceLinks: group.officialWebsiteOrSourceLinks,
    reviewedBy: "",
    checkedDate: "",
    sourceUrl: "",
    sourceTitle: "",
    sourceType: "",
    sourceAppliesTo: "",
    fields: Object.fromEntries(accessCategoryFields.map((field) => [field, reviewedFieldTemplate(field)]))
  };
}

function renderList(values) {
  if (!values.length) {
    return "- None listed";
  }

  return values.map((value) => `- ${value}`).join("\n");
}

function renderFacilityList(facilities) {
  return facilities
    .map(
      (facility) =>
        `- ${facility.id}: ${facility.name} (${[facility.city, facility.county, facility.state]
          .filter(hasText)
          .join(", ")})`
    )
    .join("\n");
}

function renderPacket(group, facilities, templateFileName) {
  const blockedReasons = group.topBlockedReasonsFromReviewReport
    .map((item) => `- ${item.value}: ${item.count}`)
    .join("\n");

  return `# ${group.providerName} Provider Review Packet

Generated for CareAtlas manual healthcare enrichment review. This packet is read-only and does not apply enrichment.

## Provider/group
- Provider/group name: ${group.providerName}
- Website host: ${group.websiteHost ?? "Not available"}
- Source name: ${group.sourceName ?? "Not available"}
- Source dataset: ${group.sourceDataset ?? "Not available"}
- Facilities in group: ${group.facilityCount}
- Priority score: ${group.priorityScore}
- Enrichment template: ${templateFileName}

## Official Website/Source Links
${renderList(group.officialWebsiteOrSourceLinks)}

## Facilities
${renderFacilityList(facilities)}

## Missing Fields Summary
- Services needed: ${group.needsServicesCount}
- Hours needed: ${group.needsHoursCount}
- Insurance needed: ${group.needsInsuranceCount}
- Cost needed: ${group.needsCostCount}
- Accessibility needed: ${group.needsAccessibilityCount}
- Fields missing across group: ${group.fieldsMissingAcrossGroup.join(", ") || "None"}

## Prior Discovery/Review Signals
- Usable official website: ${group.hasUsableOfficialWebsite ? "yes" : "no"}
- Previous discovery found a location-specific page: ${
    group.previousDiscoveryFoundLocationSpecificPage ? "yes" : "no"
  }
- Previous discovery only found organization/dataset-wide pages: ${
    group.previousDiscoveryOnlyFoundOrganizationOrDatasetWidePages ? "yes" : "no"
  }

${blockedReasons ? `Top blocked reasons:\n${blockedReasons}` : "Top blocked reasons: None in prior review report."}

## Human Review Questions
- Are services listed for all locations or only some?
- Are daily hours listed per location?
- Is sliding fee / low-cost care stated?
- Is Medicaid/Medicare/uninsured access stated?
- Is accessibility stated?
- Does the source apply to all locations or only one location?

## Safe Source Rules
- Use official provider, health system, federal, state, local, regulated directory, approved nonprofit directory, or approved API sources.
- For current production enrichment, each field source must identify the facility location unless a future trust policy explicitly approves organization-level scope.
- Keep missing data unknown when the source does not state it.
- Do not convert weekly operating hours into daily schedules.
- Do not infer services, costs, insurance, accessibility, prices, hours or acceptance status from reviews or map listings.

## Banned Sources Reminder
- Do not use Google Maps, Google reviews, Yelp, patient comments, rating sites, copied directory reviews, social posts, or unsourced snippets.
- Do not use a provider-wide page for a location-specific field unless the page clearly says it applies to every location and the trust policy allows that scope.

## Blank Enrichment Template
Fill the sibling JSON template only after source-backed human review. The template is shaped for \`planHealthcareEnrichment.mjs\`; it is not applied by this packet generator.
`;
}

const indexCsvColumns = [
  { key: "priorityScore", header: "priorityScore" },
  { key: "providerName", header: "provider/group name" },
  { key: "websiteHost", header: "website host" },
  { key: "facilityCount", header: "facility count" },
  { key: "packetPath", header: "packet path" },
  { key: "templatePath", header: "template path" },
  { key: "reviewedTemplatePath", header: "reviewed template path" },
  {
    key: "fieldsMissingAcrossGroup",
    header: "fields missing",
    value: (row) => row.fieldsMissingAcrossGroup.join("; ")
  },
  { key: "needsServicesCount", header: "need services" },
  { key: "needsHoursCount", header: "need hours" },
  { key: "needsInsuranceCount", header: "need insurance" },
  { key: "needsCostCount", header: "need cost" },
  { key: "needsAccessibilityCount", header: "need accessibility" }
];

async function main() {
  const beforeHash = await sha256File(facilitiesPath);
  const [facilities, opportunities] = await Promise.all([
    readFacilities(facilitiesPath),
    buildProviderEnrichmentOpportunities()
  ]);
  const facilitiesById = new Map(facilities.map((facility) => [facility.id, facility]));
  const usedSlugs = new Set();
  const index = [];

  await cleanGeneratedPacketFiles();
  await mkdir(reviewedTemplateDirectory, { recursive: true });

  for (const group of opportunities.groups) {
    const slug = providerSlug(group, usedSlugs);
    const packetPath = path.join(providerReviewPacketDirectory, `${slug}.md`);
    const templatePath = path.join(
      providerReviewPacketDirectory,
      `${slug}.enrichment-template.json`
    );
    const reviewedTemplatePath = path.join(
      reviewedTemplateDirectory,
      `${slug}.reviewed.json`
    );
    const packetFacilities = group.facilityIds
      .map((id) => facilitiesById.get(id))
      .filter(Boolean);
    const fields = group.fieldsMissingAcrossGroup.filter((field) =>
      accessCategoryFields.includes(field)
    );
    const template = packetFacilities.map((facility) => templateRecord(facility, fields));
    const templateFileName = path.basename(templatePath);
    const packet = renderPacket(group, packetFacilities, templateFileName);

    await writeFile(packetPath, packet, "utf8");
    await writeFile(templatePath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
    await writeFile(
      reviewedTemplatePath,
      `${JSON.stringify(reviewedJsonTemplate(group), null, 2)}\n`,
      "utf8"
    );

    index.push({
      ...group,
      packetPath: toProjectPath(packetPath),
      templatePath: toProjectPath(templatePath),
      reviewedTemplatePath: toProjectPath(reviewedTemplatePath)
    });
  }

  const indexReport = {
    generatedAt: new Date().toISOString(),
    sourceOpportunityAudit: toProjectPath(providerOpportunityJsonPath),
    packetCount: index.length,
    note:
      "Read-only provider review packets. These files support human review and do not apply enrichment.",
    packets: index
  };

  await writeJson(indexJsonPath, indexReport);
  await writeCsv(indexCsvPath, index, indexCsvColumns);

  const afterHash = await sha256File(facilitiesPath);

  if (afterHash !== beforeHash) {
    throw new Error("public/data/healthcare/facilities.json was mutated.");
  }

  console.log("Healthcare provider review packets generated.");
  console.log(`Packets: ${index.length}`);
  console.log(`Index JSON: ${toProjectPath(indexJsonPath)}`);
  console.log(`Index CSV: ${toProjectPath(indexCsvPath)}`);
}

main().catch((error) => {
  console.error("Healthcare provider review packet generation failed.");
  console.error(error.message);
  process.exit(1);
});
