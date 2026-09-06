# Boundary healthcare summaries

CareAtlas generates facility-count summaries for official state, county and local-jurisdiction boundaries. Joins use stable official GEOIDs from `facility-boundary-assignments.json`, never display names.

## Commands

```bash
npm run assign:facility-boundaries -- --write
npm run validate:facility-boundaries
npm run generate:boundary-healthcare-summaries -- --write
npm run validate:boundary-healthcare-summaries
```

## Output

`public/data/healthcare/boundary-healthcare-summaries.json` contains:

- official boundary IDs and names
- assigned facility count
- count with valid coordinates
- facility type counts
- source facility IDs
- missing-data warnings
- completeness and source-coverage notes

Supported boundaries without assigned records use `noAssignedFacilityPolicy`. That state means coverage is not loaded for the boundary. It never means the community has no healthcare.

The optional map shading uses assigned facility-count bands only. It does not measure access, quality or whether one boundary is better than another.

Regenerate assignments and summaries whenever production facilities or official boundary files change. Validation compares generated checksums with the current inputs.
