# Healthcare Production Data Coverage

Last reviewed: 2026-07-13

This page documents the current production HRSA health center site and CMS
hospital coverage in `public/data/healthcare/facilities.json`. It is not a
complete list of healthcare providers.

The app-facing coverage indicator is generated from that production file at
`public/data/healthcare/coverage-summary.json`. Do not edit its state, source or
count claims by hand. Regenerate and validate it whenever production facilities
change:

```bash
npm run generate:healthcare-coverage-summary -- --write
npm run validate:healthcare-coverage-summary
```

The generated summary remains the source of truth for retained facility data.
The public map loads the production facility file, filters it to New Jersey and
shows source-backed coordinates as progressive clusters. Coverage summaries and
the broader facility controls remain outside the public runtime.

## Current Coverage

- Production status: regional official HRSA/CMS coverage loaded
- Loaded states: Connecticut, Washington, D.C., Delaware, Massachusetts,
  Maryland, Maine, New Hampshire, New Jersey, New York, Pennsylvania, Rhode
  Island, Virginia and Vermont
- Facility types: HRSA community health center service-delivery sites and CMS
  hospitals, kept separate
- Source category: federal official public downloadable datasets
- Sources: HRSA Health Center Service Delivery and Look-Alike Sites and CMS
  Hospital General Information
- Production facilities: 3,920
- HRSA service-delivery sites: 3,201
- CMS hospitals: 719
- Facilities with valid coordinates: 3,920
- Facilities missing coordinates: 0
- New Jersey facilities: 215 total (153 HRSA and 62 CMS)
- New Jersey boundary assignments: 215 state, county and town/township matches,
  with no assignment warnings

This is limited official-source coverage for the generated loaded-state scope,
not complete provider coverage. Coverage not loaded for a state or boundary
does not mean no healthcare exists there.

The records were staged, reviewed, approved and promoted through the healthcare
staging workflow. They were not manually copied into production.

## Available Fields

All 3,920 production records currently include:

- facility ID and name
- facility type `community_health_center` or `hospital`
- street address, city, state, state FIPS, county, county FIPS and postal code
- source-provided latitude and longitude
- source name, source URL, source last checked date, source notes, source ID,
  source dataset and source last updated date
- last verified date
- verification status

Contact fields are not universal: 3,917 records include a phone number and 1,728
include a website. Missing phone or website fields remain unknown.

The HRSA `Operating Hours per Week` value is preserved in `hours.notes` when
available. CMS records remain hospitals and are not counted as primary-care
providers unless another source supports that role.

The 2026-07-13 New Jersey refresh review found 30 HRSA source IDs not already in
production. Fourteen administrative-only locations were excluded from the
patient-facing marker intake. Sixteen service-delivery candidates were staged;
15 were promoted and one exact name/address duplicate remains held as
`needs_more_source_info`.

The PA/NY promotion outcome is documented in
`docs/healthcare-pa-ny-promotion-report.md`. One PA row without a street
address and four NY rows in a duplicate name/address group remain in staging
as `needs_more_source_info`; they are not production records.

The follow-on DE/CT promotion is documented in
`docs/healthcare-de-ct-promotion-report.md`. Four CT rows in two duplicate
name/address groups remain staged as `needs_more_source_info`.

## Missing Or Often Unknown Fields

These fields remain unknown, blank or omitted when the current official source
records do not provide verified values:

- daily operating hours
- services
- prices, sliding-scale details and estimated visit costs unless supported by
  validated field-level provenance
- insurance acceptance unless supported by validated field-level provenance
- accessibility details
- field-level enrichment provenance for fields without verified enrichment

Missing fields should stay unknown until a source supports them. Do not invent
coordinates, hours, services, prices, insurance details or accessibility notes.

## App Interpretation

CareAtlas shows these as source-backed HRSA site records. Reports retain
identity, address, source, verification and availability details, label the
scope as `HRSA health center site record only`, and list missing categories.
Missing data is uncertainty, not evidence of worse access or care.

The map workspace displays the generated loaded-state and source summary. When
a selected state, county or local jurisdiction is outside the loaded states,
the workspace reports HRSA coverage not loaded, never zero healthcare.

If production data is ever empty, the UI and docs should say that no production
healthcare centers have been loaded yet, the system is ready for source-backed
data, the next step is to stage and promote real records, and fake/demo records
must not be added to production.

## Future Source Checklist

Use this checklist before adding another healthcare source:

1. Choose an official or public source first.
2. Treat public directories as discovery-only unless an approved source verifies
   the exact field and field-level provenance is recorded.
3. Google Search or Google Maps may be used only to discover candidate official
   sources. Google place metadata, ratings, reviews, review summaries and patient
   comments are not production enrichment inputs.
4. Preserve source metadata, including source name, URL, last checked date,
   dataset name, source ID and source update date when available.
5. For services, daily hours, insurance, cost/sliding-fee details and
   accessibility, preserve `fieldSources.<field>` with exact source URL, source
   title or label, checked date, allowed source type and location-specific
   support. A general organization page is not enough for location-specific
   fields.
6. Put source files in `public/data/healthcare/imports/` or a documented
   subfolder for local pipeline use. These source files are excluded from the
   validated production `dist`; deploy `dist`, never `public` directly.
7. Run source review before staging records.
8. Stage records before production.
9. Review each staged record and mark it approved, rejected or needing more
   source information.
10. Promote only approved, source-backed records with valid coordinates.
11. Validate after promotion.
12. Keep missing data unknown.
13. Never invent coordinates, hours, services, prices or insurance details.
14. Never copy reviews, ratings or patient comments into production or convert
    them into quality evidence.

## Commands

Use the current package scripts:

```bash
npm run healthcare:review-source -- --input=public/data/healthcare/imports/<source-file>.csv --source-name="<source name>" --source-type=official --state=<STATE>
npm run healthcare:stage -- --input=public/data/healthcare/imports/<source-file>.csv --source-name="<source name>" --source-type=official --state=<STATE>
npm run healthcare:list-staged
npm run healthcare:review-staged -- --id=<stagingId> --status=approved --notes="Source checked"
npm run healthcare:validate-staging
npm run healthcare:promote-staged
npm run healthcare:promote-staged -- --write
npm run validate:healthcare
npm run check:healthcare-quality
npm run check:healthcare-pipeline
npm run generate:healthcare-coverage-summary -- --write
npm run validate:healthcare-coverage-summary
npm run check
```

For the New Jersey HRSA pilot path, use:

```bash
npm run healthcare:pilot-nj:review-source
npm run healthcare:pilot-nj:stage
npm run healthcare:pilot-nj:list-staged
npm run healthcare:pilot-nj:promote
npm run healthcare:pilot-nj:validate
```
