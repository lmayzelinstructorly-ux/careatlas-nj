# Boundary Healthcare Assignment Plan

This plan documents the safest path for connecting source-backed healthcare
facilities to official legal/admin boundaries in CareAtlas. It is an audit
and implementation plan only. It does not add boundary healthcare summaries,
choropleths, fake facilities or fake polygons.

## Current Boundary System

CareAtlas represents boundaries as GeoJSON `FeatureCollection` files under
`public/data`.

- States load from `public/data/us-states.geojson`.
- Counties load from `public/data/counties/by-state/{STATEFP}.geojson`.
- Local jurisdictions load from `public/data/cousubs/by-state/{STATEFP}.geojson`.
- `public/data/geography-data-manifest.json` records which state-specific
  county and county subdivision files are available.
- `public/data/geography/search/states.json` and the state-specific files under
  `public/data/geography/search/states` provide runtime search metadata derived
  from the GeoJSON files. Legacy monolithic indexes remain local-only and are
  excluded from production builds.

The boundary source workflow in `scripts/download-boundaries.mjs` downloads
2024 Census cartographic boundary shapefiles, filters out non-mainland
state/territory FIPS codes, converts them to GeoJSON and writes the app data
files. `scripts/buildGeographyDataManifest.mjs`,
`scripts/buildBoundarySearchIndex.mjs` and
`scripts/buildLocalJurisdictionSearchIndex.mjs` rebuild derived data.

The app uses `src/geographyLayers.ts` to switch map levels by zoom:

- `states`: zoom 5 and below.
- `counties`: zoom 6 through 7.
- `towns`: zoom 8 and above. This means county subdivisions/local legal
  jurisdictions in the current data model.

Boundary data loading is handled by `src/hooks/useGeographyData.ts` and
`src/hooks/useGeographyDataManifest.ts`. The loader requires GeoJSON feature
collections containing only `Polygon` or `MultiPolygon` legal boundary
features. It reports missing county subdivision coverage honestly instead of
pretending local data exists.

`src/components/CareAtlasMap.tsx` handles zoom layer switching, active
state detection, selected boundary behavior, search navigation and boundary
labels. The selected boundary shape is stored as a `SelectedGeography` object
with the clicked GeoJSON feature when available. Current selected boundary
fields include `level`, `name`, `latitude`, `longitude`, optional `feature`,
optional `geoid`, optional `stateFips`, optional `stateAbbr` and optional
`countyFips`.

## Boundary IDs

Current GeoJSON features expose stable official identifiers:

- State features include `STATEFP`, `GEOID`, `GEOIDFQ`, `STUSPS`, `NAME`,
  `STATENS`, `ALAND` and `AWATER`. For states, `GEOID` is the two-digit state
  FIPS.
- County features include `STATEFP`, `COUNTYFP`, `GEOID`, `GEOIDFQ`,
  `STUSPS`, `STATE_NAME`, `NAME`, `NAMELSAD`, `COUNTYNS`, `ALAND` and
  `AWATER`. For counties, `GEOID` is state FIPS plus county FIPS, such as
  `34001`.
- County subdivision/local jurisdiction features include `STATEFP`,
  `COUNTYFP`, `COUSUBFP`, `GEOID`, `GEOIDFQ`, `STUSPS`, `STATE_NAME`,
  `NAMELSADCO`, `NAME`, `NAMELSAD`, `COUSUBNS`, `ALAND` and `AWATER`. For
  local jurisdictions, `GEOID` is state FIPS plus county FIPS plus county
  subdivision FIPS, such as `3400981200`.

Future assignment records should use these official IDs, not display names, as
their primary boundary keys.

## Current Healthcare System

Production healthcare data loads from
`public/data/healthcare/facilities.json` through
`src/hooks/useHealthcareFacilities.ts`. Demo data remains separate in
`public/data/healthcare/facilities.demo.json` and is loaded only when
`VITE_HEALTHCARE_DATA_MODE=demo`.

The current production dataset contains source-backed records with these
relevant fields:

- Facility identity: `id`, `name`, `facilityType`.
- Location text: `address`, `city`, `state`, `postalCode`, `county`,
  `stateFips`, `countyFips`.
- Coordinates: `latitude`, `longitude`.
- Source metadata: `sourceInfo`, `sourceId`, `sourceDataset`,
  `sourceLastUpdated`, `importDate`, `lastVerified`, `verificationStatus`.
- Access inputs: `services`, `hours`, `priceInfo`, `insuranceInfo`,
  `accessibilityInfo`, `phone`, `website`.

`src/components/HealthcareFacilityMarkers.tsx` renders neutral map markers only
for facilities that pass coordinate validation. `src/utils/healthcareDataQuality.ts`
audits missing or weak source fields.

Healthcare import, staging, review, promotion and validation are handled by the
scripts under `scripts/`, including:

- `validateHealthcareFacilities.mjs`
- `validateHealthcareStaging.mjs`
- `validateHealthcareSourceReviews.mjs`
- `reviewHealthcareImportFile.mjs`
- `stageHealthcareImport.mjs`
- `reviewStagedHealthcareFacility.mjs`
- `promoteStagedHealthcareFacilities.mjs`
- `checkHealthcareScoring.mjs`
- `checkHealthcareDataQuality.mjs`
- `checkHealthcarePipeline.mjs`
- `checkHealthcareProductionMapBehavior.mjs`

Healthcare documentation lives in `public/data/healthcare/README.md`,
`docs/healthcare-data-workflow.md`, `docs/healthcare-production-coverage.md`,
`docs/healthcare-pilot-source-plan.md` and related pilot reports.

## Current Boundary Summary Behavior

`src/utils/boundaryHealthcareSummary.ts` already computes selected-boundary
healthcare context for the UI. When a selected boundary includes a loaded
GeoJSON feature, it uses point-in-polygon matching against facility coordinates.
If geometry is unavailable, it falls back to limited state/county metadata and
does not assign local jurisdictions. This is useful for the current UI, but it
is not a durable assignment store.

The safer future system should keep the current UI behavior unchanged until a
validated assignment artifact exists.

## Recommended Assignment Method

Use coordinate-based point-in-polygon assignment from source-backed facility
coordinates to official Census/legal/admin boundary polygons.

The assignment workflow should:

1. Load production facilities from `public/data/healthcare/facilities.json`.
2. Load official boundary GeoJSON from `public/data/us-states.geojson`,
   `public/data/counties/by-state/` and `public/data/cousubs/by-state/`.
3. Validate each facility coordinate before assignment.
4. Assign a facility to one state boundary, one county boundary and, when
   coverage exists, one county subdivision/local jurisdiction boundary.
5. Store official IDs from matched boundary features: state `GEOID`/`STATEFP`,
   county `GEOID` plus `STATEFP` and `COUNTYFP`, and local jurisdiction
   `GEOID` plus `STATEFP`, `COUNTYFP` and `COUSUBFP`.
6. Record assignment status and warnings separately from the raw healthcare
   record.

Do not guess boundary membership from facility names. Do not infer county or
local jurisdiction from address text unless a future workflow adds a validated,
source-backed geocoding or address-normalization step with explicit review.

## Required Fields

Facilities need:

- `id`
- valid `latitude`
- valid `longitude`
- source metadata through `sourceInfo` or equivalent source fields
- `state` and preferably `stateFips`
- `county` and `countyFips` when supplied by the source

Boundary features need:

- `geometry` as `Polygon` or `MultiPolygon`
- `GEOID`
- state boundaries: `STATEFP`, `STUSPS`, `NAME`
- county boundaries: `STATEFP`, `COUNTYFP`, `NAME` or `NAMELSAD`
- local jurisdictions: `STATEFP`, `COUNTYFP`, `COUSUBFP`, `NAME` or
  `NAMELSAD`

## Missing And Invalid Coordinates

Facilities missing either latitude or longitude should not be assigned to any
boundary automatically. They should be listed in assignment validation output
with a status such as `missing_coordinates`.

Facilities with non-numeric coordinates, partial coordinates, out-of-range
coordinates or coordinates outside the supported mainland map geography should
not be assigned. They should be flagged with a status such as
`invalid_coordinates` or `outside_supported_geography`.

If a coordinate falls inside a supported state and county but no local
jurisdiction match is found because the local boundary file is missing or
incomplete, the assignment should preserve the state and county matches and
record local status as `local_boundary_unavailable` or
`local_boundary_not_matched`. CareAtlas should not silently promote that to
a local match.

## Storage And Cache Approach

Store assignment results as a generated data artifact, not as guessed fields in
raw healthcare records. A recommended path is:

```text
public/data/healthcare/facility-boundary-assignments.json
```

Each assignment entry should be keyed by facility ID and include:

- `facilityId`
- `sourceFacilityVersion` or an input checksum/date for the facility dataset
- `coordinate`: latitude and longitude used for assignment
- `state`: matched `geoid`, `stateFips`, `name`, assignment status
- `county`: matched `geoid`, `stateFips`, `countyFips`, `name`, assignment
  status
- `localJurisdiction`: matched `geoid`, `stateFips`, `countyFips`,
  `cousubFips`, `name`, assignment status
- `warnings`
- `assignedAt`
- `boundaryDataVersion`, such as Census GENZ year and file/source notes

This keeps raw source-backed healthcare records separate from generated spatial
relationships. It also makes stale assignments easier to invalidate when
facility coordinates or boundary files change.

## Boundary Summary Generation

Boundary healthcare summaries aggregate from validated assignment results, not
from name matching. `scripts/generateBoundaryHealthcareSummaries.mjs` groups
facility IDs by state `GEOID`, county `GEOID` and local jurisdiction `GEOID`,
then joins those facility IDs back to the loaded healthcare records.

The generated cache is:

```text
public/data/healthcare/boundary-healthcare-summaries.json
```

Summaries include counts and averages only for loaded, source-backed records
with valid assignment statuses. They include missing-data and source-coverage
notes so the UI can describe coverage honestly.

Do not claim that a boundary has no healthcare access when the assignment data
is incomplete. The generated summaries say that no loaded, source-backed,
coordinate-assigned facilities are currently matched.

## Validation Plan

Add a future validation script after the assignment artifact exists. It should
check:

- every production facility appears in the assignment artifact or has a clear
  non-assignment status
- every assigned boundary ID exists in the current official boundary files
- no facility with missing or invalid coordinates is assigned
- no facility outside supported geography is assigned
- county assignments belong to the assigned state
- local jurisdiction assignments belong to the assigned state and county
- local jurisdiction gaps are marked as missing coverage rather than guessed
- assignment artifact input checksum or version matches current facility and
  boundary data
- summaries never include demo/sample/template data

The script should be added to `npm run check` once stable.

## What CareAtlas Should Not Claim

CareAtlas should not claim:

- medical quality, diagnosis, treatment guidance or patient-specific advice
- exact service availability, insurance acceptance, hours or prices unless a
  source backs those fields
- boundary membership for facilities without valid coordinates
- local jurisdiction assignment when the local boundary geometry is unavailable
  or the point does not match a loaded local polygon
- healthcare access absence for a boundary when source coverage or coordinate
  coverage is incomplete
- production truth from demo, sample, template or fixture records

## Recommended Next Task

Create a read-only assignment prototype script that loads production facilities
and official boundary GeoJSON, performs point-in-polygon matching, prints an
audit report and writes nothing by default. After the dry-run report is
reviewed, add an explicit write mode for
`public/data/healthcare/facility-boundary-assignments.json` and a validation
script for that artifact.
