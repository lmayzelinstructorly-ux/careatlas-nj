# New Jersey census-tract foundation

Batch 4 establishes the geography and validation layer for the first CareAtlas
community-evidence pilot. It does not publish an access-gap classification.

## Pinned boundary source

- Agency: U.S. Census Bureau
- Service: TIGERweb `tigerWMS_ACS2024`
- Layer: Census Tracts, layer 8
- Geography vintage: January 1, 2024
- Source checked: July 11, 2026
- Output coordinates: EPSG:4326 with five-decimal geometry precision
- Pilot geography: New Jersey (`STATEFP=34`)
- Stable join key: 11-digit Census tract `GEOID`

Run `npm run build:nj-tract-foundation` to query the pinned service. For a
reviewed local source response, pass `--input=/absolute/or/project-relative/file.geojson`.
The generator normalizes the official properties and writes 21 county shards
under `public/data/tracts/nj/by-county` so one tract selection does not download
the full statewide geometry file.

## Generated artifacts

- `coverage-summary.json` documents 2,181 tracts, 21 counties, source metadata
  and missing evidence layers.
- `facility-tract-assignments.json` assigns mappable New Jersey HRSA and CMS
  records by point-in-polygon while preserving facility type.
- `tract-foundation.json` keeps HRSA health-center counts separate from CMS
  hospital counts. Hospitals are not treated as primary-care capacity.
- `tract-evidence.v1.schema.json` defines the future observation contract for
  source, release year, geography, value, unit, estimate type, missingness and
  provenance.

The Batch 4 foundation records use `classification: not_evaluated` and preserve
the evidence status at the geography-foundation stage. Missing evidence must
never become a reassuring low-gap classification.

Batch 5 adds CDC PLACES observations beside this geography foundation. See
`docs/cdc-places-foundation.md` for the pinned release, selected measures,
coverage and validation. The PLACES artifacts do not alter tract geometry or
introduce a classification.

## Validation

```bash
npm run validate:nj-tract-foundation
npm run check:tract-evidence-schema
npm run check:cdc-places-importer
npm run validate:cdc-places
npm run build:search-index
npm run check
```

The production validator checks the pinned source vintage, row and county
counts, unique GEOIDs, geometry types, county sharding, facility assignments,
separation of facility types, missing-layer declarations and the absence of a
tract score or access-gap classification.
