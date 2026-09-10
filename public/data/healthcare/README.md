# Healthcare Facility Data

> Deployment note: this folder also contains local workflow artifacts. The
> production build allowlists only the generated New Jersey facility shard,
> coverage summary, facility-boundary assignments and boundary healthcare summaries.
> Imports, staging, reviews, reports, fixtures, templates, demos and this
> README are excluded from `dist`. Deploy the validated `dist`, not `public`.

For a step-by-step beginner workflow, see
`docs/healthcare-data-workflow.md` from the project root.

`facilities.json` is the production app-ready HRSA health center site dataset
used by CareAtlas. It should contain only real, source-backed records. It
can be empty, and the app should still work.

`by-state/34.json` is generated from the New Jersey records in
`facilities.json`. The focused public map loads this smaller shard; internal
development review tools retain access to the complete production file.

For the current production coverage summary, see
`docs/healthcare-production-coverage.md` from the project root.

## Current Production Coverage

As of 2026-07-13, `facilities.json` contains 3,920 source-backed records across
the 13 states listed in `coverage-summary.json`: 3,201 HRSA health center
service-delivery/look-alike sites and 719 CMS hospitals. This is not a complete
list of healthcare providers. All 3,920 production records have valid
source-provided coordinates.

The active New Jersey map scope has 215 production facilities: 153 HRSA
service-delivery sites and 62 CMS hospitals. All 215 are assigned by coordinate
to an official New Jersey state, county and town/township boundary with no
assignment warnings. Administrative-only HRSA locations are not treated as
patient-facing healthcare-center markers.

Major available fields include facility identity, address, city, state, county,
postal code, latitude, longitude, official source metadata, last verified date
and verification status. Phone is present for 3,917 records and website for
1,728; neither field should be described as universally available. Services,
daily hours, insurance, cost/sliding-fee and accessibility details remain
unknown unless an official source and field-level provenance support them.

When production is empty, the map, Facility Explorer, data quality audit and
report-card area should show safe empty states. Do not fill production with
demo or placeholder records just to make the map look populated.

`facilities.demo.json` contains optional demo records for local development and testing. These records are fake/sample data and are not loaded by default.

`facilities.sample.json` is a schema example with sample records. Keep it separate from production data.

Demo records must not be committed into production `facilities.json`. Production validation fails when `facilities.json` contains records with `verificationStatus: "demo"` or `isDemoData: true`.

`facility-boundary-assignments.json` is a generated facility-to-boundary cache.
It connects production facilities to official Census/legal/admin boundary
polygons by coordinate only. It is separate from `facilities.json` so generated
spatial relationships do not mutate source-backed healthcare records.

`boundary-healthcare-summaries.json` is a generated boundary-level healthcare
access summary cache. It aggregates production facilities from
`facility-boundary-assignments.json` by official state, county and local
jurisdiction IDs. It does not guess facility membership or add fake records.
The selected-boundary summary UI, AI-style boundary insights and optional HRSA
site count choropleth all read from this generated cache.

`facilities.template.csv` is the generic beginner-friendly data entry template.
For the first real pilot, prefer the New Jersey pilot template at
`imports/pilot-nj/nj-healthcare-pilot.template.csv`.

`imports/source-reviews.json` stores pre-import source review summaries. It is
loaded by the map healthcare workflow to show whether a source CSV is ready to
import, needs review, or is not ready. The production file defaults to an empty
array and should contain only real source review metadata.

`imports/source-reviews.sample.json` is an optional demo example. It is not
loaded by default.

`staging/facilities.staged.json` stores normalized candidate records before
promotion. Staged records are not production healthcare data. They must be
reviewed and marked `approved` before the promotion script can merge them into
`facilities.json`.

`test-fixtures/` contains fake demo records used only by the end-to-end
pipeline check. These records must stay isolated in temporary outputs and must
not be promoted into production `facilities.json`.

## CSV Fields

Keep the header row unchanged. The template includes:

```text
id,name,facilityType,address,city,state,stateFips,county,countyFips,latitude,longitude,phone,website,services,monday,tuesday,wednesday,thursday,friday,saturday,sunday,hoursNotes,priceLevel,acceptsSlidingScale,estimatedVisitCost,priceNotes,acceptsMedicaid,acceptsMedicare,acceptsUninsured,insuranceNotes,accessibilityInfo,sourceName,sourceUrl,sourceLastChecked,sourceNotes,lastVerified,verificationStatus
```

Use stable, lowercase IDs such as `county-clinic-name` when adding verified real records. `facilityType` must be one of `hospital`, `clinic`, `urgent_care`, `community_health_center`, `pharmacy`, `mental_health`, `dental`, or `other`.

The `services` cell can contain multiple values separated by commas. Because CSV also uses commas between columns, wrap the services cell in quotes, for example `"primary care, urgent care, vaccines"`.

Boolean fields accept `true`, `false`, `yes`, `no`, or a blank cell. Blank means the detail has not been verified yet.

Use `priceLevel` values of `free`, `low_cost`, `standard`, or `unknown`. Do not guess prices, hours, services, insurance acceptance, reviews, or accessibility details. Those fields must come from a source that can be checked.

Facilities without valid latitude and longitude can be reviewed in the data
workflow, but production map markers require verified coordinates. Facility
Explorer uses neutral ordering, and report cards clearly show missing data
instead of hiding it. CareAtlas does not publish facility scores, rankings or
medical quality ratings.

## Enrichment Sources

Richer records may come from official facility or health-system pages and
federal, state or local open-data portals when each added field has reviewable
field-level provenance. Treat public directories as discovery-only unless an
approved source verifies the exact field and its provenance is recorded.

Google Search or Google Maps may be used only to discover candidate official
source pages for manual review. Google place metadata, ratings, reviews, review
summaries and patient comments are not allowed production enrichment inputs
under the current policy. Reviews, ratings and patient comments must not be
copied into production or converted into medical-quality or other quality
evidence.

## Facility Boundary Assignments

Generate facility-to-boundary assignments after production healthcare records
or official boundary files change:

```bash
npm run assign:facility-boundaries
npm run assign:facility-boundaries -- --write
npm run validate:facility-boundaries
```

The first command is a dry run and prints an audit report without changing
files. The `--write` command writes:

```text
public/data/healthcare/facility-boundary-assignments.json
```

The assignment utility reads:

```text
public/data/healthcare/facilities.json
public/data/us-states.geojson
public/data/counties/by-state/{STATEFP}.geojson
public/data/cousubs/by-state/{STATEFP}.geojson
```

Assignments are based only on valid facility `latitude` and `longitude` values
and official legal/admin boundary polygons. Facility names, address text, county
text and local jurisdiction guesses are not used for assignment. GeoJSON
coordinates are treated as longitude/latitude, while facility fields are treated
as latitude/longitude.

Each assignment record is keyed by `facilityId` and includes the facility name
for review, the coordinate used, assigned state/county/local jurisdiction
official IDs when matched, an assignment status and warnings. Status values
distinguish `assigned`, `partial_assignment`, `missing_coordinates`,
`invalid_coordinates`, `outside_supported_geography` and
`no_matching_boundary`. Boundary-level statuses also identify unavailable or
unmatched local jurisdiction coverage.

Facilities with missing or invalid coordinates are not assigned. Facilities
outside the supported lower 48 plus Washington, D.C. scope are flagged rather
than moved to fallback coordinates. Review warnings before using assignments
for future boundary-level healthcare summaries or insights.

## Boundary Healthcare Summaries

Generate summaries after production facilities, facility-boundary assignments
or official boundary files change:

```bash
npm run generate:boundary-healthcare-summaries
npm run generate:boundary-healthcare-summaries -- --write
npm run validate:boundary-healthcare-summaries
npm run check:boundary-healthcare-insights
```

The summary generator writes:

```text
public/data/healthcare/boundary-healthcare-summaries.json
```

Materialized summaries are keyed by boundary level and official ID:

```text
summaries.state[GEOID]
summaries.county[GEOID]
summaries.local_jurisdiction[GEOID]
```

Supported boundaries without assigned facilities use `noAssignedFacilityPolicy`
and `metadata.noAssignedBoundaryCounts` instead of duplicate expanded records.

Each materialized boundary summary includes assigned facility counts,
valid-coordinate counts, facility type counts, data completeness notes,
missing-data warnings, source coverage notes and status values such as
`has_facilities`, `no_assigned_facilities` and `limited_data`.

`no_assigned_facilities` means HRSA site coverage is not loaded for the
boundary in the current data. It does not mean zero healthcare. Sparse coverage
is marked as limited data.

The choropleth uses generated boundary summaries keyed by official GEOID. Its
categories show more, some or few mapped HRSA sites; coverage not loaded; or
limited data. They are site-count coverage bands, not access or medical-quality comparisons.

For the full workflow and field definitions, see
`docs/boundary-healthcare-summaries.md` from the project root.

The New Jersey pilot template also includes optional review columns supported by
the staging workflow and app schema:

```text
postalCode,sourceId,sourceDataset,sourceLastUpdated,isDemoData
```

Use these only when the source supports them. Leave `isDemoData` blank for real
pilot rows.

## Review, Stage and Promote Workflow

Use the staged workflow before changing production healthcare data:

1. Place the source CSV in `public/data/healthcare/imports/pilot-nj/` or another `imports/` folder.
2. Run source review.
3. Stage the import.
4. List staged records.
5. Review staged records with the review command.
6. Promote approved records.
7. Validate production healthcare data.
8. Run the end-to-end healthcare pipeline check.
9. Run `npm run check` and `npm run build`.

Review a source CSV before staging it:

```bash
npm run review:healthcare-source -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ
```

Write or update the review metadata only when you want the source readiness
panel to track that review:

```bash
npm run review:healthcare-source -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ --write-review
```

The review script never writes to `facilities.json`. It counts rows, names,
coordinates, contact fields, source information, price information, insurance
information, hours and likely duplicates. Missing price, insurance or hours
reduce score confidence but do not block import when those fields are honestly
unknown.

Dry-run staging without changing `facilities.staged.json`:

```bash
npm run stage:healthcare -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ
```

Write staged candidate records without changing `facilities.json`:

```bash
npm run stage:healthcare -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ --write
```

Validate staged records:

```bash
npm run validate:healthcare:staging
```

List staged records:

```bash
npm run list:healthcare:staging
npm run list:healthcare:staging -- --status=pending_review
```

Review staged records without writing first:

```bash
npm run review:healthcare:staged -- --id=staged-123 --status=approved --notes="Source checked"
```

Write the review update only after the dry run looks right:

```bash
npm run review:healthcare:staged -- --id=staged-123 --status=approved --notes="Source checked" --write
```

Keep missing fields unknown unless a source backs the value. Do not approve
demo/sample-looking records.

Dry-run promotion:

```bash
npm run promote:healthcare:staging
```

Promote approved records only when ready:

```bash
npm run promote:healthcare:staging -- --write
```

The promotion script never silently overwrites existing production IDs. It skips
pending, rejected, needs-more-source-info, demo-looking, invalid and duplicate
records. It writes `staging/latest-promotion-report.json` only in write mode.

After promotion, validate production data:

```bash
npm run validate:healthcare:sources
npm run validate:healthcare:staging
npm run validate:healthcare
```

## End-to-end Healthcare Pipeline Check

Run the safe fixture-based pipeline check when healthcare import, staging,
review, promotion or validation scripts change:

```bash
npm run check:healthcare-pipeline
```

The check reviews `test-fixtures/healthcare-pipeline-fixture.csv`, stages it to
`test-fixtures/tmp/`, approves one temporary staged record, leaves another
unapproved, dry-runs promotion, writes promoted records only to a temporary
production-style output, validates that temporary output, and confirms the real
`facilities.json` and `staging/facilities.staged.json` did not change.

The fixture records are clearly fake and marked as demo/test data. They are
allowed only in the temporary pipeline output so the workflow can be tested
without adding fake healthcare records to production.

Validate demo data separately when needed:

```bash
npm run validate:healthcare:demo
node scripts/validateHealthcareFacilities.mjs public/data/healthcare/facilities.sample.json --allow-demo
```

Then run the app build:

```bash
npm run check
npm run build
```

Legacy direct import scripts remain available for controlled maintenance, but
new source-backed records should go through source review, staging validation,
manual review and promotion before they become production healthcare data.

## Official-source Imports

Place manually downloaded official source files in `public/data/healthcare/imports/`. Use documented public sources only, such as HRSA/community health center data, government open data portals, or other traceable datasets.

Preview an HRSA-style source file without changing `facilities.json`:

```bash
npm run import:official-healthcare -- --source=hrsa --input=public/data/healthcare/imports/hrsa-sample.csv
```

Write normalized records only when you are ready to update the app-ready dataset:

```bash
npm run import:official-healthcare -- --source=hrsa --input=public/data/healthcare/imports/hrsa-sample.csv --write
```

Sample or demo imports should be written to `facilities.demo.json` instead of production:

```bash
npm run import:official-healthcare -- --source=hrsa --input=public/data/healthcare/imports/hrsa-sample.csv --output=public/data/healthcare/facilities.demo.json --write
```

Use `--merge` when you intentionally want to combine imported records with the existing `facilities.json` records:

```bash
npm run import:official-healthcare -- --source=hrsa --input=public/data/healthcare/imports/hrsa-sample.csv --merge --write
```

After an official-source import, validate the data and build the app:

```bash
npm run validate:healthcare
npm run build
```

Official imports preserve only fields supported by the source. Unknown hours, prices, services, insurance, accessibility, and cost fields should stay unknown or blank because CareAtlas should not estimate them.

Demo official-source import reports are written to `imports/latest-demo-import-report.json`. Production-looking reports should only describe real production imports.

## New Jersey Pilot Data

The New Jersey pilot import folder is:

```text
public/data/healthcare/imports/pilot-nj/
```

Place the real pilot CSV at:

```text
public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv
```

Use the blank template in that folder to keep columns aligned:

```text
public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.template.csv
```

Only source-backed fields should be filled. Unknown hours, prices, services,
insurance acceptance, accessibility details or coordinates should stay blank or
unknown. Do not mix demo rows into production `facilities.json`. Do not invent
facility names, coordinates, services, insurance details, prices or hours.

Recommended real-data workflow:

1. Place the real source-backed CSV at `public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv`.
2. Run `npm run healthcare:pilot-nj:review-source` to review source readiness.
3. Write source review metadata with `npm run healthcare:pilot-nj:review-source -- --write-review` when the review is acceptable.
4. Run a dry-run staging import with `npm run healthcare:pilot-nj:stage`.
5. Write staged candidate records with `npm run healthcare:pilot-nj:stage -- --write`.
6. List staged records with `npm run healthcare:pilot-nj:list-staged`.
7. Review approved or rejected candidates with `npm run healthcare:review-staged`.
8. Run `npm run healthcare:validate-staging`.
9. Dry-run promotion with `npm run healthcare:pilot-nj:promote`.
10. Promote approved records with `npm run healthcare:pilot-nj:promote -- --write`.
11. Run `npm run healthcare:pilot-nj:validate` and `npm run validate:healthcare`.
12. Run `npm run check:healthcare-pipeline`.
13. Run `npm run check` and `npm run build`.
14. Manually test with `npm run dev`.

Dry-run the pilot staging import without changing production data:

```bash
npm run stage:healthcare -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ
```

Write the pilot CSV to staging only when it contains real source-backed rows:

```bash
npm run stage:healthcare -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ --write
```

The same commands are available through the pilot aliases:

```bash
npm run healthcare:pilot-nj:review-source
npm run healthcare:pilot-nj:review-source -- --write-review
npm run healthcare:pilot-nj:stage
npm run healthcare:pilot-nj:stage -- --write
```

Validate staging and promote approved records:

```bash
npm run list:healthcare:staging
npm run review:healthcare:staged -- --id=staged-123 --status=approved --notes="Source checked"
npm run review:healthcare:staged -- --id=staged-123 --status=approved --notes="Source checked" --write
npm run validate:healthcare:staging
npm run promote:healthcare:staging
npm run promote:healthcare:staging -- --write
```

Pilot writes create:

```text
public/data/healthcare/staging/latest-promotion-report.json
```

Validate production healthcare data after importing:

```bash
npm run validate:healthcare:pilot-nj
npm run validate:healthcare
```

Then run the standard project check:

```bash
npm run check
```

Manual app testing remains browser-based for the human user:

```bash
npm run dev
```

Open `/`, confirm empty production data still works when no pilot records
are loaded, and confirm pilot/source badges appear after a source-backed NJ
pilot CSV is imported.

## Local Demo Mode

CareAtlas loads the generated New Jersey production shard on the public map by
default. To load demo healthcare records locally, create a local `.env` file or
set the Vite variable before starting the dev server:

```text
VITE_HEALTHCARE_DATA_MODE=demo
```

Restart `npm run dev` after changing the variable. Demo mode loads `/data/healthcare/facilities.demo.json` and the UI shows a visible "Demo healthcare data mode" label.

## Data Honesty

CareAtlas is a public health mapping tool. It does not provide medical advice, diagnosis, treatment guidance, or patient-specific recommendations.

Hours, prices, insurance acceptance, services, accessibility information, and verification status must be source-backed. Mark records `needs_review` or `unverified` when details are incomplete. Keep demo/sample data separate from real `facilities.json`.
