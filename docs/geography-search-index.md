# Geography Search Index

Boundary search data is generated from the existing official state, county and
county-subdivision GeoJSON. The generated files contain search and selection
metadata only; they do not duplicate boundary geometry.

## Runtime files

- `public/data/geography/search/search-manifest.json` lists the available state
  shards, their record counts and byte sizes.
- `public/data/geography/search/states.json` contains the small state search
  index used when `/map` first mounts.
- `public/data/geography/search/states/{STATEFP}.json` contains county and local
  jurisdiction targets for one state.

`MapSearchBar` loads the manifest and state index on mount. It loads one state
shard when a state filter is selected. For an unfiltered national search, it
starts loading state shards only after the query contains at least two
characters. State results remain available while heavier shards load.

The existing `public/data/boundary-search-index.json` and
`public/data/local-jurisdiction-search-index.json` files remain available for
local compatibility workflows. Neither file is allowlisted for production,
and production validation treats either one in `dist` as a failure.

## Regeneration and checks

Run:

```bash
npm run build:search-index
npm run build:local-search-index
npm run build
npm run check:map-search-performance
npm run validate:production-dist
```

`build:search-index` regenerates the manifest, state index, state shards and
legacy boundary compatibility index from official boundary GeoJSON.
`check:map-search-performance` verifies that the component has no monolithic
runtime request, every shard matches its manifest metadata, search selection
fields remain present, a healthcare-covered state has county/local targets,
the initial search files are at least 95 percent smaller than the legacy index,
and a built `dist` does not contain either legacy national index.
