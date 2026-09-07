# CareAtlas NJ

Transparent New Jersey healthcare access mapping, built as an independent project beginning August 1, 2026.

Live app: [CareAtlas NJ](https://careatlas.lmayzel930.workers.dev).

## Source upload progress

This private repository receives an existing project in installments. It currently contains **167 of 720 files (23.19% by file count)** from the revised project snapshot. File count does not measure development effort or byte size. Commit dates record the actual import dates, not the dates of original implementation.

| Upload date | Contents | New files | Total files |
| --- | --- | ---: | ---: |
| September 5, 2026 | Configuration, types, hooks, utilities and evidence documentation | 72 | 72 |
| September 7, 2026 | Site shell and navigation | 20 | 92 |
| September 7, 2026 | Interactive map and initial NJ data | 75 | 167 |

The second installment is being imported in component order: site shell, map and initial NJ data, then API support and tests.

**This is an incomplete source checkout and is not ready for full production deployment.** Application components, backend support, runtime data and tooling are still arriving in this installment. Manifests and summaries describe the full dataset; they may reference files that have not been uploaded yet.

The full tested app is maintained separately and used for the live deployment. No GitHub deployment integration is configured for this partial repository. The remaining **553 files** have not been uploaded. No automatic schedule for later installments has been set.

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

## License

Source code is covered by the included [MIT License](LICENSE). Underlying datasets retain their publishers' terms.
