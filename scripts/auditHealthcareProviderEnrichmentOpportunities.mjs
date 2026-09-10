import {
  buildProviderEnrichmentOpportunities,
  providerOpportunityCsvPath,
  providerOpportunityJsonPath
} from "./lib/healthcareProviderEnrichmentOpportunities.mjs";
import {
  buildCsv,
  facilitiesPath,
  sha256File,
  toProjectPath,
  writeCsv,
  writeJson
} from "./lib/healthcareAccessReporting.mjs";

const csvColumns = [
  { key: "priorityScore", header: "priorityScore" },
  { key: "providerName", header: "provider/group name" },
  { key: "websiteHost", header: "website host" },
  { key: "sourceName", header: "source name" },
  { key: "sourceDataset", header: "source dataset" },
  { key: "facilityCount", header: "facility count" },
  {
    key: "sampleFacilityIds",
    header: "sample facility IDs",
    value: (row) => row.sampleFacilityIds.join("; ")
  },
  {
    key: "sampleFacilityNames",
    header: "sample facility names",
    value: (row) => row.sampleFacilityNames.join("; ")
  },
  {
    key: "countiesCovered",
    header: "counties covered",
    value: (row) => row.countiesCovered.slice(0, 20).join("; ")
  },
  {
    key: "citiesCovered",
    header: "cities covered",
    value: (row) => row.citiesCovered.slice(0, 20).join("; ")
  },
  {
    key: "fieldsMissingAcrossGroup",
    header: "fields missing across group",
    value: (row) => row.fieldsMissingAcrossGroup.join("; ")
  },
  { key: "needsServicesCount", header: "need services" },
  { key: "needsHoursCount", header: "need hours" },
  { key: "needsInsuranceCount", header: "need insurance" },
  { key: "needsCostCount", header: "need cost" },
  { key: "needsAccessibilityCount", header: "need accessibility" },
  { key: "hasUsableOfficialWebsite", header: "has usable official website" },
  {
    key: "previousDiscoveryFoundLocationSpecificPage",
    header: "previous discovery found location page"
  },
  {
    key: "previousDiscoveryOnlyFoundOrganizationOrDatasetWidePages",
    header: "previous discovery only org/dataset pages"
  },
  {
    key: "topBlockedReasonsFromReviewReport",
    header: "top blocked reasons",
    value: (row) =>
      row.topBlockedReasonsFromReviewReport
        .map((item) => `${item.value} (${item.count})`)
        .join("; ")
  },
  {
    key: "officialWebsiteOrSourceLinks",
    header: "official website/source links",
    value: (row) => row.officialWebsiteOrSourceLinks.join("; ")
  }
];

async function main() {
  const beforeHash = await sha256File(facilitiesPath);
  const report = await buildProviderEnrichmentOpportunities();

  await writeJson(providerOpportunityJsonPath, report);
  await writeCsv(providerOpportunityCsvPath, report.groups, csvColumns);

  const afterHash = await sha256File(facilitiesPath);

  if (afterHash !== beforeHash) {
    throw new Error("public/data/healthcare/facilities.json was mutated.");
  }

  console.log("Healthcare provider enrichment opportunity audit complete.");
  console.log(`Provider groups: ${report.summary.providerGroupCount}`);
  console.log(
    `Groups with usable official websites: ${report.summary.groupsWithUsableOfficialWebsite}`
  );
  console.log(`Top recommendation: ${report.summary.topRecommendation}`);
  console.log(`JSON: ${toProjectPath(providerOpportunityJsonPath)}`);
  console.log(`CSV: ${toProjectPath(providerOpportunityCsvPath)}`);
}

main().catch((error) => {
  console.error("Healthcare provider enrichment opportunity audit failed.");
  console.error(error.message);
  process.exit(1);
});
