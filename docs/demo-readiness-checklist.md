# Demo readiness checklist

Use this checklist before a public walkthrough of the New Jersey boundary and
healthcare facility map.

## Demo path

1. Open `/`.
2. Confirm the initial view is New Jersey and shows all 21 counties.
3. Zoom into a county and confirm all 564 official towns/townships are available;
   local boundaries replace the county fill while the county outline remains visible.
4. Inspect several town junctions and confirm no white seam looks like
   unclaimed land; hover and selection still follow official town polygons.
5. Pan and zoom repeatedly. The map should respond smoothly and remain within
   New Jersey. Use **Reset map** and confirm all address/selection state clears
   before the statewide view returns.
6. Search for a New Jersey county, town or township, select a suggestion and
   confirm the map zooms to it and shows its territory card.
7. Select a county-level facility count and confirm the panel lists every
   included facility with its source-backed contact details plus
   Google Maps and Apple Maps directions links.
8. Zoom closer and confirm county counts split into smaller clusters and
   individual facility markers.
9. Open **Build story** and confirm `/story` explains the pipeline, design
   decisions, real debugging lessons and next steps without claiming outside
   validation that has not happened. Return with **Explore the map**.
10. Open **Doctor offices (pilot)** and confirm the limited-scope label is
    visible before choosing a specialty. Search by practice name, city, ZIP
    and provider name; confirm every count opens its complete list without
    zooming, the location cards lead with directions and phone, **Show on map**
    leaves a highlighted marker and the dialog closes with Escape.
11. Open **Explore potential gaps**, choose a county and town, and confirm the
    local access context brief does not classify the whole town.
12. Open a flagged tract and confirm **Why this was flagged** plainly names
    need/barriers and official shortage evidence before technical details.
    Expand the gap-driver and official action-path disclosures and confirm their
    limitations are visible. If Gemini is enabled, confirm its optional wording
    is labeled AI-assisted and does not change the status.
13. Copy the tract link, refresh it and confirm the same official GEOID returns.
14. Confirm the selected brief prints without map chrome and downloads the
    matching public JSON record.

## Current claims

Use:

- CareAtlas NJ currently displays official New Jersey county and town/township boundaries.
- Potential-gap findings are transparent tract screening results, not scores,
  rankings or town classifications.
- Loaded healthcare markers are source-backed location context and remain
  subject to their source and limitation contracts.
- The doctor-office layer is a three-specialty, CMS-listed discovery pilot; it
  is not a complete provider directory and does not show availability.

Do not say:

- The current boundary colors identify healthcare-access gaps.
- A town or county color is a score or ranking.
- The map provides medical advice or rates facility quality.

## Public runtime

- The public product is one New Jersey boundary map.
- `/story` is a non-clinical build narrative linked from the map header.
- Source-backed New Jersey facility markers progressively cluster by zoom.
- The doctor-office pilot is intent-loaded, searchable and source-backed;
  unmatched geocodes stay in a non-production review queue.
- Tracts and evidence load only after an explicit county or town gap-view
  action; full sources and downloads remain behind progressive disclosure.
- Tract records expose contextual gap drivers and official action paths without
  changing the screening rule or promising a solution.
- Selected county, town and tract briefs have shareable GEOID URLs, print output
  and public-data downloads.
- Search for a New Jersey county, town or township uses the two boundary files
  loaded by the map.
- `/internal-data` remains an unlinked development-only review route and is
  excluded from production builds.
- Disease Map and Student Opportunities remain retired.

## Before a live demo

```bash
npm run check
npm run dev
```

Open `/` and confirm former page routes redirect to the map. Verify the county
and town/township hierarchy, healthcare clustering, directions links, New
Jersey bounds, responsive zoom and shareable local context briefs. Facility
panels should show addresses, phone numbers, available websites and both map
providers without filling missing website data.
