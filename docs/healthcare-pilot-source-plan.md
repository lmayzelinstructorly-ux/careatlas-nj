# First Healthcare Facility Pilot Source Plan

Last reviewed: 2026-06-01

This plan selects the safest first real source-backed healthcare facility pilot
for CareAtlas. It is intentionally an intake plan only; it does not import
records or change production healthcare data.

## Recommendation

Use New Jersey as the first pilot geography, with a small hand-reviewed subset
of community health center service delivery sites from HRSA's official Health
Center Service Delivery and Look-Alike Sites dataset.

Recommended source:

- Source name: HRSA Health Center Service Delivery and Look-Alike Sites
- Source category: Federal official public downloadable dataset
- Publisher: HRSA, Bureau of Primary Health Care
- Source catalog URL: https://data.hrsa.gov/data/download/
- Supporting dashboard URL: https://data.hrsa.gov/topics/Service-Delivery-Sites/dashboard
- Facility type in CareAtlas: `community_health_center`
- Pilot state: New Jersey (`NJ`, state FIPS `34`)

This is the safest first pilot because the repo already has HRSA-aware official
source mapping in `scripts/importOfficialHealthcareFacilities.mjs`, the New
Jersey pilot folder is already established, and the existing source review,
staging, record review, promotion and validation workflow is designed to keep
real source-backed records separate from production until they are approved.

Do not start with random web directories, Google Maps results, scraped facility
pages, or broad unofficial lists. If a New Jersey state facility spreadsheet is
used later, treat it as a separate source-review task. The NJ Department of
Health acute-care facility finder appears useful for hospitals and licensed
acute-care sites, but the current repo has a clearer first path for HRSA-style
community health center data.

## Intake Method For The Next Task

Use a small hand-reviewed staging batch from the official HRSA downloadable
CSV. The next task should download or manually obtain the HRSA CSV, filter it to
New Jersey service delivery/look-alike sites, select a small initial batch, and
copy only source-backed fields into:

```text
public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv
```

Start from:

```text
public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.template.csv
```

Do not write directly to `public/data/healthcare/facilities.json`. The direct
official HRSA importer can be used for previewing field mapping, but the first
production pilot should still move through the existing source review, staging,
manual review, approval, promotion and validation workflow.

## Required Fields

Each candidate row should include these fields before it can be approved for
production promotion:

- `name`
- `facilityType` with the value `community_health_center`
- `city`
- `state` with the value `NJ`
- `stateFips` with the value `34`
- `sourceName`
- `sourceUrl`
- `sourceLastChecked`
- `verificationStatus` with the value `needs_review` until reviewed

Production map placement also requires valid `latitude` and `longitude`.
Records without verified coordinates may be staged for review, but they should
not be approved for promotion to production map data.

## Optional Fields

Fill optional fields only when the HRSA source directly supports them or a
human reviewer has source-backed confirmation:

- `id`
- `address`
- `county`
- `countyFips`
- `postalCode`
- `phone`
- `website`
- `services`
- `monday` through `sunday`
- `hoursNotes`
- `priceLevel`
- `acceptsSlidingScale`
- `estimatedVisitCost`
- `priceNotes`
- `acceptsMedicaid`
- `acceptsMedicare`
- `acceptsUninsured`
- `insuranceNotes`
- `accessibilityInfo`
- `sourceNotes`
- `sourceId`
- `sourceDataset`
- `sourceLastUpdated`
- `lastVerified`

Leave `isDemoData` blank for real pilot rows.

## Source Metadata To Preserve

Every pilot row should preserve facility-level source metadata:

- `sourceName`: HRSA
- `sourceUrl`: the HRSA dataset/catalog URL or a stable record-level URL when
  available
- `sourceLastChecked`: the date the reviewer checked the source, in
  `YYYY-MM-DD` format
- `sourceDataset`: Health Center Service Delivery and Look-Alike Sites
- `sourceId`: the HRSA site/source identifier when present
- `sourceLastUpdated`: the HRSA dataset update date when available
- `sourceNotes`: brief notes about the fields copied from the source

If the exact downloadable CSV URL changes or cannot be verified in the repo
environment, keep the catalog URL above in `sourceUrl` and document the
download date in `sourceNotes`.

## Coordinates

Coordinates must come from the HRSA source or from a documented verified
geocoding review of the official address. Do not guess coordinates and do not
use approximate town centroids.

Before approval, verify that:

- Latitude and longitude parse as numbers.
- Latitude is between `-90` and `90`.
- Longitude is between `-180` and `180`.
- The point is in New Jersey and reasonably matches the source address.
- The record is not a domestic violence shelter or other sensitive facility
  where address details are suppressed by the source.

If coordinates are missing, suppressed, outside New Jersey, or inconsistent
with the address, leave them blank and mark the staged record as
`needs_more_source_info` instead of promoting it.

## Missing Data

Missing data stays unknown. Do not infer or fill hours, prices, services,
insurance acceptance, accessibility notes, address details, phone numbers,
websites, or coordinates unless a source backs the value.

Use `priceLevel=unknown` when cost information is not source-backed. Leave
boolean fields blank when the source does not confirm a true or false value.
Missing fields should appear as data completeness notes and staging issues,
not as guessed values.

## Claims To Avoid

CareAtlas must present these records as public health access indicators
only. Do not claim:

- Medical quality
- Clinical outcomes
- Diagnosis or treatment guidance
- Patient-specific recommendations
- Exact prices unless source-backed
- Insurance acceptance unless source-backed
- Hours or service availability unless source-backed
- That a facility is currently accepting patients unless the source explicitly
  says so and the value has been recently checked

## Workflow

Use the existing New Jersey pilot workflow:

1. Put the reviewed source-backed CSV at
   `public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv`.
2. Run `npm run healthcare:pilot-nj:review-source`.
3. If the review is acceptable, run
   `npm run healthcare:pilot-nj:review-source -- --write-review`.
4. Run `npm run healthcare:pilot-nj:stage`.
5. If the staging preview is acceptable, run
   `npm run healthcare:pilot-nj:stage -- --write`.
6. Run `npm run healthcare:pilot-nj:list-staged`.
7. Review each staged record with `npm run healthcare:review-staged`.
8. Mark records `approved`, `rejected`, or `needs_more_source_info`.
9. Run `npm run healthcare:validate-staging`.
10. Dry-run promotion with `npm run healthcare:pilot-nj:promote`.
11. Promote approved records with
    `npm run healthcare:pilot-nj:promote -- --write`.
12. Run `npm run healthcare:pilot-nj:validate`.
13. Run `npm run validate:healthcare`.
14. Run `npm run check:healthcare-scoring`.
15. Run `npm run check:healthcare-quality`.
16. Run `npm run check:healthcare-pipeline`.
17. Run `npm run check`.
18. Run `npm run build`.

Promotion should occur only for real, approved, source-backed records with
valid coordinates and facility-level source metadata. Demo, sample, test,
placeholder, unverified, duplicate, sensitive, or unsupported records must stay
out of production.
