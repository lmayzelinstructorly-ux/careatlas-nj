# Pennsylvania And New York HRSA Promotion Report

Date promoted: 2026-06-21

## Official Source

- Publisher: HRSA, Bureau of Primary Health Care
- Dataset: Health Center Service Delivery and Look-Alike Sites
- Official download: https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv
- Download response verified: HTTP 200
- Download last-modified header: 2026-06-19
- Source date preserved in promoted records: 2026-06-19

The official file was filtered and mapped one state at a time. Only source
fields were copied. Missing daily hours, services, prices, insurance, and
accessibility details remain unknown.

## Review And Promotion Outcome

| State | Official rows staged | Promoted | Held for more source information |
| --- | ---: | ---: | ---: |
| Pennsylvania | 481 | 480 | 1 |
| New York | 875 | 871 | 4 |

The Pennsylvania hold is HRSA source ID `BPS-H80-000988`, whose official row
has no street address. The field was not guessed or filled manually.

The four New York holds share the same source name and address (`Premium
Health, Inc.`, `4510 16th Ave`). They remain `needs_more_source_info` so the
distinct HRSA source IDs can be reviewed individually before any future
promotion.

The dry-run promotion reported 1,351 new eligible records. The write promoted
all 1,351: 480 PA and 871 NY. Existing approved NJ staging records were skipped
as production duplicate IDs. Production now contains 1,489 facilities across
NJ, NY, and PA.

## Regenerated Outputs

- `public/data/healthcare/facility-boundary-assignments.json`
- `public/data/healthcare/boundary-healthcare-summaries.json`
- `public/data/healthcare/coverage-summary.json`
- `public/data/healthcare/staging/latest-promotion-report.json`

All 1,489 production facilities received boundary assignments and valid map
coordinates. See the task handoff and repository history for the full check
results.
