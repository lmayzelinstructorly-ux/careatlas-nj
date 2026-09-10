# Testing CareAtlas

Codex runs terminal checks as the routine verification workflow. The human user
does not need to run terminal checks after Codex edits.

## Standard workflow

```bash
npm run check:changed
```

`npm run check:changed` reads the Git working-tree changes and selects the
smallest safe check set. Documentation-only edits need no automated checks.
Normal frontend edits run focused public-product checks and the production
build. Data, pipeline, dependency and build-configuration edits run the full
suite. Passing command output stays concise; failure output includes the useful
tail for diagnosis.

Run it once after the final edit. Do not rerun passing checks unless a later edit
touches covered files.

`npm run check` remains the comprehensive release and deployment suite. It
validates the healthcare data and provenance pipeline, boundary assignments and
summaries, public map behavior, methodology copy, bundle splitting and the
production build.

`npm run build` runs TypeScript, builds the Vite client, copies only allowlisted
production data and validates `dist`. Do not run it separately after
`npm run check`, because the comprehensive suite already includes it.

## Focused checks

Healthcare data:

```bash
npm run validate:healthcare
npm run check:healthcare-quality
npm run check:healthcare-pipeline
```

Doctor-office discovery layer:

```bash
npm run validate:doctor-offices
npm run check:doctor-office-pipeline
npm run check:doctor-office-layer
npm run test:doctor-office-ui
```

The importer is intentionally separate from routine checks because it makes
live official-source requests. After reviewing and updating the pinned source
configuration for a new release, refresh with `npm run import:doctor-offices`,
then run the four checks above. Production validation reconciles source-row
and address-group exclusions, official Census county containment, specialty
counts and forbidden claims.

The importer also writes an ignored, non-production unmatched-address queue.
List it with `npm run review:doctor-office-geocodes`; annotations require
official evidence and cannot add coordinates or publish a record. The UI tests
exercise the rendered specialty and search controls, error handling, freshness
threshold, care-first location cards and keyboard dialog behavior.

Boundary or area-summary work:

```bash
npm run assign:facility-boundaries
npm run validate:facility-boundaries
npm run generate:boundary-healthcare-summaries
npm run validate:boundary-healthcare-summaries
```

New Jersey tract foundation:

```bash
npm run validate:nj-tract-foundation
npm run check:tract-evidence-schema
npm run build:search-index
```

CDC PLACES community-health foundation:

```bash
npm run check:cdc-places-importer
npm run validate:cdc-places
```

Batch 6 social-barrier and shortage evidence:

```bash
npm run check:batch6-importers
npm run validate:batch6
```

Batch 7 transparent flagging:

```bash
npm run check:access-gap-rule
npm run apply:access-gap-rule
npm run validate:access-gap-classifications
```

The focused rule check covers all four states, inclusive threshold edges and
missing-data precedence. The production validator independently recomputes each
state from its disclosed inputs and confirms all 2,181 foundation tracts,
21 county shards, rule provenance, explanations and summary counts.

Retained Batch 8 records and downloads:

```bash
npm run build:batch8-public-records
npm run validate:batch8-public-records
npm run check:batch8-public-layer
npm run check:batch8
```

The Batch 8 validator confirms 2,181 tract JSON/CSV records, 21 county
JSON/CSV summaries, all four screening states, required and context evidence,
explicit missing reasons, source links and dates, separate facility types,
official Census internal points, independently recomputed great-circle nearest-
center distances, county/state totals and the statewide report. The public-layer
check confirms those artifacts remain intact and are connected through the
optional county-to-tract gap workflow. It also guards the plain-language
summary, missing-data flags and full-evidence disclosure. Source-backed New
Jersey facility markers remain separate location context only.

### New Jersey town gap foundation

```bash
npm run build:nj-town-gap-foundation
npm run validate:nj-town-gap-foundation
npm run check:nj-town-gap-foundation
```

The generator creates 21 county-sharded tract-to-town foundation files plus a
statewide summary. Validation proves that all 2,181 tract screening records and
all 564 official town/township boundaries are accounted for, primary assignment
does not double count tracts, fallback assignments meet the disclosed overlap
threshold and unassigned tracts remain explicit. These artifacts provide town
screening context only; they do not classify or score an entire town.

To refresh the pinned production artifacts, run the three source importers in
order, then rebuild the combined coverage summary:

```bash
npm run import:cdc-svi
npm run import:census-acs
npm run import:hrsa-shortage
npm run build:batch6-coverage
```

Public product or copy:

```bash
npm run check:public-map-workflow
npm run check:nj-map-geography
npm run check:public-safety-copy
npm run check:demo-readiness
npm run check:bundle-splitting
```

Deployment:

```bash
npm run check:deploy
```

## Manual QA

Run:

```bash
npm run dev
```

Then inspect `/`. Verify that the former public page URLs and retired prototype
URLs redirect to `/`. The active page must show New Jersey boundaries and
source-backed facility locations: 21 counties at startup and 564
towns/townships after zooming in. County borders must remain visible over the
town layer, the map must stay inside New Jersey, and wheel zoom should be
responsive. Confirm county healthcare counts split into smaller clusters and
individual facility markers, and every panel includes source-backed contact
details plus Google Maps and Apple Maps directions.
Confirm there are no tracts, evidence panels or advanced controls before an
explicit gap-view action. Type one letter into the boundary search, confirm
county and town/township suggestions appear, then
select a result and confirm the map zooms to it and opens its territory card.
Open **Doctor offices** and confirm the map starts with no office markers. Choose
Pediatrics, Dermatology and Oncology in turn. While the production artifact is
loading, no office markers should appear. Each choice must then show clustered
CMS-listed practice locations with its validated pilot count, source freshness,
matching clinician specialties and Census geocoder provenance. It must not
borrow facility pins or change any potential-gap result.
Search the selected specialty by practice name, city, ZIP and provider name,
and confirm both the result count and visible cluster counts update.
At statewide zoom, choosing a county count must open every location represented
by that number without moving or zooming the map. Directions, phone and **Show
on map** must appear before collapsed clinician and listing-source details.
Use the mouse wheel to split counts into smaller clusters, then choose a local
count and confirm it also opens immediately without zooming. Choose **Show on
map** and confirm a distinct highlighted marker remains at that office even when
nearby locations share a point. With the keyboard,
confirm focus enters the details dialog, Tab stays within it, Escape closes it
and focus returns to the triggering marker. Temporarily test an artifact beyond
its 45-day threshold and confirm the historical-data warning appears.
Exercise **Reset map** in each mode. Reset during and after a county/town search
and confirm the map returns to the statewide county view without snapping back;
the boundary query and selected card must clear. In potential-gap mode, also
reset from an address result, tract view and open gap explorer. In healthcare
mode, reset an open or focused facility group. In Doctor offices mode, reset
after selecting a specialty. Address pins, retained tract areas, open explorer
or facility panels, highlights and doctor-office markers must all clear, while
the selected top-level map mode remains active.
Open a county- or town-scoped gap view, select a tract, copy its link and confirm
the same tract brief returns after refresh. Confirm the brief keeps technical
evidence collapsed by default, downloads the selected GEOID and prints without
the map or controls.
Open **How gaps are found** and confirm the published three-part rule, four
screening states, contextual evidence and claim limits are readable without
requiring a network request.

The app browser connector is not part of routine verification. A preview-tool
failure is not by itself a source-code failure.
