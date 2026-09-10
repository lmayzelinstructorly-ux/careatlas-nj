import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

const [mapPage, map, selectedArea, facilityContacts, tractLayer, tractStyles, mapLegend, styles, tractShard, tractRecord, allowlist, report, manifestSource] = await Promise.all([
  read("src/pages/MapPage.tsx"),
  read("src/components/CareAtlasMap.tsx"),
  read("src/components/map/SelectedAreaCard.tsx"),
  read("src/components/HealthcareFacilityContactLinks.tsx"),
  read("src/components/map/TractClassificationLayer.tsx"),
  read("src/utils/tractClassification.ts"),
  read("src/components/map/MapLegend.tsx"),
  read("src/styles.css"),
  read("src/hooks/useTractClassificationShard.ts"),
  read("src/hooks/useTractPublicRecord.ts"),
  read("scripts/productionDataAllowlist.mjs"),
  read("public/data/tracts/nj/public-records/reports/new-jersey-access-gap-report.md"),
  read("public/data/tracts/nj/public-records/download-manifest.json")
]);
const manifest = JSON.parse(manifestSource);

assert.equal(manifest.tractCount, 2181, "Retained Batch 8 manifest tract count drifted.");
assert.equal(manifest.countyCount, 21, "Retained Batch 8 manifest county count drifted.");
assert(manifest.tractRecords.counties.every((county) => county.jsonUrl.endsWith(".json") && county.csvUrl.endsWith(".csv")), "Retained manifest lacks tract JSON/CSV shards.");
assert(allowlist.includes("public-records") && allowlist.includes("new-jersey-access-gap-report.md"), "Retained Batch 8 records are missing from the production allowlist.");

for (const label of ["Potential access gap", "Elevated need without documented shortage", "No current gap flag", "Insufficient evidence"]) {
  assert.match(report, new RegExp(label, "i"), `Statewide report lacks ${label}.`);
}
assert.match(report, /medical advice/i, "Statewide report lost its non-medical limitation.");
assert.match(report, /No current gap flag does not prove adequate access/i, "Statewide report lost the no-current-flag limitation.");

const activePublicRuntime = `${mapPage}\n${map}\n${selectedArea}\n${tractLayer}\n${tractShard}\n${tractRecord}`;
for (const activeFeature of [
  "useTractClassificationShard",
  "useTractPublicRecord",
  "TractClassificationLayer",
  "access-gap-rule-v1/by-county",
  "public-records/tracts/by-county"
]) {
  assert(activePublicRuntime.includes(activeFeature), `${activeFeature} must remain connected to the optional public tract workflow.`);
}
assert(selectedArea.includes("See full evidence and sources") && selectedArea.includes("DataQualityFlag"), "The public tract workflow must use plain-language defaults with optional evidence and missing-data explanations.");
assert(selectedArea.includes("Nearby source-backed care") && selectedArea.includes("getTractFacilityProximity") && selectedArea.includes("HealthcareFacilityContactLinks") && facilityContacts.includes("Google Maps") && facilityContacts.includes("Apple Maps") && selectedArea.includes('record.screening.state === "potential_access_gap"'), "Potential-gap tract cards must show reproducible nearby safety-net contact and directions context without adding it to non-gap states.");
assert(tractLayer.includes('svg({ padding: 0.5, pane: "tract-classifications" })'), "The tract classification renderer must stay in its foreground pane so neutral context cannot cover potential-gap fills.");
assert(tractStyles.includes('state === "potential_access_gap"') && tractStyles.includes('fillColor: isPotentialGap ? "#A0467A" : "#F7FAFB"'), "Only potential-gap tracts may receive a category color; every other tract must share one neutral fill.");
assert(tractStyles.includes('tractBoundaryColor = "#3D7F88"') && tractStyles.includes(": tractBoundaryColor"), "Tract borders must use a dedicated color instead of blending into town and county context.");
assert(!tractStyles.includes("dashArray"), "Tract screening states must use consistent solid boundaries instead of dotted or dashed lines.");
assert(mapLegend.includes("Other tract areas") && mapLegend.includes("Missing required data") && styles.includes(".hb-tract-state-swatch--neutral"), "The tract key must explain the focused gap color, neutral tracts and missing-data flags.");

console.log("Batch 8 public-layer check passed: validated records remain reproducible and power the optional county-to-tract gap workflow.");
