# Batch 8 public tract map and records

> Current UI status: the generated Batch 8 records power an optional public
> county-to-tract workflow. The map loads a county's tract layer only after the
> user chooses `View gap areas`; plain-language results appear first, while full
> evidence and sources remain behind an explicit disclosure. Source-backed
> facility locations remain a separate progressive-cluster layer.

Batch 8 publishes the validated New Jersey tract screening states, evidence
panel, source-backed facility context and reproducible public downloads. It does
not add stabilization work, deployment, national tracts, state expansion,
scores, rankings, comparisons, road tiles or road controls.

## Intent-driven map loading

The map still opens on New Jersey counties. It does not load all 2,181 tract
geometries or public records at startup.

Selecting a county and choosing `View gap areas` identifies one three-digit New
Jersey county FIPS. The client then loads only:

- `public/data/tracts/nj/by-county/{countyFips}.geojson`
- `public/data/tracts/nj/classifications/access-gap-rule-v1/by-county/{countyFips}.json`

Selecting a tract then loads that county's generated public-record JSON shard.
The county outline remains visible, while base boundary fills, labels and
facility markers are hidden to keep the gap view focused. The map remains
constrained by the New Jersey maximum bounds.

## Focused tract map treatment

The underlying records retain all four categorical screening states, never a
gradient or continuous score. The public map intentionally uses only two visual
treatments:

- Potential access gap: purple fill with a solid dark border
- Every other screening state: the same neutral fill and solid gray border

This keeps attention on the tracts that met the published rule without turning
the other screening outcomes into competing map categories. Missing required
evidence remains visible through a small clickable flag rather than a separate
tract color or line pattern. Selecting any tract reveals its exact screening
state and explanation. A selected tract receives a strong dark outline. Tract
paths receive a keyboard focus target, button role, descriptive label and
Enter/Space selection handlers.

In a town-focused view, the selected town contains a light neutral grid made
from the portions of county tracts that intersect its official boundary. The
display geometry is clipped at the selected town and parent county outlines so
cross-boundary tracts cannot look like detached parts of the town or county.
Only potential-gap tracts associated with the selected town are overlaid in
purple. The selected evidence record still describes the full official census
tract; clipping changes map presentation only, not the tract GEOID or evidence.

County-focused tract views use the same rule: land tracts are clipped to the
exact county polygon already shown at the county level. Water-only census
tracts are retained in source artifacts but are not drawn or given offshore
missing-data flags on the public map.

These are screening states, not rankings or diagnoses. No current gap flag does
not prove adequate access. Insufficient evidence means at least one required
value is missing.

## Evidence panel

The panel shows the tract name and 11-digit GEOID, state, plain-language
explanation and rule version. A rule-input table preserves all seven required
values with:

- value and unit
- operator and threshold
- triggered, did-not-trigger or unavailable result
- explicit missing reason
- estimate type
- source agency and dataset
- release year and checked date
- official source link
- expandable transformation details

The remaining panel sections are Community health need, Social barriers,
Official shortage evidence, Documented facility context, and Missing evidence
and limitations. The context sections preserve all four additional SVI themes,
all four Census ACS measures, dental HPSA and mental-health HPSA evidence in
addition to the seven rule inputs.

CDC PLACES values are labeled modeled population estimates. ACS values are
survey-derived estimates. SVI values remain official national percentile ranks.
HRSA designations can apply to areas, parts of areas or defined population
groups. Missing values remain missing and cannot become zero.

## Facility context and distance method

Each tract record keeps HRSA community health centers separate from CMS
hospitals. CMS hospitals are not counted as primary-care capacity without
supporting source evidence.

The tract geometry already preserves the official Census `INTPTLAT` and
`INTPTLON` fields. Batch 8 uses that official 2024 tract internal point as the
distance origin. The destination set contains the currently loaded
source-backed New Jersey HRSA community health centers with valid coordinates.

The generator calculates Haversine great-circle distance with an Earth radius
of 3,958.7613 miles and stores the shortest value rounded to two decimal places.
The validator independently recomputes every result. This is straight-line
distance, not road or travel distance. Nearest does not mean best, highest
quality or most appropriate. The loaded facility layer is not a complete
provider directory, and missing pins do not mean zero healthcare.

For a selected potential-gap tract, the compact public card reuses this method
to show the nearest three loaded centers, counts within 5 and 10 straight-line
miles, source-backed contact details, and Google Maps or Apple Maps directions.
The nearest center and distance stay visible
by default; additional centers use progressive disclosure. A data-quality flag
explains that proximity does not establish services, appointment capacity,
affordability, insurance access, transportation access or medical quality and
does not change the tract screening state.

## Public records

The generator writes:

- 21 tract-level JSON shards:
  `public/data/tracts/nj/public-records/tracts/by-county/*.json`
- 21 tract-level CSV shards:
  `public/data/tracts/nj/public-records/tracts/by-county/*.csv`
- county-level JSON:
  `public/data/tracts/nj/public-records/counties/new-jersey-counties.json`
- county-level CSV:
  `public/data/tracts/nj/public-records/counties/new-jersey-counties.csv`
- statewide report:
  `public/data/tracts/nj/public-records/reports/new-jersey-access-gap-report.md`
- download manifest:
  `public/data/tracts/nj/public-records/download-manifest.json`

Tract JSON preserves the screening record, all 18 evidence observations,
missingness, explanations, limitations, source/release metadata, official
internal point, separate facility counts, loaded in-tract facility summaries
and nearest HRSA safety-net center. Public-record schema 1.1 also preserves four
non-causal gap-driver groups and official action paths with explicit limitation
copy. Tract CSV flattens the same evidence into named columns and preserves
nested drivers, action paths, explanations, limitations, missingness and
sources as JSON columns.

County records are generated from the validated tract records. They use counts,
percentages of all foundation tracts, per-measure non-missing/missing counts and
separate facility totals. They do not average percentile ranks or designation
counts into a county score.

Raw source downloads, fixtures, staging files and review artifacts remain
outside the production allowlist. Only the generated public records are added.

## Reproduction and validation

```bash
npm run build:batch8-public-records
npm run validate:batch8-public-records
npm run check:batch8-public-layer
npm run check:batch8
npm run check
npm run build
npm run validate:production-dist
```

The record validator checks all tract and county JSON/CSV rows, all four states,
the seven rule inputs, eleven additional context measures, explicit missing
reasons, sources and dates, stable GEOIDs, official internal points, separate
facility types, nearest-center recomputation, county/state totals and statewide
report copy.

The public-layer check covers sharded loading, tract selection, legend labels,
text/pattern accessibility, keyboard selection, selected styling, source links,
downloads, production allowlisting and prevention of scores, rankings, roads and
premature national tract expansion.
