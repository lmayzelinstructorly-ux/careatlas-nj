# CareAtlas access-gap data contract

This document defines what CareAtlas must calculate and display before it
publishes a community-level healthcare access-gap finding.

## Product question

CareAtlas should answer:

> Where do documented healthcare capacity, community health need, social
> barriers and official shortage evidence fail to line up?

It must not answer that question from facility pins alone.

## Required evidence layers

### 1. Documented healthcare capacity

Current foundation:

- HRSA Health Center Service Delivery and Look-Alike Sites
- CMS Hospital General Information
- official Census state, county and local-jurisdiction boundaries
- facility-to-boundary assignments
- source, checked-date and missing-field metadata

Primary-care analysis must not count a hospital as a primary-care provider
unless a source supports that role.

### 2. Community health need

Current New Jersey foundation:

- CDC PLACES 2025 release census-tract estimates
- diagnosed diabetes and coronary heart disease crude prevalence
- annual checkup and cholesterol screening crude prevalence
- modeled-estimate labels, explicit missingness and row-level provenance

Chronic-disease prevalence and preventive-care measures remain distinguishable.
PLACES values are modeled population estimates and must not be presented as
individual diagnoses.

### 3. Social barriers

Current New Jersey foundation:

- CDC/ATSDR Social Vulnerability Index 2022 overall and four theme percentile ranks
- U.S. Census Bureau 2024 ACS 5-year uninsurance, poverty, disability and no-vehicle household percentages
- explicit suppression and cross-vintage missingness
- one observation per reviewed measure for every foundation tract

SVI values remain official New Jersey percentile ranks, not CareAtlas scores. ACS
measures remain survey estimates. CareAtlas must not present demographic
variables as individual-level diagnoses or deterministic causes.

### 4. Official shortage evidence

Current New Jersey foundation:

- HRSA Health Professional Shortage Area daily downloads for primary care, dental health and mental health
- HRSA Medically Underserved Area/Population daily download
- distinct tract observations for each designation family
- designation status, dates, scores, rural status and population type preserved in the reviewed designation catalog

Primary care, dental health and mental health designations remain separate. MUP
evidence may describe a population group rather than every tract resident.

## Geography

The first production pilot should use a geography supported consistently across
all selected datasets. Census tract is preferred for community analysis, with
county summaries generated from tract evidence. State, county, tract and local
jurisdiction identifiers must use stable official codes.

A record must not be joined by display name alone when an official geographic
identifier is available.

## Public output

For each supported geography, the public report should show:

- every included component
- value, unit, geography and percentile where applicable
- source agency and dataset
- source release or checked date
- whether the value is observed, modeled, derived or unavailable
- documented facility count and type mix
- official shortage designation status
- a plain-language explanation of why the area was flagged
- limitations and missing evidence
- a downloadable machine-readable record

## Flagging policy

The first release should use a transparent rule-based flag rather than an
opaque weighted score. A rule must be written and versioned before data is run
through it.

Example structure:

- elevated community need or social vulnerability, and
- documented primary-care shortage or low source-backed facility capacity, and
- sufficient data coverage for every required component

This is an implementation structure, not a finalized threshold. Thresholds must
be selected, justified and validated before production use.

Areas with incomplete required data must receive an “insufficient evidence”
state, not a low-access or high-access classification.

## Claims CareAtlas may make

- A public dataset reports a stated measure for a stated geography and year.
- An area is within an active HRSA shortage designation.
- A stated number and mix of source-backed facilities are loaded.
- A versioned rule flagged an area because listed components crossed published
  thresholds.
- Evidence is incomplete or unavailable.

## Claims CareAtlas must not make

- A person will or will not receive care.
- A facility provides a service that is not source-backed.
- A facility offers higher medical quality.
- A community has no healthcare because no marker is loaded.
- A modeled prevalence estimate is an individual diagnosis.
- Correlation proves a cause.
- A gap flag is medical advice, emergency guidance or a clinical decision.

## Validation requirements

Before a new layer reaches production:

1. Pin the source dataset and release.
2. Preserve original geographic identifiers.
3. Validate row counts, duplicates, ranges and missingness.
4. Document transformations and derived values.
5. Add reproducible generation scripts.
6. Add fixture and production validation checks.
7. Generate a coverage summary.
8. Review public copy for overclaims.
9. Keep source inputs and review artifacts out of the production bundle.
10. Run `npm run check` and `npm run build`.

## Initial implementation order

1. New Jersey tract geography pilot
2. CDC PLACES import and validation
3. CDC SVI and ACS import and validation — implemented in Batch 6
4. HRSA HPSA and MUA/P import and validation — implemented in Batch 6
5. versioned gap-flag rule — implemented in Batch 7
6. tract evidence panel and map layer — implemented in Batch 8 and exposed through the county-level `View gap areas` action
7. county aggregation and downloadable reports — implemented in Batch 8
8. extension to the other loaded states

## New Jersey tract foundation status

The first geography step is implemented with the U.S. Census Bureau TIGERweb
ACS 2024 tract layer. New Jersey contains 2,181 validated tract GEOIDs split
into 21 county geometry shards. The versioned observation schema is published,
and source-backed New Jersey HRSA/CMS facilities are assigned to tracts with
their facility types kept separate.

These source records remain separate evidence components. Batch 7 applies the
versioned screening rule described below without modifying the source rows.

## CDC PLACES foundation status

The 2025 CDC PLACES census-tract release is loaded for five reviewed measures:
two chronic-disease estimates, two preventive-care estimates and one direct
transportation-barrier estimate. The four health and preventive-care measures
remain the rule inputs; transportation stays contextual. Production contains
one observation per measure for each of the 2,181 New Jersey foundation
tracts. The source covers 2,169 tracts, producing 10,845 modeled estimates and
60 explicit missing observations for 12 tracts outside source coverage.

No PLACES value alone creates a gap flag, score, diagnosis or causal claim.

## Batch 6 evidence status

Batch 6 adds five CDC SVI measures, four Census ACS measures and four separate
HRSA designation measures to all 2,181 New Jersey foundation tracts. Each source
has its own importer, county shards, coverage summary, fixture checks and
production validator. The combined coverage summary reports 28,353 expected
observations without merging the source contracts.

HRSA tract and county components use exact official identifiers. County-
subdivision components use the official 2024 tract internal point within the
official subdivision boundary and disclose that crosswalk method. All values
remain evidence components; Batch 6 does not define thresholds or calculate an
access-gap classification.

## Batch 7 transparent flagging status

Rule version 1.0.0 is written as a production data artifact before it is
applied. It uses fixed New Jersey quartile cut points for the four CDC PLACES
measures, the official CDC/ATSDR SVI overall New Jersey percentile rank and
separate HRSA primary-care HPSA and MUA/P designation counts. It does not
create a weighted score or rank.

The rule produces exactly four screening states: `potential_access_gap`,
`elevated_need_without_documented_shortage`, `no_current_gap_flag` and
`insufficient_evidence`. Missing any required rule input always takes first
precedence and produces `insufficient_evidence`. A no-current-flag result does
not prove adequate access.

Validated ACS measures, SVI themes, dental and mental-health HPSA designations
and the direct PLACES transportation estimate remain context evidence but are
not silently double-counted in rule version 1.0.0. Source-backed facility records also remain visible context; the rule
does not turn an incomplete facility directory into a low-capacity threshold.

## Batch 8 public map and records status

Current UI note: the validated Batch 8 records remain reproducible and
production-allowlisted. The map starts with New Jersey counties and
towns/townships, then loads one county's census-tract classifications only when
the user selects `View gap areas`. Tract cards lead with the gap, why it was
flagged and the related data; full evidence and sources stay behind an explicit
disclosure. Potential-gap tract cards also show compact proximity context for
loaded source-backed HRSA community health centers, using straight-line distance
from the official Census tract internal point. Facility proximity remains
separate context and does not create, remove or alter an access-gap
classification.

The optional gap explorer lists counties alphabetically by their validated
flagged-tract counts, then loads a selected county's town screening context on
demand. It does not score or rank counties or towns, and its town counts remain
primary-assigned or intersecting tract context rather than town classifications.

Batch 8 publishes the four rule version 1.0.0 states through the existing 21
county shards. The map remains county-focused at startup and loads tract
geometry and classifications only after a county selection followed by
`View gap areas`. The selected county outline remains visible while the base
boundary fills, labels and facility markers step out of the way; road tiles,
road controls, gradients, scores and rankings remain absent.

Because the public county/town boundary files and TIGERweb tract layer use
different official Census products with different edge generalization, tract
display polygons are intersected with the selected county and, when relevant,
town boundary before drawing. This prevents a tract fill or flag from appearing
outside the selected area. The original tract GEOID, official geometry in the
source shard and tract-level evidence record remain unchanged. Census tracts
with zero mapped land area are not drawn on the public access-gap map.

The selected-tract card shows the status, plain-language reason and most
relevant values first. Its full-evidence disclosure includes all seven rule
inputs, source links and limitations. The generated public record continues to
preserve the additional SVI, ACS and HRSA context observations with provenance.
Insufficient evidence remains an explicit result.

Public-record schema 1.1 groups the preserved evidence into four non-causal
gap-driver categories and publishes official action paths for safety-net care,
coverage information, eligible transportation support and shortage-workforce
planning. These links are resources to investigate, not personalized
recommendations, eligibility decisions or guaranteed solutions.

Facility context keeps HRSA community health centers separate from CMS
hospitals. Nearest safety-net center uses Haversine great-circle distance from
the official 2024 Census tract internal point to source-backed New Jersey HRSA
community health-center coordinates. It is straight-line distance, not travel
distance, and does not imply best, highest quality or most appropriate.

Reproducible county-sharded tract JSON/CSV, statewide county JSON/CSV and a New
Jersey report are published under `public/data/tracts/nj/public-records`.
County summaries use counts, percentages and coverage totals from validated
tract evidence; they do not average percentile ranks or designation counts into
a misleading score.

## New Jersey town gap foundation status

The town foundation connects the 2,181 versioned tract screening records to all
564 official 2024 New Jersey county subdivisions. Each tract receives at most
one primary town assignment. The preferred assignment uses the official Census
tract internal point inside the official town polygon; a largest-overlap
fallback is allowed only when at least 25% of the tract polygon is mapped to one
town. Tracts that do not meet those rules remain explicitly unassigned.

Equal-area polygon intersections disclose meaningful cross-town context using
a 0.5% tract-or-town polygon-share threshold. The calculation uses a spherical
Lambert azimuthal equal-area projection centered on New Jersey. Polygon shares
include land and water and are not population shares.

Town artifacts report counts for primary-assigned and intersecting tract
screening states. They do not create a town screening state, percentage, score,
ranking or claim that an entire town is an access gap. A future town UI must
describe these values as tract areas or assigned tracts and show a data-quality
flag when context is partial, cross-boundary, insufficient or unassigned.
