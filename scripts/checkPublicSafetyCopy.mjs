import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

const [app, header, mapPage, storyPage, map, facilityMarkers, facilityContacts, doctorOfficeControls, doctorOfficeMarkers, tractGapContext, tractResultExplanation, geminiExplanation, statewideReport, ruleSource, summarySource] = await Promise.all([
  read("src/App.tsx"),
  read("src/components/PublicHeader.tsx"),
  read("src/pages/MapPage.tsx"),
  read("src/pages/ProjectStoryPage.tsx"),
  read("src/components/CareAtlasMap.tsx"),
  read("src/components/HealthcareFacilityMarkers.tsx"),
  read("src/components/HealthcareFacilityContactLinks.tsx"),
  read("src/components/DoctorOfficeControls.tsx"),
  read("src/components/DoctorOfficeMarkers.tsx"),
  read("src/components/map/TractGapContext.tsx"),
  read("src/components/map/TractResultExplanation.tsx"),
  read("server/geminiExplanation.mjs"),
  read("public/data/tracts/nj/public-records/reports/new-jersey-access-gap-report.md"),
  read("public/data/tracts/nj/access-gap-rule.v1.json"),
  read("public/data/tracts/nj/access-gap-rule-v1-summary.json")
]);

assert(app.includes('path="/"') && app.includes('path="/story"') && !app.includes('path="/methodology"'), "Public routing must remain one map plus its non-clinical project story.");
assert(!header.includes("Data &amp; evidence") && !header.includes("Download report"), "Evidence and download actions must stay out of the focused public header.");
assert(!mapPage.includes("TractEvidencePanel") && !map.includes("TractEvidencePanel"), "Tract evidence UI must stay disconnected from the public map.");
assert(map.includes("HealthcareFacilityMarkers") && facilityMarkers.includes("HealthcareFacilityContactLinks") && facilityContacts.includes("Google Maps") && facilityContacts.includes("Apple Maps"), "The public map must expose source-backed facility names, contact details and directions choices.");
assert(!facilityMarkers.toLowerCase().includes("best facility") && !facilityMarkers.toLowerCase().includes("quality score"), "Facility marker copy must not rank facilities or imply medical quality.");
assert(doctorOfficeControls.includes("Listings come from CMS and may be incomplete") && doctorOfficeControls.includes("Appointment") && doctorOfficeControls.includes("absence from that report does not prove current practice") && doctorOfficeControls.includes("never affect potential-gap classifications"), "Doctor-office controls must disclose incomplete coverage, unknown availability, NPPES status limits and gap separation.");
assert(doctorOfficeMarkers.includes("This CMS-based pilot is incomplete") && doctorOfficeMarkers.includes("does not confirm") && doctorOfficeMarkers.includes("NPPES deactivation report was checked") && !doctorOfficeMarkers.toLowerCase().includes("best doctor"), "Doctor-office details must retain source-limited, status-limited, non-ranking language.");
assert(tractGapContext.includes("not personalized recommendations or guaranteed solutions") && tractGapContext.includes("do not diagnose a cause"), "Gap drivers and action paths must retain non-causal, non-advisory framing.");
assert(tractResultExplanation.includes("planning signal") && tractResultExplanation.includes("not proof that healthcare is absent") && tractResultExplanation.includes("not prove healthcare access is adequate") && tractResultExplanation.includes("left the result unknown instead of guessing"), "Plain-language tract explanations must preserve non-medical and evidence-limited framing for every result state.");
assert(tractResultExplanation.includes("AI-generated wording") && tractResultExplanation.includes("Verify it against the rule data and sources") && geminiExplanation.includes("never add facts, numbers, causes, diagnoses, medical advice, rankings, or care recommendations"), "The optional Gemini explanation must be visibly labeled, verifiable and tightly constrained against public-health overclaims.");
assert(storyPage.includes("not a government service") && storyPage.includes("No patient data, diagnoses or facility rankings") && storyPage.includes("without pretending that a map can diagnose") && storyPage.includes("The next milestone is outside validation"), "The project story must retain independence, privacy, medical-claim and outside-validation limits.");

const rule = JSON.parse(ruleSource);
const summary = JSON.parse(summarySource);
assert.equal(rule.ruleVersion, "1.0.0", "Archived access-gap rule version drifted.");
assert.equal(summary.tractCount, 2181, "Archived statewide tract count drifted.");
for (const state of ["Potential access gap", "Elevated need without documented shortage", "No current gap flag", "Insufficient evidence"]) {
  assert.match(statewideReport, new RegExp(state, "i"), `Archived statewide report is missing ${state}.`);
}
assert.match(statewideReport, /medical advice/i, "Archived statewide report lost its safety framing.");

console.log("Public safety copy check passed: facility markers remain location context while the retained versioned report preserves its source and non-medical framing.");
