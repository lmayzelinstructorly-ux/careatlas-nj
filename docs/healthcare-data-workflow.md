# Healthcare Data Workflow

This is the beginner-safe path for adding real, source-backed healthcare site
records to CareAtlas.

Production healthcare data must be real and source-backed. Demo, sample, fixture,
test, placeholder or invented records must stay out of production.

For the current production coverage summary, see
`docs/healthcare-production-coverage.md`.

## Current Production Coverage

Current production data contains 1,967 HRSA health center service delivery and
look-alike site records across the states listed in
`public/data/healthcare/coverage-summary.json`. The records come from the
official federal HRSA Health Center Service Delivery and Look-Alike Sites
dataset. This is not a complete list of healthcare providers. All 1,967
production records have valid source-provided coordinates. Verified
services, daily hours, insurance details, cost or sliding-fee details,
accessibility fields and field-level enrichment provenance are absent. Phone is
present for 1,965 records and website for 992, so neither contact field is
universal.

Identity, address, source and map availability remain useful. Missing fields are uncertainty, not zero or negative evidence.

## Where Files Live

- Production app data: `public/data/healthcare/facilities.json`
- Generated New Jersey public-map shard: `public/data/healthcare/by-state/34.json`
- Generated production coverage summary: `public/data/healthcare/coverage-summary.json`
- Local demo data: `public/data/healthcare/facilities.demo.json`
- Schema/sample examples: `public/data/healthcare/facilities.sample.json`
- CSV entry template: `public/data/healthcare/facilities.template.csv`
- Raw or cleaned import CSVs: `public/data/healthcare/imports/`
- New Jersey pilot imports: `public/data/healthcare/imports/pilot-nj/`
- Official HRSA refresh CSVs: `public/data/healthcare/imports/hrsa/refresh/`
- New Jersey pilot template: `public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.template.csv`
- Source review tracking: `public/data/healthcare/imports/source-reviews.json`
- Staged candidate records: `public/data/healthcare/staging/facilities.staged.json`
- Pipeline-only fake fixtures: `public/data/healthcare/test-fixtures/`
- Read-only HRSA audit reports: `docs/reports/hrsa-refresh-audit-YYYY-MM-DD.md`
- Human HRSA refresh review packets: `docs/reports/hrsa-refresh-review-packet-YYYY-MM-DD.md`
- Facility-boundary assignments: `public/data/healthcare/facility-boundary-assignments.json`
- Boundary healthcare summaries: `public/data/healthcare/boundary-healthcare-summaries.json`

The imports, source-review metadata, staging records, reports, demo/sample
files, templates and test fixtures above are local pipeline inputs only.
Pipeline files under `public/data` are not copied by `npm run build`, and audit
reports remain under `docs/reports`, outside the public tree. Only the generated
New Jersey facility shard, `coverage-summary.json`,
`facility-boundary-assignments.json` and `boundary-healthcare-summaries.json`
from the healthcare folder are published. Never deploy `public/` directly;
deploy the validated `dist/` output.

`facilities.json` may be empty. Empty production data is safer than production
data that includes guessed, demo or unsupported records.

The coverage summary is generated from `facilities.json`; it is not a second
place to maintain healthcare claims manually. After production promotion,
regenerate it with `npm run generate:healthcare-coverage-summary -- --write`
and verify it with `npm run validate:healthcare-coverage-summary`. Validation
fails when loaded states, facility counts, sources, datasets, facility types,
coordinates or date coverage disagree with source-backed production records.
Also run `npm run build:nj-healthcare-facilities` after production promotion.
The public map shard is generated from `facilities.json`; it is not a separate
source of healthcare records.

## How Healthcare Data Appears In The App

CareAtlas loads the lightweight generated `coverage-summary.json` when
`/map` starts so users immediately see that production HRSA site coverage is
limited to the generated loaded-state scope. It does not load the full production
`facilities.json` until healthcare intent, such as turning on facility markers
or opening the facility explorer, report, filters or data tools. It
loads `boundary-healthcare-summaries.json` when a user requests selected-boundary
healthcare details or enables the healthcare choropleth. The assignment file is
used to generate and validate summaries and is not fetched by the browser.

Deferring these files keeps roughly 5.57 MB of JSON parsing and about 271 KB of
gzip transfer out of initial map startup. Filtering and auditing all
1,967 records also wait until the facility data is requested. If
`facilities.json` is empty, the map should still load normally, the healthcare
marker toggle explains that no production healthcare centers are loaded, and
Facility Explorer shows a production-empty state instead of fake facilities.

Facility Explorer uses neutral name, facility-type or source-recency order. Records without
valid latitude and longitude can still appear in the explorer and report cards,
but they cannot appear as map markers or be zoomed to.

The healthcare workspace also shows the generated production coverage. Missing
markers outside loaded states mean coverage is not loaded there yet; they must
not be presented as proof that no healthcare exists.

Map markers appear only when the healthcare marker layer is turned on and the
matching facility records have valid coordinates. Marker filters and Facility Explorer filters use the same filtering utilities, so a filter that
removes all matches should show an empty state instead of inventing nearby
options.

Facility record views keep identity, address, source, verification and known availability fields clear. Missing categories remain visible.

Demo data is separate. To preview the flow locally with sample records, run the
app with `VITE_HEALTHCARE_DATA_MODE=demo`. Do not copy records from
`facilities.demo.json`, `facilities.sample.json` or `test-fixtures/` into
production.

## Missing-data behavior

Missing fields are never interpreted as zero or negative evidence. Services, daily hours, insurance acceptance, cost and accessibility details stay unknown until a location-specific source supports them.

## The Safe Path

1. Put the real source CSV in `public/data/healthcare/imports/` or a subfolder.
2. Review the CSV source and readiness.
3. Stage normalized candidate records.
4. List staged records.
5. Review each staged record with a dry run.
6. Approve, reject or mark records as needing more source information.
7. Validate staging.
8. Dry-run promotion.
9. Promote approved records with `--write`.
10. Validate production and run project checks.

Do not edit `facilities.json` by hand for normal imports. Use staging and
promotion so the safety checks can stop demo, duplicate, invalid or unsupported
records before they reach production.

## Future Source Checklist

Before adding another healthcare source:

1. Choose official data, facility websites or health-system location pages first.
2. Treat public directories as discovery-only unless an approved source verifies
   the exact field and field-level provenance is recorded.
3. Use Google Search or Google Maps only to discover candidate official sources;
   Google place metadata, ratings, reviews, review summaries and patient comments
   are not production enrichment inputs.
4. Verify every candidate value against an allowed source before staging it.
5. Preserve source metadata for each record and field-level provenance for each
   enriched field.
6. Stage records before production.
7. Review and approve records before promotion.
8. Validate after promotion.
9. Keep missing data unknown.
10. Never invent coordinates, hours, services, prices, reviews or insurance details.

## Enrichment Sources

Richer healthcare records may come from traceable official sources, including
official facility or health-system location pages and federal, state or local
open-data portals. Approved nonprofit directories or commercial APIs may
support a field only when current policy permits that source, the exact field is
independently reviewable and field-level provenance is stored. Otherwise, treat
directories and APIs as discovery-only.

Google Search or Google Maps may help discover candidate official source pages
for manual review. Google place metadata, ratings, reviews, review summaries
and patient comments are not allowed production enrichment inputs under the
current policy. Reviews, ratings and patient comments must not be copied into
production or converted into medical-quality or other quality evidence.

When enriching a facility, prefer source fields in this order:

1. Facility or health-system location page.
2. Official public data or regulated directory.
3. Approved nonprofit directory with exact field-level provenance; otherwise
   discovery-only.
4. Approved non-Google API metadata with exact field-level provenance and the
   API/source named in `sourceInfo`.

Facility-level `sourceInfo` proves the base record source. It is not enough for
services, daily hours, insurance, cost/sliding-fee details or accessibility.
Every nonempty enriched field must have a matching `fieldSources.<field>` entry
with `field`, `status`, exact `sourceUrl`, `sourceTitle` or `sourceLabel`,
`checkedDate`, `sourceType` and `locationSpecific: true`. A general
organization page cannot prove location-specific services, hours, insurance,
cost or accessibility for every site. If a source does not verify a detail,
leave it unknown.

New field-level enrichment should use `fieldSources` entries for `services`,
`hours`, `insurance`, `cost`, `accessibility`, and future `languages` or
`acceptingPatients` fields if they are added. Staging may use `needs_review`
only while a reviewer is checking a source. Production promotion accepts only
`source_backed` entries with complete field-level provenance. A missing entry
means the source did not provide that field; it does not authorize inference.

CSV staging accepts this object in a quoted `fieldSources` or `enrichment
sources` JSON column. Keep fixture examples in `test-fixtures/`; do not add
made-up enrichment to production.

Allowed enrichment sources are official facility or health-system pages and
federal, state or local public portals. An approved nonprofit directory or
non-Google API may support a field only when current policy permits it and exact
field-level provenance is stored; otherwise it is discovery-only. Banned
production inputs include Google place metadata, ratings, reviews, review
summaries, patient comments, scraped map or review pages, unattributed lists and
model-generated guesses. Never infer services, insurance, cost, hours or
accessibility, and never turn enrichment into medical-quality evidence.

The fixture check `npm run check:healthcare-enrichment-provenance` covers valid
and invalid source examples, including missing service provenance, undated
hours, organization-wide insurance pages, exact accessibility URLs, banned
Google/Yelp/review sources and blank unknown fields. It is included in
`npm run validate:healthcare`.

### Dataset-derived enrichment generators

Two generators derive enrichment inputs from facts an official dataset row
itself supports, without inference:

- `npm run generate:hrsa-enrichment` — Medicaid/uninsured access and sliding
  fee availability from an HRSA Health Center Program designation, plus
  Medicare only when the row lists an FQHC Medicare billing number.
- `npm run generate:cms-medicare-enrichment` — Medicare registration for
  hospitals listed in the official CMS Hospital General Information CSV. Every
  row in that dataset is a Medicare-registered hospital, so the generator
  asserts only `acceptsMedicare` with an insurance note naming the CMS
  certification number and hospital type. Veterans Health Administration and
  Department of Defense hospitals are skipped because their listing does not
  mean they bill Medicare or serve the general public; their insurance stays
  unknown. Generated input lives under
  `public/data/healthcare/imports/cms/enrichment/` and is applied with
  `npm run apply:healthcare-enrichment -- --input=... --write` after a dry-run
  review.

### Automated refresh

`npm run refresh:healthcare-data` downloads the latest official CMS Hospital
General Information CSV and HRSA Health Center Service Delivery and Look-Alike
Sites CSV, regenerates both dataset-derived enrichment inputs with today's
checked date, applies them through the provenance-validated enrichment
pipeline (only unknown fields are filled; existing source-backed values and
verificationStatus are never touched), refreshes HRSA weekly operating-hours
notes, regenerates boundary assignments, boundary summaries and the coverage
summary, rebuilds the New Jersey public-map shard, and reruns the audits plus
`npm run check`. Flags: `--skip-cms`,
`--skip-hrsa`, `--skip-checks`.

The scheduled GitHub Actions workflow
`.github/workflows/healthcare-data-refresh.yml` runs this every Monday (and on
manual dispatch), then commits and pushes the refreshed data to `main` only
when the full check suite and build pass. New facilities appearing in the
source data are not auto-imported; importing new records stays in the staged
review pipeline below.

## Script Names

The older script names remain available. These beginner aliases point to the
same workflow:

```bash
npm run healthcare:review-source -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ
npm run healthcare:stage -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ
npm run healthcare:list-staged
npm run healthcare:review-staged -- --id=staged-123 --status=approved --notes="Source checked"
npm run healthcare:validate-staging
npm run healthcare:promote-staged
npm run healthcare:validate-production
npm run healthcare:check-pipeline
npm run audit:hrsa-refresh -- --input=public/data/healthcare/imports/hrsa/refresh/hrsa-official-YYYY-MM-DD.csv --states=CT,DC,DE,MA,MD,ME,NH,NJ,NY,PA,RI,VA,VT
npm run check:hrsa-refresh-audit
npm run healthcare:pilot-nj:review-source
npm run healthcare:pilot-nj:stage
npm run healthcare:pilot-nj:list-staged
npm run healthcare:pilot-nj:promote
npm run healthcare:pilot-nj:validate
npm run assign:facility-boundaries -- --write
npm run validate:facility-boundaries
npm run generate:boundary-healthcare-summaries -- --write
npm run validate:boundary-healthcare-summaries
npm run generate:healthcare-coverage-summary -- --write
npm run validate:healthcare-coverage-summary
```

## Import And Source Review

Start with a dry source review:

```bash
npm run healthcare:review-source -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ
```

Write the source review only when you want it tracked by the app workflow:

```bash
npm run healthcare:review-source -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ --write-review
```

Source review never writes to `facilities.json`. It checks whether rows have
names, coordinates, contact fields, source information, price information,
insurance information, hours and likely duplicates.

Unknown prices, hours, insurance, accessibility and services should stay blank
or unknown unless the source supports them.

Do not invent facility names, coordinates, services, insurance details, prices
or hours. Every row should include source information such as `sourceName`,
`sourceUrl` and `sourceLastChecked` when those fields are available. Unknown
boolean fields should stay blank. Unknown `priceLevel` should be `unknown`.

## New Jersey Pilot Intake

For the first real source-backed pilot source decision, see
`docs/healthcare-pilot-source-plan.md`. The current recommendation is a small,
hand-reviewed New Jersey subset of HRSA Health Center Service Delivery and
Look-Alike Sites records, moved through the existing source review, staging,
approval, promotion and validation workflow.

Place the real source-backed pilot CSV at:

```text
public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv
```

Start from the blank header-only template:

```text
public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.template.csv
```

The template includes only app/schema or staging-supported fields:

```text
id,name,facilityType,address,city,state,stateFips,county,countyFips,postalCode,latitude,longitude,phone,website,services,monday,tuesday,wednesday,thursday,friday,saturday,sunday,hoursNotes,priceLevel,acceptsSlidingScale,estimatedVisitCost,priceNotes,acceptsMedicaid,acceptsMedicare,acceptsUninsured,insuranceNotes,accessibilityInfo,sourceName,sourceUrl,sourceLastChecked,sourceNotes,sourceId,sourceDataset,sourceLastUpdated,lastVerified,verificationStatus,isDemoData,fieldSources
```

Use `verificationStatus=needs_review` until a human reviewer has checked the
row. Leave `isDemoData` blank for real pilot data.

The New Jersey pilot commands are HRSA-specific aliases. They preserve the
facility-level source name as `HRSA Health Center Service Delivery and
Look-Alike Sites`, keep HRSA source IDs and dataset/update dates when present,
and stage records before production promotion. They do not geocode addresses.
If HRSA rows have names and addresses but no verified coordinates, leave
`latitude` and `longitude` blank and mark the staged record
`needs_more_source_info` until coordinates are added from a source-backed field
or a documented manual review.

The source review and staging scripts flag missing names, missing source
metadata, missing coordinates, malformed coordinates, coordinates outside the
official New Jersey state boundary extent, unsupported facility types, suspicious
demo/sample labels and CSV fields that are not mapped into the current
CareAtlas schema. Unmapped fields are review warnings; do not copy their
values into production unless the schema and docs are deliberately updated.

Exact pilot workflow:

1. Add the real CSV at `public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv`.
2. Run `npm run healthcare:pilot-nj:review-source`.
3. If the source review is acceptable, run `npm run healthcare:pilot-nj:review-source -- --write-review`.
4. Run `npm run healthcare:pilot-nj:stage`.
5. If the staging preview is acceptable, run `npm run healthcare:pilot-nj:stage -- --write`.
6. Run `npm run healthcare:pilot-nj:list-staged`.
7. Dry-run staged review with `npm run healthcare:review-staged -- --id=staged-123 --status=approved --notes="Source checked"`.
8. Save the staged review with `npm run healthcare:review-staged -- --id=staged-123 --status=approved --notes="Source checked" --write`.
9. Use `--status=rejected` or `--status=needs_more_source_info` for records that should not be promoted.
10. Run `npm run healthcare:validate-staging`.
11. Dry-run promotion with `npm run healthcare:pilot-nj:promote`.
12. Promote approved records with `npm run healthcare:pilot-nj:promote -- --write`.
13. Run `npm run healthcare:pilot-nj:validate`.
14. Run `npm run validate:healthcare`.
15. Run `npm run check:healthcare-scoring`.
16. Run `npm run check:healthcare-score-trust`.
17. Run `npm run check:healthcare-quality`.
18. Run `npm run check:healthcare-pipeline`.
19. Run `npm run generate:healthcare-coverage-summary -- --write`.
20. Run `npm run validate:healthcare-coverage-summary`.
21. Run `npm run check`.
22. Run `npm run build` and `npm run validate:production-dist`.

Promotion requires approved, real, source-backed records with valid coordinates.
Records without valid coordinates may be staged and reviewed, but they will not
be promoted into production map data.

## Read-Only HRSA Refresh Audit

Download the official **HRSA Health Center Service Delivery and Look-Alike
Sites** CSV without editing or filling its missing values. Keep the dated source
file under:

```text
public/data/healthcare/imports/hrsa/refresh/hrsa-official-YYYY-MM-DD.csv
```

Dry-run the loaded-state audit first:

```bash
npm run audit:hrsa-refresh -- --input=public/data/healthcare/imports/hrsa/refresh/hrsa-official-YYYY-MM-DD.csv --states=CT,DC,DE,MA,MD,ME,NH,NJ,NY,PA,RI,VA,VT
```

The audit matches records by normalized HRSA `sourceId` and reports matched
production records, new upstream IDs, production IDs missing upstream,
duplicate IDs in either file, field changes, coordinate issues and per-state
counts. Changes are grouped as identity, address/location, phone/website,
coordinates and status/type. Status details embedded in existing source notes
are compared only when both records contain the source-backed value.

To preserve the output for review, rerun with `--write`:

```bash
npm run audit:hrsa-refresh -- --input=public/data/healthcare/imports/hrsa/refresh/hrsa-official-YYYY-MM-DD.csv --states=CT,DC,DE,MA,MD,ME,NH,NJ,NY,PA,RI,VA,VT --write
```

The only write is
`docs/reports/hrsa-refresh-audit-YYYY-MM-DD.md`. Audit reports, official CSVs
and fixtures are excluded from production `dist`. The audit does not modify
`public/data/healthcare/facilities.json`, stage candidates, approve records,
promote additions or remove missing-upstream records.

Interpret every category as a manual review queue:

- Additions may be future candidates only after source and duplicate review.
- Missing-upstream production records are not removal instructions; verify
  official status and scope first.
- Changed fields require field-by-field source review before any update.
- Duplicate IDs, invalid coordinates and state-bound failures must be resolved
  from official source evidence. Do not infer replacements.

Run `npm run check:hrsa-refresh-audit` to verify the fixture coverage. Any
future production refresh must use the normal staged review, explicit human
approval, healthcare validation and generation workflow after the audit.

### HRSA Refresh Review Packet

After writing a dated audit report, create a human-review packet before any
staging or promotion:

```bash
npm run create:hrsa-refresh-review-packet -- --audit-report=docs/reports/hrsa-refresh-audit-YYYY-MM-DD.md
```

The packet writes
`docs/reports/hrsa-refresh-review-packet-YYYY-MM-DD.md`. It expands the audit
into reviewer queues for upstream additions, production records missing
upstream and changed records. It includes state counts, contact and website
gaps, coordinate/boundary review flags, likely duplicate signals and a
recommended manual action for each addition.

Use the packet as a review gate, not an import source. Do not refresh
automatically from the audit. Review additions manually, starting with the
largest state queue; verify production records missing upstream against HRSA
source history; review coordinate changes that could affect boundary
assignment; then stage and promote only records that have been reviewed and
approved state by state. Regenerate facility-boundary assignments, boundary
healthcare summaries and coverage summary only after reviewed production
promotion.

When a refresh shows New Jersey as the largest additions queue, create or read a
focused NJ additions worksheet before staging any NJ records. Treat exact
address matches, same-name nearby records, missing critical contact fields and
same-address multi-ID groups as manual holds until a human source review
resolves them.

Review packets are documentation artifacts under `docs/reports`; they are not
copied to production `dist`. The raw HRSA CSV, audit reports, review packets,
fixtures and staging files remain local workflow artifacts.

## Regional HRSA Expansion Workflow

Add only one state at a time. Download or verify the official **HRSA Health
Center Service Delivery and Look-Alike Sites** CSV, keep the state subset in
`public/data/healthcare/imports/hrsa/<state>/`, and never fill missing fields by
guessing. The review and staging dry runs compare coordinates with the official
state extent in `public/data/us-states.geojson`, flag rows whose state does not
match `--state`, and warn about missing coordinates, missing source metadata,
unsupported fields, and likely duplicates against production.

The `healthcare:hrsa:*` commands supply the official HRSA source name and source
type. You still provide the CSV path and two-letter state abbreviation. Dry runs
do not change production or staging files.

### Pennsylvania example

1. Put the verified official CSV at
   `public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv`.
2. Review it without writing:

   ```bash
   npm run healthcare:hrsa:review-source -- --input=public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv --state=PA
   ```

3. Write the source review after reading every warning:

   ```bash
   npm run healthcare:hrsa:review-source -- --input=public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv --state=PA --write-review
   ```

4. Preview staging:

   ```bash
   npm run healthcare:hrsa:stage -- --input=public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv --state=PA
   ```

5. Write staged records:

   ```bash
   npm run healthcare:hrsa:stage -- --input=public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv --state=PA --write
   ```

### New York example

Use the same sequence with the New York path and state code:

```bash
npm run healthcare:hrsa:review-source -- --input=public/data/healthcare/imports/hrsa/ny/hrsa-ny.csv --state=NY
npm run healthcare:hrsa:review-source -- --input=public/data/healthcare/imports/hrsa/ny/hrsa-ny.csv --state=NY --write-review
npm run healthcare:hrsa:stage -- --input=public/data/healthcare/imports/hrsa/ny/hrsa-ny.csv --state=NY
npm run healthcare:hrsa:stage -- --input=public/data/healthcare/imports/hrsa/ny/hrsa-ny.csv --state=NY --write
```

### Review, promotion, and regeneration for either state

Continue only after staging one state. Replace the example staging IDs below
with IDs printed by the list command. Never approve every row automatically.

```bash
# 6. List staged records for the state.
npm run healthcare:list-staged -- --state=PA

# 7. Preview, then save an approval for a verified row.
npm run healthcare:review-staged -- --id=staged-example-id --status=approved --notes="Official HRSA row and coordinates checked"
npm run healthcare:review-staged -- --id=staged-example-id --status=approved --notes="Official HRSA row and coordinates checked" --write

# Reject a duplicate/unsupported row, or hold a questionable row for more source information.
npm run healthcare:review-staged -- --id=staged-duplicate-id --status=rejected --notes="Duplicate of production record" --write
npm run healthcare:review-staged -- --id=staged-questionable-id --status=needs_more_source_info --issue="Coordinates or source metadata need verification" --write

# 8. Validate staging.
npm run validate:healthcare:staging

# 9. Preview promotion.
npm run healthcare:promote-staged

# 10. Promote only approved, unblocked records.
npm run healthcare:promote-staged -- --write

# 11. Regenerate and validate facility-boundary assignments.
npm run assign:facility-boundaries -- --write
npm run validate:facility-boundaries

# 12. Regenerate and validate boundary healthcare summaries.
npm run generate:boundary-healthcare-summaries -- --write
npm run validate:boundary-healthcare-summaries

# 13. Regenerate and validate the healthcare coverage summary.
npm run generate:healthcare-coverage-summary -- --write
npm run validate:healthcare-coverage-summary

# 14. Run healthcare and project checks.
npm run check:healthcare-pipeline
npm run validate:healthcare
npm run validate:healthcare:staging
npm run check
npm run build
```

For New York, use `--state=NY` when listing staged records. The promotion
command considers all approved staged records, so keep unrelated approvals out
of staging while processing a state. The original `healthcare:pilot-nj:*`
aliases remain supported for the New Jersey pilot.

The first regional production expansion completed this workflow for PA and NY
on 2026-06-21. See `docs/healthcare-pa-ny-promotion-report.md` for source dates,
promoted counts, and the five rows deliberately held from production.

After PA/NY passed all checks, the same workflow added DE and CT. See
`docs/healthcare-de-ct-promotion-report.md` for counts and held-row reasons.

## Stage Candidate Records

Dry-run staging first:

```bash
npm run healthcare:stage -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ
```

Write to staging only after the preview looks right:

```bash
npm run healthcare:stage -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ --write
```

Staging writes candidate records to
`public/data/healthcare/staging/facilities.staged.json`, not production.

## Review Staged Records

List records that need review:

```bash
npm run healthcare:list-staged -- --status=pending_review
```

Preview an approval without writing:

```bash
npm run healthcare:review-staged -- --id=staged-123 --status=approved --notes="Source checked"
```

Save the approval only after checking the preview:

```bash
npm run healthcare:review-staged -- --id=staged-123 --status=approved --notes="Source checked" --write
```

Use rejection or more-source-info statuses when a record should not be promoted:

```bash
npm run healthcare:review-staged -- --id=staged-123 --status=rejected --notes="Duplicate or unsupported record" --write
npm run healthcare:review-staged -- --id=staged-456 --status=needs_more_source_info --issue="Source page does not confirm coordinates" --write
```

Approve a record only when it is real, source-backed, safe for map display and
not demo/sample-looking.

## Promote To Production

Validate staging before promotion:

```bash
npm run healthcare:validate-staging
```

Dry-run promotion:

```bash
npm run healthcare:promote-staged
```

Promote approved records:

```bash
npm run healthcare:promote-staged -- --write
```

Promotion skips records that are not approved, duplicate production IDs, invalid
records, records without valid map coordinates, records without source metadata,
records with blocker staging issues and demo/sample-looking records.

## Validate After Promotion

Run these checks after production promotion:

```bash
npm run validate:healthcare
npm run validate:healthcare:staging
npm run check:healthcare-scoring
npm run check:healthcare-score-trust
npm run check:healthcare-quality
npm run check:healthcare-pipeline
npm run generate:healthcare-coverage-summary -- --write
npm run validate:healthcare-coverage-summary
npm run check
npm run build
```

`npm run validate:healthcare` checks production `facilities.json`, healthcare
scoring, healthcare data quality, source reviews and enrichment provenance
fixtures. Production validation fails if production contains demo records,
demo-looking records, records without facility-level source metadata, or any
enriched field without complete source-backed field-level provenance.

## Demo Data Rules

Demo records belong in `facilities.demo.json`, `facilities.sample.json` or
`test-fixtures/`, depending on the use case. They must not be promoted to
production.

Use demo validation only for demo files:

```bash
npm run validate:healthcare:demo
node scripts/validateHealthcareFacilities.mjs public/data/healthcare/facilities.sample.json --allow-demo
```

The fixture pipeline intentionally uses fake data, but it writes only to
`public/data/healthcare/test-fixtures/tmp/` and verifies that real production and
staging files did not change.

## Enrichment Application (existing records)

Use the dry-run enrichment plan workflow to validate proposed field-level
enrichment for facilities that already exist in production. The planner compares
the input against matching production records, validates source-backed
field-level provenance, reports exactly which fields would be eligible, and
skips any field where production already has a usable value.

This workflow never overwrites existing values, never changes
`verificationStatus`, and writes nothing to production `facilities.json`.
Applying enrichment to production is a separate later step.
