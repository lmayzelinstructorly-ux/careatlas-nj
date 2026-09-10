import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

const [readme, checklist, testingDoc, workflow, app, header, mapPage, storyPage, map] = await Promise.all([
  read("README.md"),
  read("docs/demo-readiness-checklist.md"),
  read("docs/testing.md"),
  read("docs/public-map-workflow.md"),
  read("src/App.tsx"),
  read("src/components/PublicHeader.tsx"),
  read("src/pages/MapPage.tsx"),
  read("src/pages/ProjectStoryPage.tsx"),
  read("src/components/CareAtlasMap.tsx")
]);

await Promise.all([
  access(path.join(root, "public/data/counties/by-state/34.geojson")),
  access(path.join(root, "public/data/cousubs/by-state/34.geojson")),
  access(path.join(root, "public/data/healthcare/facilities.json")),
  access(path.join(root, "docs/access-gap-data-contract.md")),
  access(path.join(root, "docs/testing.md"))
]);

assert(readme.includes("docs/demo-readiness-checklist.md"), "README demo readiness link is missing.");
assert(readme.includes("21") && readme.includes("564 towns/townships") && readme.includes("healthcare facility locations"), "README focused New Jersey map scope is missing.");
assert(app.includes('path="/"'), "The public map root is missing.");
assert(app.includes('path="/story"') && header.includes('to="/story"'), "The public project story must be registered and linked from the map.");
assert(storyPage.includes("2,181") && storyPage.includes("564") && storyPage.includes("215") && storyPage.includes("Independent project; not a government service"), "The project story must use validated scope numbers and state its independence.");
assert(
  app.includes("import.meta.env.DEV") &&
    app.includes('path="/internal-data"') &&
    app.includes("InternalDataReviewPage ?"),
  "The internal review route must remain development-only."
);
assert(
  readme.includes("development-only review route") &&
    readme.includes("excluded from production builds") &&
    checklist.includes("development-only review route") &&
    checklist.includes("excluded from production builds"),
  "The internal review route's production exclusion must be documented."
);
for (const removedRoute of ["/map", "/methodology", "/about", "/disease-map", "/student-opportunities"]) {
  assert(!app.includes(`path="${removedRoute}"`), `Removed route ${removedRoute} must not be registered.`);
  assert(!header.includes(removedRoute), `Removed route ${removedRoute} must not be in the header.`);
}

for (const requiredCopy of [
  "Open `/`.",
  "21 counties",
  "564 official towns/townships",
  "county outline remains visible",
  "Source-backed New Jersey facility markers progressively cluster by zoom",
  "Google Maps and Apple Maps directions links",
  "Tracts and evidence load only after an explicit county or town gap-view",
  "shareable GEOID URLs",
  "does not classify the whole town",
  "Search for a New Jersey county, town or township",
  "npm run check",
  "npm run dev"
]) {
  assert(checklist.includes(requiredCopy), `Demo checklist must include ${JSON.stringify(requiredCopy)}.`);
}
assert(workflow.includes("source-backed healthcare facility map") && workflow.includes("Native Leaflet wheel zoom"), "Public workflow does not describe the focused New Jersey map.");
assert(testingDoc.includes("county healthcare counts split") && testingDoc.includes("wheel zoom") && testingDoc.includes("responsive"), "Testing docs do not cover the facility clustering UI.");
assert(mapPage.includes("<CareAtlasMap mapMode={mapMode} />") && !mapPage.includes("MapEvidencePanel"), "Public page is not map-only.");
assert(map.includes("scrollWheelZoom={true}") && map.includes("HealthcareFacilityMarkers") && !map.includes("MapLegend"), "Map interaction, facility markers or overlay removal is incomplete.");

console.log("Demo readiness check passed: the public product is documented and guarded as a focused New Jersey map with progressive, shareable local context briefs.");
