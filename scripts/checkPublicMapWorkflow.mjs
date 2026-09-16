import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

const [app, header, siteBrand, purposeDialog, methodologyGuide, mapPage, storyPage, map, facilityMarkers, autocomplete, autocompleteController, gapExplorer, gapExplorerHook, layerVisibility, boundaryNames, geographyBoundaries, countyOutline, tractContextBoundaries, layers, zoomWatcher, labels, selectedLabel, labelUtils, geometry, geographyColors, clipGeography, styles, countySource, townSource, selectedArea, tractGapContext, tractLayer, tractStyles, tractShard, countySummary, townContext, tractModeController, townTractOutline, countyTractOutline, tractMapKey, mapPermalink] = await Promise.all([
  read("src/App.tsx"),
  read("src/components/PublicHeader.tsx"),
  read("src/components/SiteBrand.tsx"),
  read("src/components/PurposeDialog.tsx"),
  read("src/components/MethodologyGuide.tsx"),
  read("src/pages/MapPage.tsx"),
  read("src/pages/ProjectStoryPage.tsx"),
  read("src/components/CareAtlasMap.tsx"),
  read("src/components/HealthcareFacilityMarkers.tsx"),
  read("src/components/map/BoundaryAutocomplete.tsx"),
  read("src/components/map/BoundaryAutocompleteController.tsx"),
  read("src/components/map/GapExplorer.tsx"),
  read("src/hooks/useGapExplorer.ts"),
  read("src/components/map/BoundaryLayerVisibilityController.tsx"),
  read("src/components/map/boundaryNames.ts"),
  read("src/components/map/GeographyBoundaries.tsx"),
  read("src/components/map/CountyOutlineLayer.tsx"),
  read("src/components/map/TractContextBoundaryLayer.tsx"),
  read("src/geographyLayers.ts"),
  read("src/components/map/ZoomLevelWatcher.tsx"),
  read("src/components/map/BoundaryLabels.tsx"),
  read("src/components/map/SelectedBoundaryLabel.tsx"),
  read("src/components/map/boundaryLabelUtils.ts"),
  read("src/components/map/geometry.ts"),
  read("src/utils/geographyColors.ts"),
  read("src/utils/clipGeography.ts"),
  read("src/styles.css"),
  read("public/data/counties/by-state/34.geojson"),
  read("public/data/cousubs/by-state/34.geojson"),
  read("src/components/map/SelectedAreaCard.tsx"),
  read("src/components/map/TractGapContext.tsx"),
  read("src/components/map/TractClassificationLayer.tsx"),
  read("src/utils/tractClassification.ts"),
  read("src/hooks/useTractClassificationShard.ts"),
  read("src/hooks/useCountyGapSummary.ts"),
  read("src/hooks/useTownGapContext.ts"),
  read("src/components/map/TractModeController.tsx"),
  read("src/components/map/TownTractOutlineLayer.tsx"),
  read("src/components/map/CountyTractOutlineLayer.tsx"),
  read("src/components/map/TractMapKey.tsx"),
  read("src/components/map/mapPermalink.ts")
]);
const tooltipBindingIndex = geographyBoundaries.indexOf(
  "boundaryLayer.bindTooltip(featureName"
);
const boundaryEventBindingIndex = geographyBoundaries.indexOf("layer.on({");
const [townFlaggedTractList, townFlaggedTracts] = await Promise.all([
  read("src/components/map/TownFlaggedTractList.tsx"),
  read("src/hooks/useTownFlaggedTracts.ts")
]);
const [facilityContacts, facilityContactUtils, facilityKey, addressFinder, addressLocation, initialMapFitter, mapReset, tractResultExplanation, server, njGeocoder, geminiExplanation, doctorOfficeMode] = await Promise.all([
  read("src/components/HealthcareFacilityContactLinks.tsx"),
  read("src/utils/healthcareFacilityContact.ts"),
  read("src/components/HealthcareFacilityKey.tsx"),
  read("src/components/map/AddressTractFinder.tsx"),
  read("src/components/map/AddressTractLocation.tsx"),
  read("src/components/map/InitialMapFitter.tsx"),
  read("src/components/map/mapReset.ts"),
  read("src/components/map/TractResultExplanation.tsx"),
  read("server/index.mjs"),
  read("server/njGeocoder.mjs"),
  read("server/geminiExplanation.mjs"),
  read("src/components/DoctorOfficeMode.tsx")
]);

assert(app.includes('path="/"') && app.includes("<MapPage />"), "The New Jersey map must remain the public root.");
assert(app.includes('path="/story"') && app.includes("<ProjectStoryPage />"), "The public build story route is missing.");
assert(app.includes("<PurposeDialog />") && purposeDialog.includes("welcomeSessionKey") && purposeDialog.includes("parseMapPermalink") && purposeDialog.includes("independent student-built public-health project") && purposeDialog.includes("See project decisions") && purposeDialog.includes('to="/story"'), "The welcome must introduce purpose and limits while allowing shared links and returning sessions to open directly.");
for (const removedRoute of ["/map", "/methodology", "/about", "/disease-map", "/student-opportunities"]) {
  assert(!app.includes(`path="${removedRoute}"`), `Removed route ${removedRoute} is registered.`);
}
assert(header.includes("SiteBrand") && header.includes('to="/story"') && header.includes("Build story") && siteBrand.includes("CareAtlas NJ") && siteBrand.includes("Transparent New Jersey healthcare access mapping"), "The header must use the distinctive CareAtlas NJ identity and subtitle, then link to its build story.");
assert(storyPage.includes("An independent student-built public-data project") && storyPage.includes("Where might getting primary care be harder?") && storyPage.includes("Four terms make the map easier to understand") && storyPage.includes("What is the doctor-office pilot?") && storyPage.includes("The next milestone is outside validation") && storyPage.includes("Independent project; not a government service") && storyPage.includes("Contact the project") && !storyPage.includes("github.com/lmayzelinstructorly-ux/CareAtlas"), "The build story must explain the project and doctor-office pilot in plain language, retain its limitations and offer a contact path without publishing a source-code link.");
assert(storyPage.includes("How I built CareAtlas NJ") && storyPage.includes('new URL("/story"') && storyPage.includes('meta[name="description"]'), "The build story must publish route-specific title, description and canonical metadata.");
for (const inventedClaim of ["partnered with", "award-winning", "users served", "adopted by", "featured by"]) {
  assert(!storyPage.toLowerCase().includes(inventedClaim), `The build story contains an unsupported claim: ${inventedClaim}.`);
}
assert(header.includes("How gaps are found") && header.includes("MethodologyGuide"), "The public map must expose the methodology guide without adding a separate route.");
assert(header.includes("Hospitals &amp; community health centers") && header.includes("Doctor offices") && header.includes("Potential gaps") && header.includes("aria-pressed"), "The header must expose three accessible, mutually exclusive map modes.");
assert(methodologyGuide.includes("Facility pins alone never prove a healthcare access gap") && methodologyGuide.includes("The three-part evidence structure") && methodologyGuide.includes("What stays contextual") && !methodologyGuide.includes("methodology-assistant"), "The methodology guide must statically explain the published rule, context evidence and claim limits.");
assert(!header.includes("Data &amp; evidence") && !header.includes("Download report") && !header.includes("<nav"), "Public header controls returned during the boundary-only phase.");
assert(mapPage.includes("<CareAtlasMap mapMode={mapMode} />") && mapPage.includes("h-screen"), "The public page must be a full-height map workspace with an explicit map mode.");
assert(mapPage.includes('parameters.get("mode") === "gaps"') && mapPage.includes("hasSelectedArea") && mapPage.includes('url.searchParams.set("mode", "gaps")'), "New and legacy county, town and tract links must restore potential-gap mode without storing an address.");

for (const removedRuntime of [
  "MapWorkspaceSidebar",
  "MapWorkspaceCanvas",
  "MapEvidencePanel",
  "MapSearchBar",
  "useHealthcareFacilities",
  "useHealthcareCoverageSummary",
  "useTractPublicRecord"
]) {
  assert(!mapPage.includes(removedRuntime), `${removedRuntime} must stay out of the public map page.`);
}

assert(map.includes('useGeographyData("counties", newJerseyCountyDataUrl)') && map.includes('useGeographyData("towns", newJerseyTownDataUrl)'), "New Jersey county and town shards must preload directly.");
assert(map.includes('/data/counties/by-state/34.geojson') && map.includes('/data/cousubs/by-state/34.geojson'), "The map must use only the New Jersey boundary shards.");
assert(map.includes("newJerseyMaxBounds") && map.includes("maxBoundsViscosity={1}"), "Map navigation must remain locked to New Jersey.");
assert(map.includes("scrollWheelZoom={true}") && map.includes("wheelDebounceTime={30}") && map.includes("zoomSnap={0.5}"), "Native debounced Leaflet zoom must remain enabled.");
assert(!map.includes("CustomWheelZoom"), "The laggy custom fractional wheel zoom returned.");
assert(map.includes("zoomAnimation={false}"), "Map zoom must remain immediate instead of animating expensive geography layers.");
assert(map.includes("CountyOutlineLayer") && map.includes("BoundaryLabels"), "County outlines and county/town labels must remain visible.");
assert(map.includes('style={{ pointerEvents: "none", zIndex: 425 }}'), "The county-outline pane must stay below the interactive town layer and ignore pointer events.");
assert(map.includes('name="boundary-labels"') && map.includes('style={{ pointerEvents: "none", zIndex: 455 }}') && map.includes('name="healthcare-markers"') && labels.includes('pane="boundary-labels"') && selectedLabel.includes('pane="boundary-labels"'), "Boundary labels must stay in a non-interactive pane below healthcare markers so text cannot overlap facility symbols.");
assert(map.includes('currentGeographyLevel="counties"') && map.includes('currentGeographyLevel="towns"') && map.includes("BoundaryLayerVisibilityController"), "County and town boundary layers must stay cached and switch visibility without rebuilding all polygons.");
assert(layerVisibility.includes('showingTowns || tractMode ? "none" : "block"') && layerVisibility.includes('showingTowns && !tractMode ? "block" : "none"') && layerVisibility.includes("requestAnimationFrame"), "Cached county and town panes must switch visibility and pointer behavior on the next frame, including the optional tract mode.");
assert(map.includes("handleZoomGeographyLevelChange") && map.includes("setSelectedGeography(null)") && map.includes("selectedGeography?.level === activeBoundaryLevel"), "Changing boundary levels must clear and hide a selection from the previous level.");
assert(map.includes("isAutocompleteNavigating || !permalinkHydrated") && map.includes("onNavigationComplete={handleAutocompleteNavigationComplete}"), "Search and permalink navigation must suppress stale zoom-level events until the selected boundary move finishes.");
assert(tooltipBindingIndex >= 0 && tooltipBindingIndex < boundaryEventBindingIndex, "Boundary tooltips must bind during feature-layer creation, before hover events fire.");
assert(geographyBoundaries.includes('import { svg } from "leaflet"') && geographyBoundaries.includes("svg({ padding: 0.5, pane: paneName })"), "Interactive county and town boundaries must use native SVG path hit targets.");
assert(geographyBoundaries.includes("svg({ padding: 0.5, pane: paneName })") && geographyBoundaries.includes("layer.closeTooltip()"), "Cached boundary renderers must stay in their dedicated panes and close inactive hover labels.");
assert(countyOutline.includes('pane: "boundary-outlines"'), "County outlines must render in the intended non-interactive pane.");
assert(map.includes("SelectedAreaCard") && map.includes("SelectedBoundaryLabel") && map.includes("onGeographySelect={setSelectedGeography}"), "Clicking a county or town must display its selected territory name.");
assert(map.includes("useTractClassificationShard") && map.includes("activeTractCounty") && map.includes('setCurrentGeographyLevel("tracts")') && tractShard.includes("if (!enabled || !countyFips"), "A selected county must load only its tract shard after the user explicitly opens gap areas.");
assert(map.includes("TractClassificationLayer") && map.includes("tractGeography") && map.includes('mapMode === "healthcare"') && map.includes('mapMode === "doctor_offices"') && map.includes('mapMode === "gaps"'), "Tract classifications, doctor offices and facility markers must render in separate explicit modes.");
assert(map.includes("AddressTractFinder") && map.includes("AddressTractLocation") && map.includes("isPointInFeature"), "Gap mode must connect the address finder to the official tract geometry used on the map.");
assert(addressFinder.includes('"/api/address/suggest"') && addressFinder.includes('"/api/address/geocode"') && addressFinder.includes("NJ Office of GIS") && addressFinder.includes("not saved by CareAtlas"), "The address finder must use same-origin suggestions/geocoding with visible source and privacy copy.");
assert(addressFinder.includes("Type at least two characters") && addressFinder.includes("A Census tract is a small area") && map.includes("!pendingAddressMatch && <SelectedAreaCard") && map.includes("navigationOverrideActive"), "Address search must explain its input and show one settled tract result instead of flashing interim cards and map moves.");
assert(!addressFinder.includes("Clear address and return to normal map") && addressFinder.includes("careAtlasMapResetEvent") && mapReset.includes('"careatlas:reset-map"') && initialMapFitter.includes('position: "bottomright"') && initialMapFitter.includes("Reset map") && initialMapFitter.includes("map.stop()") && initialMapFitter.includes("onReset()") && map.includes("hadAddressContext && tractMode") && map.includes("handleTractGeographySelect"), "The bottom-right reset control must directly reset React state, stop map motion, clear address and selection state, while normal tract selection still releases an address pin.");
assert(map.includes("handleMapReset") && map.includes("setAutocompleteRequest(null)") && map.includes("setIsAutocompleteNavigating(false)") && map.includes("setFacilityPanelOpen(false)") && map.includes("setMapResetVersion") && map.includes("setPermalinkHydrated(true)") && map.includes('handleZoomGeographyLevelChange("counties")'), "Reset must cancel pending boundary/permalink navigation, close panel coordination and restore county state through a direct React callback.");
assert(tractModeController.includes("careAtlasMapResetEvent") && tractModeController.includes("previousAreaRef.current = null") && tractModeController.includes("map.stop()"), "Reset must discard the retained tract-summary area so it cannot zoom back after the New Jersey fit.");
assert(autocomplete.includes("careAtlasMapResetEvent") && autocomplete.includes('setQuery("")') && autocomplete.includes("setIsFocused(false)"), "Reset must clear the county and town search control.");
assert(gapExplorer.includes("careAtlasMapResetEvent") && gapExplorer.includes("setIsOpen(false)") && gapExplorer.includes("setSelectedCountyFips(null)"), "Reset must close and clear the potential-gap explorer.");
assert(facilityMarkers.includes("careAtlasMapResetEvent") && facilityMarkers.includes("setSelectedGroup(null)") && facilityMarkers.includes("setIsMapFocusActive(false)") && facilityMarkers.includes("setHighlightedFacilityIds([])") && map.includes("healthcare-markers-${mapResetVersion}"), "Reset must close healthcare details, remove focused or highlighted marker state and remount the marker layer so a show-all county focus cannot survive.");
assert(doctorOfficeMode.includes("careAtlasMapResetEvent") && doctorOfficeMode.includes("setSpecialtyId(null)"), "Reset must return doctor-office mode to its marker-free specialty gate.");
assert(addressLocation.includes('pane="address-location"') && addressLocation.includes("Matched address location"), "A matched address must receive a distinct, labeled map location marker.");
assert(server.includes('"/api/address/suggest"') && server.includes('"/api/address/geocode"') && server.includes("readJsonBody") && server.includes('consumeApiQuota(request, "address", 120)'), "The server must expose bounded, rate-limited address lookup endpoints.");
assert(njGeocoder.includes("geo.nj.gov/arcgis/rest/services/Tasks/NJ_Geocode/GeocodeServer") && njGeocoder.includes("isNewJerseySuggestion") && njGeocoder.includes("isInNewJerseyBounds") && njGeocoder.includes("entry.score >= 85"), "Address lookup must use the official New Jersey geocoder and reject weak or out-of-state results.");
assert(!addressFinder.includes("localStorage") && !server.includes("body?.address"), "CareAtlas must not persist or log a resident's address.");
assert(map.includes("TractModeController") && tractModeController.includes("map.fitBounds") && tractModeController.includes('area?.level === "towns"') && tractModeController.includes("? 11.5") && tractModeController.includes(": 10.5") && tractModeController.includes("? 10") && tractModeController.includes(": 8.75"), "Opening and closing gap tracts must preserve an appropriate town or county zoom.");
assert(selectedArea.includes("View gap areas") && selectedArea.includes("Potential gap areas") && selectedArea.includes("Why") && selectedArea.includes("Data related to the gap"), "County gap summaries must use a short progressive-disclosure structure.");
assert(selectedArea.includes("Potential gap tract areas") && selectedArea.includes("primary-assigned") && selectedArea.includes("intersecting") && selectedArea.includes("does not label the entire town"), "Town selections must show conservative tract screening context without classifying the town.");
assert(selectedArea.includes("View gap tracts") && selectedArea.includes("Close gap tracts") && selectedArea.includes("hasGapTracts || tractMode") && selectedArea.includes('backLabel={activeTractTown ? "town" : "county"}'), "Town summaries must offer a tract view only when a gap tract exists, retain a close action, and return tract records to the correct summary.");
assert(selectedArea.includes("TownFlaggedTractList") && selectedArea.includes("townContext.tractGeoids") && selectedArea.includes("onSelectFlaggedTract"), "The town brief must connect its validated town-foundation GEOIDs to the desktop flagged-tract list and selection action.");
assert(townFlaggedTractList.includes("Flagged tract areas in this town") && townFlaggedTractList.includes("<details") && townFlaggedTractList.includes("GEOID {tract.geoid}") && townFlaggedTractList.includes("Open tract brief"), "The flagged town-tract list must stay collapsed and available on phones and desktops while showing an official identifier and direct tract action.");
assert(townFlaggedTracts.includes("loadCountyTractPublicRecords") && townFlaggedTracts.includes('record?.screening.state === "potential_access_gap"') && townFlaggedTracts.includes("findings?.documentedShortage === true") && townFlaggedTracts.includes("getPotentialGapReason") && townFlaggedTracts.includes("documented primary-care shortage"), "Town tract rows must join to validated potential-gap public records and show one conservative screening reason.");
assert(!townFlaggedTractList.toLowerCase().includes("score") && !townFlaggedTractList.toLowerCase().includes("ranking"), "The town tract list must not add scores or rankings.");
assert(selectedArea.includes("None of these tract areas met both parts of the screening rule") && selectedArea.includes("or prove that access is adequate"), "A zero-gap town must explain the zero result without describing nonexistent flagged tracts or claiming access is adequate.");
assert(selectedArea.includes("Explain town data limitations") && selectedArea.includes("No census tract is primarily assigned to this town") && selectedArea.includes("Some related census tracts cross town boundaries") && selectedArea.includes("See how town context is calculated"), "Town data limitations must stay behind a flag, with technical assignment details behind an optional disclosure.");
assert(selectedArea.includes("See full evidence and sources") && selectedArea.includes("DataQualityFlag") && selectedArea.includes("Missing values were kept unknown") && tractResultExplanation.includes("left the result unknown instead of guessing"), "Tract details must keep scientific evidence behind disclosure and explain missing data without guessing.");
assert(selectedArea.includes("TractResultExplanation") && tractResultExplanation.includes("Why this was flagged") && tractResultExplanation.includes("both parts of its") && tractResultExplanation.includes("Need or barriers:") && tractResultExplanation.includes("Shortage evidence:") && tractResultExplanation.includes("planning signal"), "Potential-gap cards must explain both rule parts first in plain language and preserve careful claim limits.");
assert(tractResultExplanation.includes('fetch("/api/ai/status"') && tractResultExplanation.includes('fetch("/api/ai/explain"') && tractResultExplanation.includes("JSON.stringify({ geoid: record.geography.geoid })") && tractResultExplanation.includes("no searched address or free-form prompt") && tractResultExplanation.includes("cannot change the"), "The optional Gemini UI must send only a public tract GEOID and remain subordinate to the deterministic result.");
assert(server.includes('"/api/ai/status"') && server.includes('"/api/ai/explain"') && server.includes('consumeApiQuota(request, "gemini", 20)') && server.includes("loadTractPublicRecord(body?.geoid)"), "The server must gate, rate-limit and server-load public data for the optional Gemini route.");
assert(geminiExplanation.includes("store: false") && geminiExplanation.includes('responseMimeType: "application/json"') && geminiExplanation.includes("responseJsonSchema") && geminiExplanation.includes('"x-goog-api-key": apiKey') && geminiExplanation.includes("Never change or second-guess the screening state") && !geminiExplanation.includes("VITE_"), "Gemini must use server-only credentials, non-stored structured output and a fixed safety instruction.");
assert(selectedArea.includes("GapDriverContext") && tractGapContext.includes("Explore factors that may shape access") && tractGapContext.includes("do not diagnose a cause") && tractGapContext.includes("record.gapDrivers"), "Tract details must expose contextual gap drivers without causal or scoring claims.");
assert(selectedArea.includes("ActionPaths") && tractGapContext.includes("Explore official action paths") && tractGapContext.includes("not personalized recommendations or guaranteed solutions") && tractGapContext.includes("record.actionPaths"), "Tract details must expose progressive, source-backed action paths without promising solutions.");
assert(selectedArea.includes("Local access context for selected") && selectedArea.includes("Copy link") && selectedArea.includes("Print brief") && selectedArea.includes("Raw data files") && selectedArea.includes("Technical details") && !selectedArea.includes("Download public data"), "Selected areas must expose a concise shareable brief while keeping raw-data downloads behind technical disclosures.");
assert(selectedArea.includes("navigator.clipboard") && selectedArea.includes("window.print()") && selectedArea.includes("Download this {label} JSON") && selectedArea.includes("It does not classify the town"), "Brief actions must copy a stable link, print cleanly and preserve conservative town semantics in tucked-away raw data.");
assert(selectedArea.includes("allowPrint &&") && selectedArea.includes("tractRecord.record !== null") && selectedArea.includes("townContext.record !== null") && selectedArea.includes("counts !== null"), "Print brief must be available for loaded tract, town and county records regardless of their screening result.");
assert(map.includes("parseMapPermalink") && map.includes("replaceMapPermalink") && map.includes("initialPermalink") && map.includes("getFeatureByGeoid"), "The map must restore and maintain selected county, town or tract URL state.");
assert(map.includes("isAutocompleteNavigating || !permalinkHydrated") && map.includes("<InitialMapFitter enabled={initialPermalink === null} onReset={handleMapReset} />") && zoomWatcher.includes('currentGeographyLevelRef.current === "tracts"') && !zoomWatcher.includes('currentGeographyLevelRef.current === "tracts" && zoom >= 9'), "Tract permalink restoration and explicit tract mode must not be cleared or reframed by startup and zoom-level fit behavior.");
assert(map.includes("pendingTownTractGeoid") && map.includes("townTractContext.tractGeoids.includes") && map.includes('classification?.state === "potential_access_gap"') && map.includes("onSelectFlaggedTract={openFlaggedTownTract}") && tractLayer.includes("layer.bringToFront()"), "A town list item must reuse the validated tract selection, foreground highlight, brief and permalink state flow.");
assert(mapPermalink.includes('params.get("tract")') && mapPermalink.includes('params.get("town")') && mapPermalink.includes('params.get("county")') && mapPermalink.includes("history.replaceState"), "Permalinks must use validated GEOID query parameters and replace only the current map URL state.");
assert(styles.includes("@media print") && styles.includes(".hb-local-brief-print-surface > :not(.hb-gap-sidebar)") && styles.includes(".hb-gap-sidebar > :not(.hb-local-brief)") && styles.includes(".hb-local-brief__actions"), "Printing a local context brief must remove map chrome and show the full selected card.");
assert(selectedArea.includes("Nearby source-backed care") && selectedArea.includes("Nearest known safety-net center") && selectedArea.includes("within 5 miles") && selectedArea.includes("within 10 miles") && selectedArea.includes("HealthcareFacilityContactLinks"), "Potential-gap tract cards must connect the result to compact nearby source-backed care contact and directions actions.");
assert(selectedArea.includes("Explain nearby facility limitations") && selectedArea.includes("not road or") && selectedArea.includes("does not change the tract") && map.includes("facilities={newJerseyFacilities}"), "Nearby facility context must disclose proximity limitations and reuse the loaded New Jersey production records.");
assert(selectedArea.includes("overflow-x-hidden") && selectedArea.includes("basis-full") && selectedArea.includes("flex flex-wrap"), "Flag explanations must expand within the card without creating horizontal scrolling.");
assert(countySummary.includes("access-gap-rule-v1-summary.json") && countySummary.includes("stateCountsByCounty"), "County summaries must come from the generated versioned gap-rule artifact.");
assert(townContext.includes("town-foundation/by-county") && townContext.includes("artifact.towns.find") && townContext.includes("countyRequests"), "Town context must load its generated county shard on demand and select the official town GEOID.");
assert(townContext.includes('tract.screeningState === "potential_access_gap"') && townContext.includes("tract.primaryTown.geoid === townGeoid") && townContext.includes("tract.overlaps.some") && map.includes("townTractContext.tractGeoids") && map.includes("visibleGeoids.has"), "The town tract view must contain only flagged potential-gap tracts, using primary assignments or the intersecting fallback described by the card.");
assert(map.includes("activeTractTown") && map.includes("TownTractOutlineLayer") && map.includes("TractContextBoundaryLayer") && map.includes("tractContextTowns") && map.includes('name="tract-context-boundaries"') && map.includes("tractGeography={activeTractTown ? clippedTownTracts : null}") && map.includes("String(feature.properties?.GEOID ?? \"\") === activeTractTown.geoid"), "Town tract mode must show the selected town's clipped tract grid and validated potential-gap overlay over muted geographic context.");
assert(clipGeography.includes("intersection(") && clipGeography.includes("clipGeographyToBoundary") && clipGeography.includes("clipGeographyToCountyBoundaries") && clipGeography.includes("excludeWaterOnly") && map.includes("clipGeographyToCountyBoundaries(towns.data, counties.data)") && map.includes("clipGeographyToBoundary(") && map.includes("excludeWaterOnly: true"), "Town and tract display geometry must be intersected with its displayed parent boundary, with water-only tracts omitted.");
assert(tractContextBoundaries.includes("countyGeography") && tractContextBoundaries.includes("townGeography") && tractContextBoundaries.includes("tractGeography") && tractContextBoundaries.includes('fillColor: "#E1E7EA"') && tractContextBoundaries.includes('fillColor: "#F7FAFB"') && tractContextBoundaries.includes("color: tractBoundaryColor") && tractStyles.includes('tractBoundaryColor = "#3D7F88"') && tractStyles.includes('"#6F2E58"') && !tractContextBoundaries.includes("getGeographyFeatureColors"), "The focused tract view must visually separate muted surroundings, the selected area's light tract grid and potential-gap emphasis.");
assert(map.includes("CountyTractOutlineLayer") && map.includes("activeTractCounty?.feature") && map.includes("activeTractTown ?? activeTractCounty") && countyTractOutline.includes('pane="town-tract-outline"') && countyTractOutline.includes("careAtlasColors.deepNavy") && countyTractOutline.includes("weight: 3.2") && selectedArea.includes("unchanged boundary") && selectedArea.includes("clipped to that exact outline"), "Gap mode must preserve and label the selected county's exact outline while explaining that tract display geometry stops at it.");
assert(map.includes("TractMapKey") && tractMapKey.includes("What the shapes mean") && tractMapKey.includes("Tract drawing stops at the selected outline") && tractMapKey.includes("full official census tract"), "Tract mode must provide an always-visible key that distinguishes the selected boundary, clipped tract grid and potential-gap areas without changing record meaning.");
assert(townTractOutline.includes('pane="town-tract-outline"') && townTractOutline.includes('color: "#3F4B52"') && townTractOutline.includes("fillOpacity: 0") && !townTractOutline.includes("fillColor") && !townTractOutline.includes("dashArray"), "The selected town must use one neutral solid outline without a colored wash or stacked border.");
assert(tractLayer.includes("hb-tract-missing-flag-icon") && tractLayer.includes("missing required data") && tractLayer.includes("<Popup>"), "Insufficient-evidence tracts must show a clickable map flag with a concise explanation.");
assert(tractLayer.includes("iconAnchor: [5, 21]") && tractLayer.includes("iconSize: [20, 24]") && tractLayer.includes("hb-tract-missing-flag-icon__anchor") && styles.includes(".hb-tract-missing-flag-icon__anchor"), "Missing-data flags must plant their visible base on the tract interior point.");
assert(tractLayer.includes("<Tooltip") && tractLayer.includes("Missing required data in this tract") && tractLayer.includes("mouseout:") && tractLayer.includes("mouseover:"), "Missing-data flags must name and highlight their owning tract on hover.");
assert(tractLayer.includes("getFeatureInteriorPoint") && tractLayer.includes("isPointInFeature") && tractLayer.includes("internalPointIsVisible") && geometry.includes("findInteriorLabelPoint") && geometry.includes("getPolygonInteriorPoint"), "Tract flags and selected centers must remain inside clipped visible geometry instead of using an offshore or cross-boundary point.");
assert(map.includes("useHealthcareFacilities(") && map.includes('mapMode !== "doctor_offices"') && map.includes('"new-jersey"') && map.includes("HealthcareFacilityMarkers") && map.includes('name="healthcare-markers"'), "The public map must intent-load and render the New Jersey production healthcare marker layer without fetching it in doctor-office mode.");
assert(map.includes('facility.stateFips === "34"') && map.includes('facility.state.toUpperCase() === "NJ"'), "The public facility layer must remain limited to New Jersey records.");
assert(facilityMarkers.includes("isPointInFeature") && facilityMarkers.includes("getFeatureLabelPoint") && facilityMarkers.includes("getCountyGroups"), "County facility counts must use official county geometry and an interior county point.");
assert(facilityMarkers.includes("getLocalGroups") && facilityMarkers.includes("map.project") && facilityMarkers.includes("map.getMaxZoom()"), "Facility markers must split into progressively smaller local clusters through maximum zoom.");
assert(facilityMarkers.includes("HealthcareFacilityContactLinks") && facilityMarkers.includes("sortedFacilities.map"), "Every facility panel must list its locations with shared contact and directions actions.");
assert(facilityContacts.includes("getFacilityPhoneDisplay") && facilityContacts.includes("ext. {phoneDisplay.extension}") && facilityContacts.includes("Facility website") && facilityContacts.includes("Website not listed") && facilityContacts.includes("Google Maps") && facilityContacts.includes("Apple Maps"), "Every facility contact block must show readable phone extensions, available website details and both map providers without inventing missing websites.");
assert(facilityContactUtils.includes("getFacilityPhoneDisplay") && facilityContactUtils.includes("extension: extensionMatch?.[1] ?? null"), "Raw phone extension shorthand must be converted into a separate plain-language display value.");
assert(facilityContactUtils.includes("https://www.google.com/maps/dir/?api=1") && facilityContactUtils.includes("https://maps.apple.com/?daddr=") && facilityContactUtils.includes("getFacilityAddressLabel"), "Facility directions must use keyless Google and Apple map links built from validated coordinates or the source-backed address.");
assert(facilityMarkers.includes("hb-healthcare-facility-panel") && facilityMarkers.includes('top-[4.25rem]') && facilityMarkers.includes("setSelectedGroup") && !facilityMarkers.includes("<Popup"), "Opening a healthcare group must use a fully visible fixed panel without moving the map.");
assert(facilityMarkers.includes("onPanelOpenChange") && facilityMarkers.includes("panelOpen") && map.includes("setFacilityPanelOpen"), "The gap explorer and healthcare details panel must not overlap.");
assert(facilityMarkers.includes("groupingRadius") && facilityMarkers.includes("distanceTo") && facilityMarkers.includes("map.project"), "Nearby facility coordinates must remain grouped whenever separate marker symbols would overlap.");
assert(facilityMarkers.includes("hb-healthcare-marker-pin__body") && facilityMarkers.includes("getHealthcareFacilityPresentation") && !facilityMarkers.includes("hb-healthcare-marker-cross"), "Individual facility pins must use type-specific symbols rather than a generic medical cross.");
assert(map.includes("HealthcareFacilityKey") && facilityKey.includes("not every physician office") && facilityKey.includes("What is a community health center?") && facilityKey.includes("HRSA Health Center Program") && facilityKey.includes("adjust fees based on income and family size") && facilityKey.includes("presentation.markerClassName"), "The public map must define the current facility scope, explain HRSA community health centers and visibly distinguish facility types.");
assert(storyPage.includes("HRSA Health Center Program") && storyPage.includes("serve everyone, even if they cannot pay") && storyPage.includes("adjust fees based on income and family size"), "The build story must explain what defines an HRSA community health center.");
assert(facilityMarkers.includes("Show exact pin") && facilityMarkers.includes("showExactFacilityPin") && facilityMarkers.includes("map.getMaxZoom()"), "Every facility row must offer a direct jump to its exact highlighted pin.");
assert(facilityMarkers.includes("showAllGroupFacilitiesOnMap") && facilityMarkers.includes("map.fitBounds") && facilityMarkers.includes('? "Fit" : "Show"} all') && facilityMarkers.includes("setSelectedGroup(group)"), "Showing a cluster on the map must retain its facility list and fit every listed location into view.");
assert(facilityMarkers.includes("mapFocusFacilityNumberById") && facilityMarkers.includes("getNumberedMarkerIcon") && facilityMarkers.includes("match the numbered facility list below") && facilityMarkers.includes("Show exact pin"), "Focused facility lists and map pins must share stable visible numbers while retaining exact-pin navigation.");
assert(map.includes('name="address-location"') && facilityMarkers.includes("boundaryFeature") && facilityMarkers.includes("dimmedCountyData") && facilityMarkers.includes('pane="address-location"') && facilityMarkers.includes("is outlined on the map") && styles.includes("hb-healthcare-marker-icon--dimmed"), "A focused county group must retain its official boundary context and fade unrelated map areas and healthcare markers.");
assert(facilityMarkers.includes("const dimmedCountyStyle") && facilityMarkers.includes("const focusedCountyStyle") && facilityMarkers.includes("setHighlightedFacilityIds([])") && !styles.includes("filter: saturate") && !facilityMarkers.includes("zoomend: () => setViewport"), "County-focus zooming must avoid repeated path restyling, simultaneous group-pin pulses, per-marker color filters and duplicate end-of-zoom regrouping.");
assert(facilityMarkers.includes("highlightedFacilityIds") && facilityMarkers.includes("hb-healthcare-cluster-icon--highlighted") && facilityMarkers.includes("hb-healthcare-marker-icon--highlighted"), "Focused healthcare facilities must retain a visible highlight state.");
assert(map.includes("BoundaryAutocomplete") && map.includes("BoundaryAutocompleteController"), "The public map must include New Jersey county and town autocomplete.");
const gapSidebar = await read("src/components/map/GapSidebar.tsx");
assert(map.includes("GapSidebar") && map.includes("onSelect={handleAutocompleteSelect}") && gapSidebar.includes("GapExplorer") && gapSidebar.includes("Choose another place"), "Gap discovery must reuse boundary-aware navigation within the shared resident sidebar.");
assert(gapExplorer.includes("Explore potential gaps") && gapExplorer.includes("Search counties") && gapExplorer.includes("Search towns") && gapExplorer.includes("Open county summary") && gapExplorer.includes("Back to all counties"), "The gap explorer must provide a compact county-to-town discovery flow with search and direct navigation.");
assert(gapExplorer.includes("listed alphabetically") && gapExplorer.includes("not scores or rankings") && gapExplorer.includes("Town counts can overlap") && gapExplorer.includes("data-quality explanation"), "The explorer must avoid rankings and explain overlapping town context without overwhelming the default map.");
assert(gapExplorerHook.includes("access-gap-rule-v1-summary.json") && gapExplorerHook.includes("town-foundation/summary.json") && gapExplorerHook.includes("townShardRequests") && gapExplorerHook.includes("potentialGapTractCount > 0"), "The explorer must load versioned county counts and only fetch a selected county's positive-gap town shard.");
assert(autocomplete.includes("rankPlaceMatch") && autocomplete.includes("maximumSuggestions = 16") && autocomplete.includes('placeholder="Search a county or town..."'), "Boundary autocomplete must use ranked matching with a bounded result list; behavior is covered by search regression tests.");
assert(map.includes("setCurrentGeographyLevel(candidate.level)"), "Autocomplete selection must switch to the matching boundary layer before zooming.");
assert(autocompleteController.includes("requestAnimationFrame") && autocompleteController.includes("request.candidate.level === \"towns\"") && autocompleteController.includes("map.fitBounds(bounds") && autocompleteController.includes("map.getBoundsZoom(bounds") && autocompleteController.includes("centerDistance > 2500") && autocompleteController.includes("animate: false"), "Every autocomplete result must use boundary-aware navigation and enforce the final center and zoom after a layer switch.");
assert(!autocompleteController.includes("map.closeTooltip()"), "Autocomplete navigation must not call Leaflet closeTooltip without a tooltip instance and abort the map move.");
assert(!autocompleteController.includes("Edison") && !autocompleteController.includes("Pemberton"), "Autocomplete navigation must not contain territory-specific behavior.");
assert(boundaryNames.includes('"21": "Borough"') && boundaryNames.includes('"44": "Township"') && autocomplete.includes("suggestion.typeLabel"), "Local search results must distinguish and capitalize legal municipality types.");
assert(layers.includes('label: "Towns and townships"') && zoomWatcher.includes("getGeographyLevelForZoom") && zoomWatcher.includes("requestAnimationFrame") && zoomWatcher.includes("suppressGeographyLevelUpdatesRef.current") && zoomWatcher.includes("window.cancelAnimationFrame(updateFrameRef.current)") && !zoomWatcher.includes("140"), "County-to-town zoom hierarchy must update without the old transition delay or a stale update overriding search.");
assert(layers.includes("maxZoom: 9.25") && layers.includes("minZoom: 9.5"), "Counties must remain active through zoom 9.25 before towns take over at zoom 9.5.");
assert(styles.includes(".hb-boundary-label--counties") && styles.includes(".hb-boundary-label--towns"), "County and town label styles are missing.");
assert(styles.includes(".hb-healthcare-marker-pin") && styles.includes(".hb-healthcare-marker-symbol") && styles.includes(".hb-healthcare-key-symbol") && styles.includes("hb-healthcare-highlight-pulse"), "Type-specific marker, key and descendant-highlight styles are missing.");
assert(labels.includes("moveend: scheduleLabelRefresh") && labels.includes("zoomend: scheduleLabelRefresh") && labels.includes("resize: scheduleLabelRefresh") && labels.includes("window.requestAnimationFrame") && labels.includes("window.cancelAnimationFrame") && !labels.includes("window.setTimeout") && !labels.includes("isMapMoving"), "Labels must remain visible through map movement and refresh on the next frame without a timer delay.");
assert(labels.includes("featureLabelPointCache") && labels.includes("getFeatureBounds") && labels.includes("bounds.maxLatitude < south"), "Town labels must cache interior points and avoid calculating offscreen label positions.");
assert(labels.includes("selectedFeatureColorKey") && labels.includes("!shouldShowLabels || selectedFeatureColorKey"), "A selected territory must remain the only emphasized map label.");
assert(labels.includes("visibleBounds.contains") && labels.includes("canDisplayAllBoundaryLabels") && labels.includes("? candidates") && labels.includes(": []"), "The active level must render every visible label together only after the complete layout fits.");
assert(labelUtils.includes('document.createElement("canvas").getContext("2d")') && labelUtils.includes("isBoxInsideViewport") && labelUtils.includes("doLabelBoxesOverlap") && labelUtils.includes("return false") && !labelUtils.includes(".slice("), "Labels must use measured text, clipping and collision checks as one all-or-none layout gate, never a filtered subset.");
assert(geometry.includes("findInteriorLabelPoint") && geometry.includes("getPolygonBoundaryClearance") && geometry.includes("isPointInPolygon(centroid.latitude, centroid.longitude, polygon)"), "Boundary labels must use an actual interior point when an outer-ring centroid falls inside a municipal hole or outside a concave territory.");
assert(geographyColors.includes('townBoundaryFill = "#E4EFEE"') && geographyColors.includes('fillOpacity: level === "towns" ? 1') && countyOutline.includes("townCoverageGeography") && countyOutline.includes("color: townBoundaryFill") && countyOutline.includes("weight: 4") && countyOutline.includes("fillOpacity: 0") && map.includes("townCoverageGeography={displayTowns}"), "Town mode must use one neutral fill over a narrow matching underpaint so independent cartographic seams do not look like unclaimed land or fill unsubdivided county water.");

for (const removedMapFeature of [
  "HealthcareFacilityZoomController",
  "BoundarySearchController",
  "MapLayerControlPanel",
  "MapLegend",
  "MapLevelIndicator"
]) {
  assert(!map.includes(removedMapFeature), `${removedMapFeature} must stay out of the focused public map.`);
}
assert(!map.includes("RoadBasemapLayer") && !map.includes("TileLayer") && map.includes('roadMode="off"'), "Road tiles or road controls returned.");

const counties = JSON.parse(countySource);
const towns = JSON.parse(townSource);
const countyFipsValues = [
  ...new Set(
    counties.features.map((feature) => String(feature.properties?.COUNTYFP ?? ""))
  )
].sort();
const phase4CountyShards = await Promise.all(
  countyFipsValues.map(async (countyFips) => {
    const [townArtifact, tractRecords] = await Promise.all([
      read(`public/data/tracts/nj/town-foundation/by-county/${countyFips}.json`),
      read(`public/data/tracts/nj/public-records/tracts/by-county/${countyFips}.json`)
    ]);
    return {
      townArtifact: JSON.parse(townArtifact),
      tractRecords: JSON.parse(tractRecords)
    };
  })
);
let qualifyingTownCount = 0;
let townTractAssociationCount = 0;
for (const { townArtifact, tractRecords } of phase4CountyShards) {
  const recordsByGeoid = new Map(
    tractRecords.map((record) => [record.geography.geoid, record])
  );
  for (const town of townArtifact.towns) {
    const usesPrimaryAssignment = town.dataQuality.hasPrimaryAssignedTracts;
    const associatedTracts = townArtifact.tracts.filter(
      (tract) =>
        tract.screeningState === "potential_access_gap" &&
        (usesPrimaryAssignment
          ? tract.primaryTown.geoid === town.geography.geoid
          : tract.overlaps.some(
              (overlap) => overlap.townGeoid === town.geography.geoid
            ))
    );
    const expectedCount = usesPrimaryAssignment
      ? town.tractContext.screeningStateCountsForPrimaryAssignedTracts
          .potential_access_gap
      : town.tractContext.screeningStateCountsForIntersectingTracts
          .potential_access_gap;
    assert.equal(
      associatedTracts.length,
      expectedCount,
      `Town ${town.geography.geoid} flagged-tract association count drifted.`
    );
    if (associatedTracts.length > 0) qualifyingTownCount += 1;
    townTractAssociationCount += associatedTracts.length;
    for (const tract of associatedTracts) {
      const record = recordsByGeoid.get(tract.geography.geoid);
      assert.equal(
        record?.screening.state,
        "potential_access_gap",
        `Town ${town.geography.geoid} references an unvalidated flagged tract record.`
      );
      assert(
        record.screening.findings.documentedShortage === true &&
          (record.screening.findings.elevatedCommunityHealthNeed === true ||
            record.screening.findings.elevatedSocialBarriers === true),
        `Tract ${tract.geography.geoid} cannot supply the conservative Phase 4 reason.`
      );
    }
  }
}
assert(qualifyingTownCount > 0 && townTractAssociationCount > 0, "Phase 4 found no qualifying town-to-tract associations.");
assert.equal(counties.features.length, 21, "New Jersey county shard must contain 21 counties.");
assert.equal(towns.features.length, 564, "New Jersey town/township shard must contain 564 county subdivisions.");
assert(counties.features.every((feature) => String(feature.properties?.STATEFP) === "34"), "County shard contains a feature outside New Jersey.");
assert(towns.features.every((feature) => String(feature.properties?.STATEFP) === "34"), "Town shard contains a feature outside New Jersey.");
assert(towns.features.every((feature) => String(feature.properties?.NAME ?? "").trim()), "Every New Jersey local boundary must have a searchable name.");
for (const county of counties.features) {
  const countyFips = String(county.properties?.COUNTYFP ?? "");
  const countyLandArea = Number(county.properties?.ALAND);
  const townLandArea = towns.features
    .filter((town) => String(town.properties?.COUNTYFP ?? "") === countyFips)
    .reduce((sum, town) => sum + Number(town.properties?.ALAND ?? 0), 0);
  assert.equal(
    townLandArea,
    countyLandArea,
    `Published town land-area totals do not fully cover county ${countyFips}.`
  );
}
const pembertonTypes = towns.features
  .filter((feature) => String(feature.properties?.NAME).toLowerCase() === "pemberton")
  .map((feature) => String(feature.properties?.LSAD))
  .sort();
assert.deepEqual(pembertonTypes, ["21", "44"], "Pemberton search results must preserve its distinct borough and township boundaries.");

console.log(`Public map workflow check passed: the app renders New Jersey counties, 564 towns/townships, progressive healthcare clusters and ${townTractAssociationCount} validated flagged-tract links across ${qualifyingTownCount} town briefs.`);
