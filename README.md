# CareAtlas NJ

Transparent New Jersey healthcare access mapping, built as an independent project beginning August 1, 2026.

Live app: [CareAtlas NJ](https://careatlas.lmayzel930.workers.dev).

## First source installment — September 5, 2026

This private repository is receiving an existing project in installments. This first upload contains **72 of the 720 files in the revised project snapshot (10% by file count)**. File count does not measure development effort or byte size. Today's commit records when these files were uploaded, not when their original implementation was written.

Included: configuration, data types, data-loading hooks, shared utilities and evidence-method documentation. The README is adapted to explain this partial upload.

**This installment is incomplete and cannot build or deploy the app on its own.** The application entry points, most UI components, server/Worker implementation, pipeline scripts and runtime datasets are not all present. The full tested app is maintained separately and is used for deployment to the live site. No GitHub deployment integration is configured for this partial repository.

The remaining 648 files have not been uploaded. No automatic schedule for later installments has been set.

## Evidence and review

CareAtlas preserves source provenance and missing values, and applies a published tract screening rule. Facility counts do not determine the gap classification. It does not diagnose a community or prove that care is absent.

See [the rule](docs/batch-7-transparent-flagging.md) and [the outside-review kit](docs/outside-review-kit.md). Real resident sessions and external expert review remain pending.

## Files included in this installment

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

## License

Source code is covered by the included [MIT License](LICENSE). Underlying datasets retain their publishers' terms.
