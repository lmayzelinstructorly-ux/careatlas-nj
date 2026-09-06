# Public map workflow

CareAtlas NJ currently has one public map product: a New Jersey boundary and
source-backed healthcare facility map.

## Current interaction

1. Open `/` to see New Jersey's 21 counties and choose **Hospitals & community health centers**,
   **Doctor offices (pilot)** or **Potential gaps** from the header.
2. Use **Build story** to open `/story`, which documents the verified project
   process and returns to the map without adding another map product.
3. Zoom in or click a county. Use the bottom-right **Reset map** button at any
   point to clear a selection or address result and return to the statewide view.
4. At the local level, the map shows 564 official towns/townships.
5. County outlines remain visible over the town/township layer.
6. Search for a New Jersey county, town or township and choose a suggestion to
   zoom to and select its official boundary.
7. At county level, each county with loaded facilities shows one count marker.
8. Zoom closer to split that count into progressively smaller local clusters
   and then individual medical-pin facility locations. Choosing **Zoom closer**
   highlights every resulting subcluster or facility from the selected group.
9. Select any count or facility marker to see the included facility names and
   source-backed contact details, then open Google Maps or Apple Maps directions
   for the validated coordinate.
10. Open **Doctor offices (pilot)**, select one of three specialties and search
    by practice name, city, ZIP or provider name. Select any county or local
    count to open every represented location without changing zoom. Use the
    mouse wheel to split counts into smaller groups. Each card leads with
    directions, phone and **Show on map**, while clinician and CMS details stay
    collapsed; **Show on map** leaves a highlighted marker.
    Doctor-office records remain separate from facilities and gap results.
11. Choose **Explore potential gaps** to browse counties alphabetically, then
   open a town with flagged tract context.
12. From a county or qualifying town brief, choose **View gap areas** or
    **View gap tracts**. Only that county's validated tract geometry and
    classifications load.
13. On desktop, expand **Flagged tract areas in this town** to review the
    validated tract identifiers and one conservative reason. Choose an item to
    open that tract directly through the same map selection and permalink flow.
14. Select a tract for a two-part plain-language explanation of its rule result,
    relevant inputs and nearby source-backed care context. If the optional
    server-only Gemini feature is configured, it may rephrase the same result;
    it cannot classify the tract or receive a searched address. Full evidence
    and sources remain behind a disclosure.
15. Use **Copy link** to preserve the selected official GEOID in a stable
    `?county=`, `?town=` or `?tract=` URL. Refreshing or opening that URL restores
    the same context. **Print brief** is offered only for a potential-gap tract
    or a county/town context containing at least one potential-gap tract; it
    removes the map chrome. Download actions expose the relevant validated
    public record even when printing is not offered.

The map preloads only these New Jersey files:

- `/data/counties/by-state/34.geojson`
- `/data/cousubs/by-state/34.geojson`
- `/data/healthcare/by-state/34.json`

`/data/doctor-offices/nj.json` is intent-loaded only after the doctor-office
pilot is opened; the healthcare shard is not requested in that mode.

Native Leaflet wheel zoom replaces the previous custom fractional wheel handler.
Visible label points are cached, and labels remain visible while the map moves.

The official county and county-subdivision files are separate Census 1:500,000
cartographic products whose independently simplified edges can leave tiny
display seams even though their published land-area totals are fully covered.
Town mode therefore uses a single neutral town fill with a narrow same-color,
non-interactive underpaint along the official town shapes. This removes the
misleading appearance of “unclaimed” space without assigning a seam to a
municipality, filling unsubdivided county water or changing official hit
geometry.

## Progressive disclosure

The public runtime keeps these elements out of the default view:

- census tracts or tract screening classifications
- technical evidence, source details and downloads
- advanced map options
- roads or road controls

Tracts load only after an explicit county or town action. Detailed evidence,
limitations and downloads remain collapsed until requested. Facility markers
are location context only and do not create or imply an access-gap
classification.

## Manual QA

After `npm run check` and `npm run build`:

1. Open `/` and confirm the entire view is New Jersey.
2. Confirm the initial layer contains 21 counties.
3. Zoom into several counties and confirm towns/townships appear promptly.
4. Confirm county outlines remain visible at the town level.
5. Inspect several town junctions and confirm there are no white “unclaimed”
   seams; hover/click targets must still follow the official town polygons.
6. Confirm zooming and panning remain responsive.
7. Confirm the map cannot be moved outside New Jersey.
8. Type a single letter in search and confirm matching county and town/township
   suggestions appear; select one and confirm its territory card opens.
9. Confirm each county shows one facility-count marker at county level.
10. Select several county markers and confirm every listed facility shows its
    address and phone number, an available website or an explicit missing state,
    plus Google Maps and Apple Maps directions links.
11. Zoom closer and confirm county counts split into smaller clusters and then
    individual facilities; source rows at the exact same coordinates remain
    grouped so every colocated name and directions link stays accessible.
12. Confirm the resulting descendants receive a visible highlight and that
    boundary-label text never appears over a cluster or medical-pin marker.
13. Confirm no tract or evidence layer appears until **View gap areas** or
    **View gap tracts** is selected.
14. Open several coastal and inland counties and confirm all tract fills and
    missing-data flags stop at the dark selected-county outline.
15. Open a town's gap tracts and confirm its light tract grid and purple
    potential-gap portions stop at the selected-town outline.
16. Confirm the tract map key explains that clipped drawing does not change the
    full official tract evidence record.
17. Select a tract and confirm the brief leads with status and reason, keeps
    full evidence collapsed and preserves missing-data and facility limitations.
18. Copy county, town and tract links; open each in a fresh tab and confirm the
    exact selection returns after loading.
19. Print a selected brief and confirm the map, search and controls are absent
    from the print preview.
20. Download a selected town or tract JSON record and confirm its official GEOID
    matches the brief.
21. Confirm former page and retired prototype routes redirect to `/`.
