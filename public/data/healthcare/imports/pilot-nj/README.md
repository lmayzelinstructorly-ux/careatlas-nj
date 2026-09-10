# New Jersey Healthcare Pilot Intake

This folder is the first-pilot intake area for real New Jersey healthcare
facility CSV files. The first supported pilot path is a small, hand-reviewed
subset of HRSA Health Center Service Delivery and Look-Alike Sites records for
New Jersey community health centers.

Production healthcare data may stay empty. Do not create placeholder facilities
to make the map look populated.

## Files

Place the real pilot CSV here:

```text
public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv
```

Use this blank header-only template to start the CSV:

```text
public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.template.csv
```

Do not rename the template and do not import the template itself. The template
contains no data rows on purpose.

## Data Honesty Rules

Every production candidate must describe a real healthcare facility from a
traceable source. Do not invent facility names, addresses, coordinates,
services, insurance details, prices, hours, source URLs or source dates.

Unknown data should stay blank unless the field has an explicit `unknown` value.
Use `unknown` for `priceLevel` when cost information is not source-backed. Leave
boolean fields blank when the source does not confirm the answer.

Every row should include source information. Prefer both `sourceName` and
`sourceUrl`; at least one is needed for staging review, and promotion requires
facility-level source metadata. Coordinates must be valid before a record can be
promoted to production and appear as a map marker.

The pilot scripts do not geocode. If HRSA provides facility names and addresses
but no verified coordinates, leave `latitude` and `longitude` blank. The record
can be staged for review, but it should stay `needs_more_source_info` until
coordinates are added from a source-backed field or documented manual review.
Coordinates that are malformed or outside the expected New Jersey pilot bounds
are flagged as blockers.

## Column Guide

Keep the header row unchanged. Fill one row per real facility.

| Column | How to fill it |
| --- | --- |
| `id` | Stable lowercase ID, preferably from a source ID or a careful slug. Leave blank only if staging should generate one. |
| `name` | Real facility name exactly as supported by the source. |
| `facilityType` | One of `hospital`, `clinic`, `urgent_care`, `community_health_center`, `pharmacy`, `mental_health`, `dental`, `other`. |
| `address`, `city`, `state`, `postalCode` | Source-backed location fields. Use `NJ` for New Jersey state abbreviation. |
| `stateFips`, `county`, `countyFips` | Use source-backed or official geography values when available. New Jersey state FIPS is `34`. |
| `latitude`, `longitude` | Real coordinates from the source or verified geocoding. Do not guess. Leave blank if not verified. |
| `phone`, `website` | Fill only when the source supports them. |
| `services` | Source-backed public service labels separated by semicolons or commas. Leave blank if unknown. |
| `monday` through `sunday`, `hoursNotes` | Fill only source-backed operating hours. Leave blank if unknown. |
| `priceLevel` | Use `free`, `low_cost`, `standard`, or `unknown`. Do not infer price level. |
| `acceptsSlidingScale`, `acceptsMedicaid`, `acceptsMedicare`, `acceptsUninsured` | Use `true`, `false`, `yes`, `no`, or blank. Blank means not verified. |
| `estimatedVisitCost`, `priceNotes`, `insuranceNotes` | Fill only directly supported cost or payer notes. Do not invent prices. |
| `accessibilityInfo` | Source-backed accessibility notes only. |
| `sourceName` | Name of the official/public source or dataset. |
| `sourceUrl` | URL for the dataset or record. |
| `sourceLastChecked` | Date you checked the source, in `YYYY-MM-DD` format. |
| `sourceNotes` | Short review notes, such as which source fields were used. |
| `sourceId` | Optional source record ID, if the dataset provides one. |
| `sourceDataset` | Optional dataset/program name, if different from `sourceName`. |
| `sourceLastUpdated` | Optional source update date, if the source publishes one. |
| `lastVerified` | Optional date the facility details were verified, in `YYYY-MM-DD` format. |
| `verificationStatus` | Use `needs_review` until a human has reviewed the source-backed row. |
| `isDemoData` | Leave blank for real pilot data. Never mark production pilot rows as demo. |

The staging script also warns when the CSV contains fields outside this column
guide. Those values are not mapped into staged records. Keep them in the source
file for traceability if useful, but do not treat them as production fields
unless the schema and documentation are intentionally updated.

## Required Workflow

Run source review first. This is a dry run and does not write production data:

```bash
npm run healthcare:pilot-nj:review-source
```

When the review output looks right, write or update the source review metadata:

```bash
npm run healthcare:pilot-nj:review-source -- --write-review
```

Dry-run staging:

```bash
npm run healthcare:pilot-nj:stage
```

Write candidate records to staging only after the preview looks right:

```bash
npm run healthcare:pilot-nj:stage -- --write
```

Review staged records:

```bash
npm run healthcare:pilot-nj:list-staged
npm run healthcare:review-staged -- --id=staged-123 --status=approved --notes="Source checked"
npm run healthcare:review-staged -- --id=staged-123 --status=approved --notes="Source checked" --write
```

Use `--status=rejected` for duplicates, unsupported rows or records that should
not become production data. Use `--status=needs_more_source_info` when a row is
real but lacks enough source support.

Validate staging and dry-run promotion:

```bash
npm run healthcare:validate-staging
npm run healthcare:pilot-nj:promote
```

Promote only approved, real, source-backed records with valid coordinates:

```bash
npm run healthcare:pilot-nj:promote -- --write
```

Validate production healthcare data and run app checks:

```bash
npm run healthcare:pilot-nj:validate
npm run validate:healthcare
npm run check:healthcare-scoring
npm run check:healthcare-quality
npm run check:healthcare-pipeline
npm run check
npm run build
```

Manual app testing stays with the human user:

```bash
npm run dev
```

Open `/map`. With no real pilot records promoted, production data should remain
empty. After promotion, only source-backed facilities with valid coordinates
should appear as healthcare markers.
