import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const [
  header,
  mapPage,
  map,
  mode,
  controls,
  markers,
  hook,
  discovery,
  story,
  contract,
  artifactSource,
  accessGapRule,
  tractClassification
] = await Promise.all([
  read("src/components/PublicHeader.tsx"),
  read("src/pages/MapPage.tsx"),
  read("src/components/CareAtlasMap.tsx"),
  read("src/components/DoctorOfficeMode.tsx"),
  read("src/components/DoctorOfficeControls.tsx"),
  read("src/components/DoctorOfficeMarkers.tsx"),
  read("src/hooks/useDoctorOffices.ts"),
  read("src/utils/doctorOfficeDiscovery.ts"),
  read("src/pages/ProjectStoryPage.tsx"),
  read("docs/doctor-office-data-contract.md"),
  read("public/data/doctor-offices/nj.json"),
  read("scripts/lib/accessGapRuleV1.mjs"),
  read("src/utils/tractClassification.ts")
]);
const artifact = JSON.parse(artifactSource);

assert(
  header.includes("Doctor offices") &&
    header.includes('mapMode === "doctor_offices"') &&
    header.includes('onMapModeChange("doctor_offices")'),
  "The public header must expose a separate doctor-office mode."
);
assert(
  mapPage.includes('requestedMode === "doctor-offices"') &&
    mapPage.includes('url.searchParams.set("mode", "doctor-offices")'),
  "Doctor-office mode must round-trip through a dedicated URL parameter."
);
assert(
  map.includes("DoctorOfficeMode") &&
    map.includes('name="doctor-office-markers"'),
  "Doctor-office markers must be isolated in their own pane and gated by a specialty selection."
);
assert(
  mode.includes("DoctorOfficeControls") &&
    mode.includes("DoctorOfficeMarkers") &&
    mode.includes("specialtyId && doctorOffices.data"),
  "Doctor-office mode must own its specialty gate, data request and marker layer."
);
assert(
  controls.includes("New Jersey pilot") &&
    controls.includes("Find a doctor's office") &&
    controls.includes("Select a specialty") &&
    controls.includes("Search by ZIP, town or name") &&
    controls.includes("Listings come from CMS and may be incomplete") &&
    controls.includes("View all results below") &&
    controls.includes("View {matchingOfficeCount.toLocaleString()} result") &&
    controls.includes("never affect potential-gap classifications"),
  "The specialty control must provide plain-language search guidance, disclose incomplete coverage and preserve gap separation."
);
assert(
  markers.includes("getCountyGroups") &&
    markers.includes("getLocalGroups") &&
    markers.includes("setSelectedGroup(group)") &&
    markers.includes("focusedMarkerIcon") &&
    markers.includes("Find care") &&
    markers.includes("Get directions") &&
    markers.includes("formatPhoneNumber") &&
    markers.includes("provider.normalizedSpecialtyIds.includes") &&
    markers.includes("About this listing") &&
    markers.includes('aria-modal="true"') &&
    markers.includes('event.key === "Escape"') &&
    markers.includes("onDoubleClick") &&
    markers.includes("onPointerDown") &&
    !markers.includes("map.fitBounds") &&
    !markers.includes("map.setView"),
  "Doctor-office marker counts must open care-first accessible details without programmatic zoom, while retaining exact pins, specialty-filtered providers and record provenance."
);
assert(
  discovery.includes("filterDoctorOffices") &&
    discovery.includes("office.city") &&
    discovery.includes("office.postalCode") &&
    discovery.includes("office.practiceNames") &&
    discovery.includes("provider.displayName") &&
    discovery.includes("provider.groupNames") &&
    discovery.includes("getDoctorOfficeFreshness"),
  "Doctor-office discovery must support provider, practice, city and ZIP search plus deterministic freshness rules."
);
assert(
  map.includes('mapMode !== "doctor_offices"') &&
    story.includes("Explore doctor-office pilot") &&
    story.includes("What is the doctor-office pilot?"),
  "The doctor-office pilot must be explained in the public story and must not preload the unrelated healthcare-facility data shard."
);
assert(
  !markers.toLowerCase().includes("quality score") &&
    !markers.toLowerCase().includes("accepting patients") &&
    !markers.toLowerCase().includes("best doctor"),
  "Doctor-office UI must not rank clinicians or invent availability."
);
assert(
  hook.includes('"/data/doctor-offices/nj.json"') &&
    hook.includes("if (!enabled)") &&
    hook.includes("requestDoctorOffices()"),
  "Doctor-office data must load only for its explicit mode from the allowlisted artifact."
);
for (const classificationSource of [accessGapRule, tractClassification]) {
  assert(
    !/doctor[-_ ]?office/i.test(classificationSource),
    "Doctor-office data must remain absent from every access-gap classification path."
  );
}
assert(
  contract.includes("NPI-Ind_enrl_ID-Org_PAC_ID-adrs_id") &&
    contract.includes("12-month") &&
    contract.includes("claims lookback") &&
    contract.includes("active NPI") &&
    contract.includes("full CMS `adrs_id`") &&
    contract.includes("never create, remove") &&
    contract.includes("Records may be") &&
    contract.includes("promoted only when"),
  "The data contract must cover source scope, status, grouping, gap separation and the promotion gate."
);
assert.equal(artifact.publicationStatus, "validated_pilot");
assert.equal(artifact.coverage.isComplete, false);
assert(artifact.offices.length > 0);
assert.equal(artifact.offices.length, artifact.coverage.officeCount);
assert.deepEqual(
  artifact.specialties.map(({ id }) => id),
  ["pediatrics", "dermatology", "oncology"]
);

console.log(
  `Doctor-office layer check passed: the third mode starts marker-free, then exposes ${artifact.coverage.officeCount.toLocaleString()} source-backed office groups only after specialty selection.`
);
