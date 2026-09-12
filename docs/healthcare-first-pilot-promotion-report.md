# First Healthcare Pilot Promotion Report

Date promoted: 2026-06-02

## Source And Geography

- Source name: HRSA Health Center Service Delivery and Look-Alike Sites
- Publisher: HRSA, Bureau of Primary Health Care
- Source catalog URL: https://data.hrsa.gov/data/download/
- Source dataset: Health Center Service Delivery and Look-Alike Sites
- Source last updated date preserved in promoted records: 2026-06-01
- Pilot geography: New Jersey

The promoted records are community health center service delivery sites from
the New Jersey HRSA pilot batch. They were reviewed from
`public/data/healthcare/staging/facilities.staged.json` and promoted through
the existing healthcare staging promotion script. No records were manually
copied into production.

## Review Outcome

- Staged records reviewed: 15
- Approved records: 15
- Rejected records: 0
- Records left unapproved: 0
- Records promoted to production: 15
- Promoted records with valid coordinates: 15
- Promotion skips: 0
- Duplicate warnings: 0

All approved records had real facility names, HRSA source metadata, valid New
Jersey coordinates, allowed `community_health_center` facility type, and no
demo/sample/fake indicators. The only staging issues left on the promoted
records were informational unknown price and insurance notes.

## Approved And Promoted Records

| Facility ID | Facility | City | County |
| --- | --- | --- | --- |
| `hrsa-bps-h80-000065` | Highlands Health Van | Dover | Morris County |
| `hrsa-bps-h80-000131` | CAMCARE - NORTH HEALTH CENTER | Camden | Camden County |
| `hrsa-bps-h80-000158` | BROADWAY CLINIC | Paterson | Passaic County |
| `hrsa-bps-h80-000865` | BUTTONWOOD | Pemberton | Burlington County |
| `hrsa-bps-h80-000945` | PLEASANTVILLE | Pleasantville | Atlantic County |
| `hrsa-bps-h80-001090` | North Hudson Community Action Corporation Health Center @ Jersey City | Jersey City | Hudson County |
| `hrsa-bps-h80-001091` | North Hudson Community Action Corporation Health Center @ Union City | Union City | Hudson County |
| `hrsa-bps-h80-001173` | North Hudson Community Action Corporation Health Center @ West New York | West New York | Hudson County |
| `hrsa-bps-h80-001281` | Shabazz High School | Newark | Essex County |
| `hrsa-bps-h80-001403` | Kids' Corner at Broad St. School | Bridgeton | Cumberland County |
| `hrsa-bps-h80-001442` | CAMCARE - SOUTH HEALTH CENTER | Camden | Camden County |
| `hrsa-bps-h80-001532` | Metropolitan Family Health Network, Inc. at West New York | West New York | Hudson County |
| `hrsa-bps-h80-001647` | CAMCARE - EAST HEALTH CENTER | Camden | Camden County |
| `hrsa-bps-h80-001742` | NEWARK COMMUNITY HEALTH CENTERS, INC. | Newark | Essex County |
| `hrsa-bps-h80-001818` | PATERSON COMMUNITY HEALTH CENTER, INC. | Paterson | Passaic County |

## Rejected Or Left In Review

No staged records were rejected or left unapproved in this batch. The promotion
dry run reported that all 15 approved staged records were eligible for
production promotion.

## Data Gaps That Remain

The HRSA pilot intake did not supply source-backed daily hours, services,
prices, insurance acceptance, estimated visit costs, or accessibility details.
Those fields remain unknown, blank, or omitted according to the schema. The
records preserve HRSA operating hours per week in `hours.notes` when supplied,
but daily hours were not inferred.

These records are map-ready because all 15 promoted records have valid
source-provided coordinates. They should still be presented as public health
access indicators only, not as medical quality claims or advice.

## Promotion Evidence

- Staging review command used for each record: `npm run healthcare:review-staged -- --id=<stagingId> --status=approved --notes="..." --write`
- Staging validation passed after approval: `npm run validate:healthcare:staging`
- Promotion dry run: 15 approved, 15 would promote, 0 skipped, 0 duplicate warnings
- Promotion write: `npm run healthcare:pilot-nj:promote -- --write`
- Promotion report: `public/data/healthcare/staging/latest-promotion-report.json`
- Production output: `public/data/healthcare/facilities.json`
