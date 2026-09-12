# First Healthcare Pilot Staging Report

Date staged: 2026-06-02

## Source

- Source name: HRSA Health Center Service Delivery and Look-Alike Sites
- Publisher: HRSA, Bureau of Primary Health Care
- Source catalog URL: https://data.hrsa.gov/data/download/
- Direct CSV used for this staging batch: https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv
- HRSA page update shown during intake: 2026-06-01
- Pilot geography: New Jersey

This task used the existing New Jersey pilot intake path. No records were
promoted to `public/data/healthcare/facilities.json`.

## Files Written

- Pilot CSV: `public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv`
- Source review metadata: `public/data/healthcare/imports/source-reviews.json`
- Staged candidate records: `public/data/healthcare/staging/facilities.staged.json`

## Staged Batch

15 active New Jersey HRSA service delivery site records were staged for human
review. The batch was selected as a small deterministic pilot subset from
source rows with:

- `Site State Abbreviation=NJ`
- `Site Status Description=Active`
- `Health Center Type Description=Service Delivery Site`
- source-provided latitude and longitude inside the New Jersey pilot bounds
- source-backed site address

All staged records have `stagingStatus=pending_review`.

## Complete Fields

Every staged record includes:

- facility name
- facility type `community_health_center`
- address, city, state, state FIPS, county, county FIPS and postal code
- HRSA geocoding latitude and longitude
- phone
- source name, source URL, source last checked date, source notes, source ID,
  source dataset and source last updated date
- `verificationStatus=needs_review`

Website is present for 14 of 15 records. One staged record has no website in
the HRSA source row.

## Missing Or Unknown Fields

These fields remain missing or unknown because the HRSA intake did not provide
source-backed values for them:

- daily hours
- services
- price details beyond `priceLevel=unknown`
- insurance acceptance
- estimated visit cost
- accessibility details

The HRSA `Operating Hours per Week` value was preserved in `hours.notes` when
present, but daily operating hours were not inferred.

## Review Warnings

The source review metadata records these source-level warnings:

- 15 rows missing insurance information
- 15 rows missing daily hours

The staging workflow flagged every record with:

- `unknown_price_info`
- `unknown_insurance_info`

No staged record was flagged for missing coordinates, invalid coordinates,
coordinates outside the New Jersey pilot bounds, likely duplicates, demo-like
data, or unsupported source fields.

The daily-hours warning is expected: HRSA supplied `Operating Hours per Week`,
which was preserved in staged `hours.notes`, but it did not supply day-by-day
hours.

## Next Review Commands

List staged records:

```bash
npm run healthcare:pilot-nj:list-staged
```

Preview an approval or rejection:

```bash
npm run healthcare:review-staged -- --id=<stagingId> --status=approved --notes="HRSA source row reviewed"
npm run healthcare:review-staged -- --id=<stagingId> --status=rejected --notes="Reason for rejection"
```

Write the review decision:

```bash
npm run healthcare:review-staged -- --id=<stagingId> --status=approved --notes="HRSA source row reviewed" --write
npm run healthcare:review-staged -- --id=<stagingId> --status=rejected --notes="Reason for rejection" --write
```

After review decisions, validate staging:

```bash
npm run healthcare:validate-staging
```

Promotion is intentionally out of scope for this task. A later approval task
should dry-run promotion before any `--write` promotion command is used.
