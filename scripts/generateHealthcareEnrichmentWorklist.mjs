import path from "node:path";
import {
  accessCategoryFields,
  facilitiesPath,
  getFieldSourceIssues,
  hasRawValue,
  hasValidFieldSource,
  readFacilities,
  tmpDirectory,
  toProjectPath,
  writeJson
} from "./lib/healthcareAccessReporting.mjs";

const outputPath = path.join(tmpDirectory, "healthcare-enrichment-worklist.json");

function buildItem(facility) {
  const missingRawFields = accessCategoryFields
    .filter((field) => !hasRawValue(facility, field))
    .map((field) => ({ field, rawField: field }));
  const rawValuePresentButFieldSourcesMissingOrInvalid = accessCategoryFields
    .filter((field) => hasRawValue(facility, field) && !hasValidFieldSource(facility, field))
    .map((field) => ({ field, fieldSourceIssues: getFieldSourceIssues(facility, field) }));
  const missingAccessCategories = [
    ...missingRawFields.map((item) => item.field),
    ...rawValuePresentButFieldSourcesMissingOrInvalid.map((item) => item.field)
  ];

  return {
    ...facility,
    missingAccessCategories: [...new Set(missingAccessCategories)],
    missingRawFields,
    priorityTier: facility.website || facility.sourceInfo?.sourceUrl ? "Tier 1" : "Tier 2",
    rawValuePresentButFieldSourcesMissingOrInvalid
  };
}

const facilities = await readFacilities(facilitiesPath);
const items = facilities
  .map(buildItem)
  .filter((item) => item.missingAccessCategories.length > 0)
  .sort((a, b) => a.priorityTier.localeCompare(b.priorityTier) || a.name.localeCompare(b.name));

await writeJson(outputPath, {
  generatedAt: new Date().toISOString(),
  inputPath: toProjectPath(facilitiesPath),
  itemCount: items.length,
  method: "missing_source_backed_facility_fields",
  items
});

console.log(`Healthcare enrichment worklist generated for ${items.length} records.`);
console.log(`JSON: ${toProjectPath(outputPath)}`);
