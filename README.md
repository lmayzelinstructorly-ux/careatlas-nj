# CareAtlas NJ

Transparent New Jersey healthcare access mapping, built as an independent project beginning August 1, 2026.

Live app: [CareAtlas NJ](https://careatlas.lmayzel930.workers.dev).

## Source upload progress

This private repository receives an existing project in installments. It currently contains **431 of 720 files (59.86% by file count)** from the revised project snapshot. File count does not measure development effort or byte size. Commit dates record the actual import dates, not the dates of original implementation.

| Upload date | Contents | New files | Total files |
| --- | --- | ---: | ---: |
| September 5, 2026 | Configuration, types, hooks, utilities and evidence documentation | 72 | 72 |
| September 7, 2026 | Site shell and navigation | 20 | 92 |
| September 7, 2026 | Interactive map and initial NJ data | 75 | 167 |
| September 7, 2026 | API support and interface tests | 13 | 180 |
| September 8, 2026 | NJ search, statewide data foundations and validation checks | 18 | 198 |
| September 8, 2026 | Bergen, Hudson, Morris, Passaic and Union county records | 45 | 243 |
| September 8, 2026 | Hunterdon, Mercer, Middlesex, Monmouth and Somerset county records | 45 | 288 |
| September 9, 2026 | Burlington, Camden, Ocean, Sussex and Warren county records | 45 | 333 |
| September 9, 2026 | Atlantic, Cape May, Cumberland, Gloucester and Salem county records | 45 | 378 |
| September 9, 2026 | Statewide tract validation, generation tools and facility source data | 18 | 396 |
| September 10, 2026 | Healthcare pipeline libraries, source review data and test fixtures | 35 | 431 |

The fifth installment is being imported in dependency order: pipeline libraries and fixture/source data, import and review workflows, then checks and documentation. 35 files from this installment are currently imported.

**This remains a partial project archive.** All frontend source, server/Worker source, NJ search data, and detailed tract boundaries, classifications, town context, evidence and public records for all 21 NJ counties are included. Healthcare pipeline foundations and supporting data are being followed by their workflows and checks. Non-NJ boundary/search files, additional source import archives and reports, remaining documentation, and the full check runners are still pending. Manifests and archived documentation can reference files or historical context not present in this partial checkout. Follow the upload ledger above for this repository's actual import history.

The full tested app is maintained separately and used for the live deployment. No GitHub deployment integration is configured for this partial repository. The remaining **289 files** have not been uploaded. No automatic schedule for later installments has been set.

## Verification

These files are imported unchanged from the existing source snapshot. Final validation results will be recorded after the workflow scripts, their checks and documentation are imported. The full check runners remain pending.

## Evidence and review

CareAtlas preserves source provenance and missing values, and applies a published tract screening rule. Facility counts do not determine the gap classification. It does not diagnose a community or prove that care is absent.

See [the rule](docs/batch-7-transparent-flagging.md) and [the outside-review kit](docs/outside-review-kit.md). Real resident sessions and external expert review remain pending.

## Uploaded file inventory

### September 5: initial foundation (72 files)

- .env.example
- .gitattributes
- .gitignore
- LICENSE
- README.md
- docs/access-gap-data-contract.md
- docs/batch-6-social-shortage-evidence.md
- docs/batch-7-transparent-flagging.md
- docs/batch-8-public-tract-map-and-records.md
- docs/boundary-healthcare-summaries.md
- docs/cdc-places-foundation.md
- docs/doctor-office-data-contract.md
- docs/geography-search-index.md
- docs/healthcare-data-workflow.md
- docs/healthcare-pilot-source-plan.md
- docs/healthcare-production-coverage.md
- docs/healthcare-provider-review-workflow.md
- docs/healthcare-row-level-evidence.md
- docs/nj-tract-foundation.md
- docs/outside-review-kit.md
- docs/public-map-workflow.md
- docs/town-gap-foundation.md
- index.html
- package-lock.json
- package.json
- postcss.config.js
- public/_headers
- public/favicon.svg
- render.yaml
- src/geographyLayers.ts
- src/hooks/useCountyGapSummary.ts
- src/hooks/useDoctorOffices.ts
- src/hooks/useGapExplorer.ts
- src/hooks/useGeographyData.ts
- src/hooks/useGeographyDataManifest.ts
- src/hooks/useHealthcareCoverageSummary.ts
- src/hooks/useHealthcareFacilities.ts
- src/hooks/useTownFlaggedTracts.ts
- src/hooks/useTownGapContext.ts
- src/hooks/useTractClassificationShard.ts
- src/hooks/useTractPublicRecord.ts
- src/mapBounds.ts
- src/theme/colors.ts
- src/types.ts
- src/types/doctorOffice.ts
- src/types/healthcare.ts
- src/types/healthcareCoverage.ts
- src/types/townGapContext.ts
- src/types/tractEvidence.ts
- src/types/tractPublicRecord.ts
- src/utils/boundaryHealthcareSummary.ts
- src/utils/clipGeography.ts
- src/utils/doctorOfficeDiscovery.test.ts
- src/utils/doctorOfficeDiscovery.ts
- src/utils/geographyColors.ts
- src/utils/healthcareDataQuality.ts
- src/utils/healthcareFacilityAccessDetails.ts
- src/utils/healthcareFacilityContact.ts
- src/utils/healthcareFacilityFilters.ts
- src/utils/healthcareFacilityPresentation.ts
- src/utils/healthcareRowLevelEvidence.ts
- src/utils/stateFips.ts
- src/utils/tractClassification.ts
- src/utils/tractFacilityProximity.ts
- src/vite-env.d.ts
- tailwind.config.js
- tsconfig.app.json
- tsconfig.json
- tsconfig.node.json
- vite.config.js
- vitest.config.ts
- wrangler.jsonc

### September 7: Site shell and navigation (20 files)

- src/App.tsx
- src/components/MethodologyGuide.tsx
- src/components/PublicHeader.tsx
- src/components/PurposeDialog.tsx
- src/components/SiteBrand.tsx
- src/components/map/boundaryLabelUtils.ts
- src/components/map/boundaryNames.ts
- src/components/map/boundaryStyle.ts
- src/components/map/geometry.ts
- src/components/map/mapConstants.ts
- src/components/map/mapExamples.ts
- src/components/map/mapPermalink.ts
- src/components/map/mapReset.ts
- src/components/map/mapTypes.ts
- src/components/map/searchTargets.ts
- src/main.tsx
- src/pages/InternalDataReviewPage.tsx
- src/pages/MapPage.tsx
- src/pages/ProjectStoryPage.tsx
- src/styles.css

### September 7: Interactive map and initial NJ data (75 files)

- public/data/counties/by-state/34.geojson
- public/data/cousubs/by-state/34.geojson
- public/data/doctor-offices/nj.json
- public/data/geography-data-manifest.json
- public/data/healthcare/boundary-healthcare-summaries.json
- public/data/healthcare/by-state/34.json
- public/data/healthcare/coverage-summary.json
- public/data/tracts/nj/access-gap-rule-v1-summary.json
- public/data/tracts/nj/access-gap-rule.v1.json
- public/data/tracts/nj/by-county/013.geojson
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/013.json
- public/data/tracts/nj/evidence/cdc-places/by-county/013.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/013.json
- public/data/tracts/nj/evidence/census-acs/by-county/013.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/013.json
- public/data/tracts/nj/public-records/counties/new-jersey-counties.csv
- public/data/tracts/nj/public-records/counties/new-jersey-counties.json
- public/data/tracts/nj/public-records/download-manifest.json
- public/data/tracts/nj/public-records/reports/new-jersey-access-gap-report.md
- public/data/tracts/nj/public-records/tracts/by-county/013.csv
- public/data/tracts/nj/public-records/tracts/by-county/013.json
- public/data/tracts/nj/town-foundation/by-county/013.json
- public/data/tracts/nj/town-foundation/summary.json
- public/data/us-states.geojson
- src/components/BoundaryHealthcareSummaryCard.tsx
- src/components/CareAtlasMap.tsx
- src/components/DoctorOfficeControls.tsx
- src/components/DoctorOfficeMarkers.tsx
- src/components/DoctorOfficeMode.tsx
- src/components/HealthcareDataQualityDashboard.tsx
- src/components/HealthcareFacilityContactLinks.tsx
- src/components/HealthcareFacilityExplorer.tsx
- src/components/HealthcareFacilityKey.tsx
- src/components/HealthcareFacilityMarkers.tsx
- src/components/HealthcareFacilityReportCard.tsx
- src/components/HealthcareMapFilters.tsx
- src/components/HealthcareSourceReviewPanel.tsx
- src/components/HealthcareStagingReviewPanel.tsx
- src/components/MapSearchBar.tsx
- src/components/TractEvidencePanel.tsx
- src/components/map/ActiveStateWatcher.tsx
- src/components/map/AddressTractFinder.tsx
- src/components/map/AddressTractLocation.tsx
- src/components/map/BoundaryAutocomplete.tsx
- src/components/map/BoundaryAutocompleteController.tsx
- src/components/map/BoundaryHealthcarePreviewCard.tsx
- src/components/map/BoundaryLabels.tsx
- src/components/map/BoundaryLayerVisibilityController.tsx
- src/components/map/BoundarySearchController.tsx
- src/components/map/CountyOutlineLayer.tsx
- src/components/map/CountyTractOutlineLayer.tsx
- src/components/map/CustomWheelZoom.tsx
- src/components/map/GapExplorer.tsx
- src/components/map/GapSidebar.tsx
- src/components/map/GeographyBoundaries.tsx
- src/components/map/HealthcareFacilityZoomController.tsx
- src/components/map/InitialMapFitter.tsx
- src/components/map/MapLayerControlPanel.tsx
- src/components/map/MapLegend.tsx
- src/components/map/MapLevelIndicator.tsx
- src/components/map/MapSizeObserver.tsx
- src/components/map/OutsideFocusMaskLayer.tsx
- src/components/map/RoadBasemapLayer.tsx
- src/components/map/SelectedAreaCard.tsx
- src/components/map/SelectedBoundaryLabel.tsx
- src/components/map/StateContextBoundaries.tsx
- src/components/map/TownFlaggedTractList.tsx
- src/components/map/TownTractOutlineLayer.tsx
- src/components/map/TractClassificationLayer.tsx
- src/components/map/TractContextBoundaryLayer.tsx
- src/components/map/TractGapContext.tsx
- src/components/map/TractMapKey.tsx
- src/components/map/TractModeController.tsx
- src/components/map/TractResultExplanation.tsx
- src/components/map/ZoomLevelWatcher.tsx

### September 7: API support and interface tests (13 files)

- scripts/copyProductionPublic.mjs
- scripts/productionDataAllowlist.mjs
- scripts/runDevServers.mjs
- scripts/validateProductionDist.mjs
- server/geminiExplanation.mjs
- server/index.mjs
- server/njGeocoder.mjs
- src/components/DoctorOfficeControls.test.tsx
- src/components/map/ResidentJourney.test.tsx
- src/components/map/SelectedAreaCard.test.tsx
- src/pages/MapPage.test.tsx
- src/test/setup.ts
- worker/index.mjs

### September 8: NJ search, statewide data foundations and validation checks (18 files)

- public/data/geography/search/search-manifest.json
- public/data/geography/search/states.json
- public/data/geography/search/states/34.json
- public/data/healthcare-resources.json
- public/data/healthcare/facility-boundary-assignments.json
- public/data/tracts/access-gap-classification.v1.schema.json
- public/data/tracts/nj/batch-6-coverage-summary.json
- public/data/tracts/nj/cdc-places-coverage-summary.json
- public/data/tracts/nj/cdc-svi-coverage-summary.json
- public/data/tracts/nj/census-acs-coverage-summary.json
- public/data/tracts/nj/coverage-summary.json
- public/data/tracts/nj/facility-tract-assignments.json
- public/data/tracts/nj/hrsa-shortage-coverage-summary.json
- public/data/tracts/nj/tract-foundation.json
- public/data/tracts/test-fixtures/tract-evidence.v1.fixture.json
- public/data/tracts/tract-evidence.v1.schema.json
- scripts/checkTractEvidenceSchema.mjs
- scripts/validateDoctorOffices.mjs

### September 8: Bergen, Hudson, Morris, Passaic and Union county records (45 files)

- public/data/tracts/nj/by-county/003.geojson
- public/data/tracts/nj/by-county/017.geojson
- public/data/tracts/nj/by-county/027.geojson
- public/data/tracts/nj/by-county/031.geojson
- public/data/tracts/nj/by-county/039.geojson
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/003.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/017.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/027.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/031.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/039.json
- public/data/tracts/nj/evidence/cdc-places/by-county/003.json
- public/data/tracts/nj/evidence/cdc-places/by-county/017.json
- public/data/tracts/nj/evidence/cdc-places/by-county/027.json
- public/data/tracts/nj/evidence/cdc-places/by-county/031.json
- public/data/tracts/nj/evidence/cdc-places/by-county/039.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/003.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/017.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/027.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/031.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/039.json
- public/data/tracts/nj/evidence/census-acs/by-county/003.json
- public/data/tracts/nj/evidence/census-acs/by-county/017.json
- public/data/tracts/nj/evidence/census-acs/by-county/027.json
- public/data/tracts/nj/evidence/census-acs/by-county/031.json
- public/data/tracts/nj/evidence/census-acs/by-county/039.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/003.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/017.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/027.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/031.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/039.json
- public/data/tracts/nj/public-records/tracts/by-county/003.csv
- public/data/tracts/nj/public-records/tracts/by-county/003.json
- public/data/tracts/nj/public-records/tracts/by-county/017.csv
- public/data/tracts/nj/public-records/tracts/by-county/017.json
- public/data/tracts/nj/public-records/tracts/by-county/027.csv
- public/data/tracts/nj/public-records/tracts/by-county/027.json
- public/data/tracts/nj/public-records/tracts/by-county/031.csv
- public/data/tracts/nj/public-records/tracts/by-county/031.json
- public/data/tracts/nj/public-records/tracts/by-county/039.csv
- public/data/tracts/nj/public-records/tracts/by-county/039.json
- public/data/tracts/nj/town-foundation/by-county/003.json
- public/data/tracts/nj/town-foundation/by-county/017.json
- public/data/tracts/nj/town-foundation/by-county/027.json
- public/data/tracts/nj/town-foundation/by-county/031.json
- public/data/tracts/nj/town-foundation/by-county/039.json

### September 8: Hunterdon, Mercer, Middlesex, Monmouth and Somerset county records (45 files)

- public/data/tracts/nj/by-county/019.geojson
- public/data/tracts/nj/by-county/021.geojson
- public/data/tracts/nj/by-county/023.geojson
- public/data/tracts/nj/by-county/025.geojson
- public/data/tracts/nj/by-county/035.geojson
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/019.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/021.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/023.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/025.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/035.json
- public/data/tracts/nj/evidence/cdc-places/by-county/019.json
- public/data/tracts/nj/evidence/cdc-places/by-county/021.json
- public/data/tracts/nj/evidence/cdc-places/by-county/023.json
- public/data/tracts/nj/evidence/cdc-places/by-county/025.json
- public/data/tracts/nj/evidence/cdc-places/by-county/035.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/019.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/021.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/023.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/025.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/035.json
- public/data/tracts/nj/evidence/census-acs/by-county/019.json
- public/data/tracts/nj/evidence/census-acs/by-county/021.json
- public/data/tracts/nj/evidence/census-acs/by-county/023.json
- public/data/tracts/nj/evidence/census-acs/by-county/025.json
- public/data/tracts/nj/evidence/census-acs/by-county/035.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/019.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/021.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/023.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/025.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/035.json
- public/data/tracts/nj/public-records/tracts/by-county/019.csv
- public/data/tracts/nj/public-records/tracts/by-county/019.json
- public/data/tracts/nj/public-records/tracts/by-county/021.csv
- public/data/tracts/nj/public-records/tracts/by-county/021.json
- public/data/tracts/nj/public-records/tracts/by-county/023.csv
- public/data/tracts/nj/public-records/tracts/by-county/023.json
- public/data/tracts/nj/public-records/tracts/by-county/025.csv
- public/data/tracts/nj/public-records/tracts/by-county/025.json
- public/data/tracts/nj/public-records/tracts/by-county/035.csv
- public/data/tracts/nj/public-records/tracts/by-county/035.json
- public/data/tracts/nj/town-foundation/by-county/019.json
- public/data/tracts/nj/town-foundation/by-county/021.json
- public/data/tracts/nj/town-foundation/by-county/023.json
- public/data/tracts/nj/town-foundation/by-county/025.json
- public/data/tracts/nj/town-foundation/by-county/035.json

### September 9: Burlington, Camden, Ocean, Sussex and Warren county records (45 files)

- public/data/tracts/nj/by-county/005.geojson
- public/data/tracts/nj/by-county/007.geojson
- public/data/tracts/nj/by-county/029.geojson
- public/data/tracts/nj/by-county/037.geojson
- public/data/tracts/nj/by-county/041.geojson
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/005.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/007.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/029.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/037.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/041.json
- public/data/tracts/nj/evidence/cdc-places/by-county/005.json
- public/data/tracts/nj/evidence/cdc-places/by-county/007.json
- public/data/tracts/nj/evidence/cdc-places/by-county/029.json
- public/data/tracts/nj/evidence/cdc-places/by-county/037.json
- public/data/tracts/nj/evidence/cdc-places/by-county/041.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/005.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/007.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/029.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/037.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/041.json
- public/data/tracts/nj/evidence/census-acs/by-county/005.json
- public/data/tracts/nj/evidence/census-acs/by-county/007.json
- public/data/tracts/nj/evidence/census-acs/by-county/029.json
- public/data/tracts/nj/evidence/census-acs/by-county/037.json
- public/data/tracts/nj/evidence/census-acs/by-county/041.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/005.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/007.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/029.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/037.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/041.json
- public/data/tracts/nj/public-records/tracts/by-county/005.csv
- public/data/tracts/nj/public-records/tracts/by-county/005.json
- public/data/tracts/nj/public-records/tracts/by-county/007.csv
- public/data/tracts/nj/public-records/tracts/by-county/007.json
- public/data/tracts/nj/public-records/tracts/by-county/029.csv
- public/data/tracts/nj/public-records/tracts/by-county/029.json
- public/data/tracts/nj/public-records/tracts/by-county/037.csv
- public/data/tracts/nj/public-records/tracts/by-county/037.json
- public/data/tracts/nj/public-records/tracts/by-county/041.csv
- public/data/tracts/nj/public-records/tracts/by-county/041.json
- public/data/tracts/nj/town-foundation/by-county/005.json
- public/data/tracts/nj/town-foundation/by-county/007.json
- public/data/tracts/nj/town-foundation/by-county/029.json
- public/data/tracts/nj/town-foundation/by-county/037.json
- public/data/tracts/nj/town-foundation/by-county/041.json

### September 9: Atlantic, Cape May, Cumberland, Gloucester and Salem county records (45 files)

- public/data/tracts/nj/by-county/001.geojson
- public/data/tracts/nj/by-county/009.geojson
- public/data/tracts/nj/by-county/011.geojson
- public/data/tracts/nj/by-county/015.geojson
- public/data/tracts/nj/by-county/033.geojson
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/001.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/009.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/011.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/015.json
- public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/033.json
- public/data/tracts/nj/evidence/cdc-places/by-county/001.json
- public/data/tracts/nj/evidence/cdc-places/by-county/009.json
- public/data/tracts/nj/evidence/cdc-places/by-county/011.json
- public/data/tracts/nj/evidence/cdc-places/by-county/015.json
- public/data/tracts/nj/evidence/cdc-places/by-county/033.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/001.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/009.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/011.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/015.json
- public/data/tracts/nj/evidence/cdc-svi/by-county/033.json
- public/data/tracts/nj/evidence/census-acs/by-county/001.json
- public/data/tracts/nj/evidence/census-acs/by-county/009.json
- public/data/tracts/nj/evidence/census-acs/by-county/011.json
- public/data/tracts/nj/evidence/census-acs/by-county/015.json
- public/data/tracts/nj/evidence/census-acs/by-county/033.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/001.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/009.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/011.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/015.json
- public/data/tracts/nj/evidence/hrsa-shortage/by-county/033.json
- public/data/tracts/nj/public-records/tracts/by-county/001.csv
- public/data/tracts/nj/public-records/tracts/by-county/001.json
- public/data/tracts/nj/public-records/tracts/by-county/009.csv
- public/data/tracts/nj/public-records/tracts/by-county/009.json
- public/data/tracts/nj/public-records/tracts/by-county/011.csv
- public/data/tracts/nj/public-records/tracts/by-county/011.json
- public/data/tracts/nj/public-records/tracts/by-county/015.csv
- public/data/tracts/nj/public-records/tracts/by-county/015.json
- public/data/tracts/nj/public-records/tracts/by-county/033.csv
- public/data/tracts/nj/public-records/tracts/by-county/033.json
- public/data/tracts/nj/town-foundation/by-county/001.json
- public/data/tracts/nj/town-foundation/by-county/009.json
- public/data/tracts/nj/town-foundation/by-county/011.json
- public/data/tracts/nj/town-foundation/by-county/015.json
- public/data/tracts/nj/town-foundation/by-county/033.json

### September 9: Statewide tract validation, generation tools and facility source data (18 files)

- public/data/healthcare/facilities.json
- scripts/applyAccessGapRule.mjs
- scripts/buildBatch8PublicRecords.mjs
- scripts/buildNjTownGapFoundation.mjs
- scripts/buildNjTractFoundation.mjs
- scripts/checkAccessGapRule.mjs
- scripts/checkNjMapGeography.mjs
- scripts/importCdcPlacesTractEvidence.mjs
- scripts/lib/accessGapRuleV1.mjs
- scripts/lib/batch6SourceConfig.mjs
- scripts/lib/cdcPlacesConfig.mjs
- scripts/lib/csvRows.mjs
- scripts/validateAccessGapClassifications.mjs
- scripts/validateBatch6TractEvidence.mjs
- scripts/validateBatch8PublicRecords.mjs
- scripts/validateCdcPlacesTractEvidence.mjs
- scripts/validateNjTownGapFoundation.mjs
- scripts/validateNjTractFoundation.mjs

### September 10: Healthcare pipeline libraries, source review data and test fixtures (35 files)

- public/data/doctor-offices/staging/README.md
- public/data/healthcare/README.md
- public/data/healthcare/facilities.demo.json
- public/data/healthcare/facilities.sample.json
- public/data/healthcare/facilities.template.csv
- public/data/healthcare/imports/README.md
- public/data/healthcare/imports/cms/enrichment/cms-medicare-insurance-enrichment.json
- public/data/healthcare/imports/hrsa-sample.csv
- public/data/healthcare/imports/hrsa/enrichment/hrsa-designation-enrichment.json
- public/data/healthcare/imports/pilot-nj/README.md
- public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv
- public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.template.csv
- public/data/healthcare/imports/source-reviews.json
- public/data/healthcare/imports/source-reviews.sample.json
- public/data/healthcare/staging/README.md
- public/data/healthcare/staging/facilities.staged.json
- public/data/healthcare/staging/latest-promotion-report.json
- public/data/healthcare/test-fixtures/.gitignore
- public/data/healthcare/test-fixtures/README.md
- public/data/healthcare/test-fixtures/enrichment-plan.input.fixture.json
- public/data/healthcare/test-fixtures/enrichment-plan.production.fixture.json
- public/data/healthcare/test-fixtures/enrichment-provenance.fixture.json
- public/data/healthcare/test-fixtures/healthcare-pipeline-fixture.csv
- public/data/healthcare/test-fixtures/hrsa-refresh-audit/official-hrsa.fixture.csv
- public/data/healthcare/test-fixtures/hrsa-refresh-audit/production-facilities.fixture.json
- public/data/tracts/test-fixtures/cdc-places-source.fixture.json
- scripts/lib/doctorOfficePipeline.mjs
- scripts/lib/doctorOfficeSourceConfig.mjs
- scripts/lib/healthcareAccessReporting.mjs
- scripts/lib/healthcareEnrichmentPlan.mjs
- scripts/lib/healthcareEnrichmentProvenance.mjs
- scripts/lib/healthcareOfficialSourceDiscovery.mjs
- scripts/lib/healthcareProviderEnrichmentOpportunities.mjs
- scripts/lib/stateBounds.mjs
- scripts/lib/tractEvidenceBatch6.mjs

## License

Source code is covered by the included [MIT License](LICENSE). Underlying datasets retain their publishers' terms.
