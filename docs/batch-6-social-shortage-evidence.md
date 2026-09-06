# Batch 6 social-barrier and shortage evidence

Batch 6 adds source-backed evidence to the New Jersey tract foundation. It does
not define a threshold, combine the sources into a weighted score or classify a
tract as an access gap.

## Reviewed source contracts

### CDC/ATSDR SVI

- Dataset: CDC/ATSDR Social Vulnerability Index 2022 New Jersey database
- Geography key: `FIPS`, preserved as an 11-digit Census tract GEOID
- Measures: `RPL_THEMES`, `RPL_THEME1`, `RPL_THEME2`, `RPL_THEME3` and `RPL_THEME4`
- Unit: official national tract percentile rank from 0 through 1
- Missingness: source sentinel `-999` or no exact current-foundation GEOID match

The five ranks are copied without re-ranking. CDC cautions that ranks from
different SVI releases are not directly comparable. SVI ranks are not
CareAtlas scores.

### Census ACS

- Dataset: 2024 American Community Survey 5-year estimates
- Geography key: `state` + `county` + `tract`
- Uninsurance: the no-coverage age cells in `B27010` divided by `B27010_E001`
- Poverty: `B17001_E002 / B17001_E001`
- Disability: the one-or-more-disability cells in `C18108` divided by `C18108_E001`
- Vehicle access: `B08201_E002 / B08201_E001`
- Missingness: negative Census suppression sentinel, unavailable field, no exact GEOID match or zero ratio denominator

The importer streams the official table-based summary files and derives each
percentage from published counts. Batch 6 does not combine or publish margins
of error. ACS values are survey estimates, not exact individual counts.

### HRSA shortage areas

- Dataset: HRSA Shortage Areas daily data downloads
- HPSA files: primary care, dental health and mental health remain separate
- MUA/P file: Medically Underserved Areas and Populations
- Included status: `Designated`
- Preserved catalog fields: designation ID, name, type, status, designation and update dates, score, rural status and population type
- Tract value: count of distinct active designations intersecting the tract for that designation family

HPSA and MUA/P components arrive as tracts, whole counties or county
subdivisions. Tracts and counties use exact official identifiers. For a county
subdivision, the importer assigns a tract when its official 2024 Census internal
point falls inside the official subdivision polygon. That reproducible method
avoids treating an entire county as designated, but a boundary-edge tract may
be only partly covered. A tract whose official internal point falls outside
every subdivision polygon stays unmatched for this crosswalk and can still
receive exact tract or whole-county designation evidence.

An active HRSA component can also carry a geographic identifier that is not in
the current 2024 Census foundation. The coverage summary preserves that
component as unmatched and the importer does not guess a replacement by name.

An MUP can apply to a defined population group. Its presence must not be read as
a claim about every resident. A zero designation count means the reviewed daily
files contained no matching active component on the checked date; it does not
prove adequate access.

## Production artifacts

Each source writes 21 county shards under:

- `public/data/tracts/nj/evidence/cdc-svi/by-county`
- `public/data/tracts/nj/evidence/census-acs/by-county`
- `public/data/tracts/nj/evidence/hrsa-shortage/by-county`

Source-specific coverage summaries sit beside the tract foundation. The
combined `batch-6-coverage-summary.json` reports scope only and does not merge
values into a classification. Raw CSV and API responses are not copied into the
production bundle.

## Reproducible refresh and validation

```bash
npm run import:cdc-svi
npm run import:census-acs
npm run import:hrsa-shortage
npm run build:batch6-coverage
npm run check:batch6-importers
npm run validate:batch6
npm run check
npm run build
```

The fixture check covers quoted CSV fields, SVI missingness, ACS direct and
derived values, and HRSA tract, county and county-subdivision assignments. The
production validator independently checks row counts, duplicate tract/measure
pairs, ranges, missingness, provenance, designation catalogs and all 21 county
shards.
