# CDC PLACES community-health and transportation foundation

Batch 5 adds a small, validated community-health evidence layer for the New
Jersey tract pilot. It does not calculate or publish an access-gap flag.

## Pinned source

- Agency: Centers for Disease Control and Prevention
- Dataset: `PLACES: Local Data for Better Health, Census Tract Data, 2025 release`
- Dataset identifier: `cwsq-ngmh`
- Release: December 2025
- Source updated: December 12, 2025
- Source checked: July 14, 2026
- Geography identifier: `LocationID`, an 11-digit Census tract GEOID
- Value type: `CrdPrv`, modeled crude prevalence
- Unit: percent
- Selected-measure data year: 2023
- Dataset page: <https://data.cdc.gov/d/cwsq-ngmh>
- Release notes: <https://www.cdc.gov/places/current-release-notes/index.html>

The importer queries only New Jersey, the five allowlisted measures and the
crude-prevalence value type. It joins to the 2,181-tract foundation only through
the 11-digit GEOID. Display names are never used as join keys.

## Selected measures

### Chronic-disease estimates

- `DIABETES`: Diagnosed diabetes among adults. This represents a chronic
  metabolic condition that can require regular monitoring and continuing care.
- `CHD`: Coronary heart disease among adults. This represents a chronic
  cardiovascular condition that can require sustained outpatient management.

### Preventive-care estimates

- `CHECKUP`: Routine checkup within the past year among adults. This provides a
  preventive-care use estimate without claiming why an adult did or did not
  receive a checkup.
- `CHOLSCREEN`: Cholesterol screening among adults. This provides a preventive
  screening estimate related to cardiovascular risk detection.

### Transportation-barrier context

- `LACKTRPT`: Lack of reliable transportation in the past 12 months among
  adults. This direct modeled social-needs estimate stays contextual and does
  not create or change an access-gap classification.

All five measures use 2023 BRFSS inputs in the 2025 PLACES release. Measures
carried forward from 2022 were intentionally excluded so this first foundation
does not mix source years. Crude prevalence was selected to represent estimated
local burden. It is not an age-adjusted comparison.

## Generated artifacts

- `public/data/tracts/nj/evidence/cdc-places/by-county/*.json` contains one
  versioned observation for every selected measure and every foundation tract,
  split into 21 county shards for intent-driven loading.
- `public/data/tracts/nj/cdc-places-coverage-summary.json` records release
  metadata, measure rationale, loaded estimates, missing estimates and tracts
  outside source coverage.
- `public/data/tracts/test-fixtures/cdc-places-source.fixture.json` exercises
  loaded and explicitly missing importer paths and stays outside production.

The current release contains all five selected estimates for 2,169 of the 2,181
foundation tracts. The remaining 12 current tracts are outside the source
coverage. The importer therefore writes 10,845 modeled estimates and 60 explicit
missing observations. Missing observations have `value: null`; they are never
converted to zero or used as reassuring evidence.

## Reproducible workflow

Download and generate from the pinned API:

```bash
npm run import:cdc-places
```

For a reviewed local source response:

```bash
npm run import:cdc-places -- --input=/path/to/cdc-places-source.json
```

Validate the fixture, production observations and full project:

```bash
npm run check:cdc-places-importer
npm run validate:cdc-places
npm run check
npm run build
```

Raw API responses and test fixtures are not runtime artifacts. Only the
validated observations and coverage summary are production allowlisted.

## Interpretation limits

- PLACES values are modeled population estimates, not individual diagnoses.
- A tract estimate does not prove why a local pattern exists.
- Crude prevalence reflects local population composition and should not be
  treated as an age-adjusted comparison.
- A missing estimate is unknown, not zero.
- PLACES evidence alone cannot establish a healthcare access gap.

At the end of Batch 5, social-barrier and official shortage evidence was still
missing and every tract remained `not_evaluated`. Batch 6 added those source
layers, and Batch 7 applies them through a separate versioned rule without
changing the PLACES source observations.
