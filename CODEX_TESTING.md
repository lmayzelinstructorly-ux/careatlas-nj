# CareAtlas testing

Codex runs terminal checks automatically after edits. The human user does not
need to run these commands.

```bash
npm run check:changed
```

The changed-check runner reads the Git working-tree changes and selects the
smallest relevant checks. It skips documentation-only changes, uses focused
checks plus a production build for normal frontend work, and uses the full
suite for data, pipeline, dependency or build-configuration changes. Successful
check output is intentionally concise.

Do not run `npm run build` after `npm run check`; the full suite already builds
the production app. Do not rerun passing checks unless covered files changed.

Codex can run focused checks while diagnosing a failure:

```bash
npm run validate:healthcare
npm run check:healthcare-pipeline
npm run validate:doctor-offices
npm run check:doctor-office-pipeline
npm run check:doctor-office-layer
npm run test:doctor-office-ui
npm run validate:facility-boundaries
npm run validate:boundary-healthcare-summaries
npm run check:public-map-workflow
npm run check:nj-map-geography
npm run check:public-safety-copy
npm run check:demo-readiness
npm run check:bundle-splitting
npm run check:cdc-places-importer
npm run validate:cdc-places
npm run check:batch6-importers
npm run validate:batch6
npm run check:access-gap-rule
npm run validate:access-gap-classifications
npm run check:batch8
npm run validate:batch8-public-records
npm run check:batch8-public-layer
```

For manual QA:

The resident journey now defaults to **Potential gaps**. Verify the Newark
example, direct town search (including the two Pembertons), choosing another
place, the mobile tract list, shared-link reload, and a missing-evidence
result. At 1280 × 720, 390 × 844 and 360 × 640, map and sidebar must occupy
separate regions, with the heading and close button unobscured. Printing must
show the full brief and omit search controls. `npm run test:ui` exercises the
real welcome, header, search, result, copy, print and error interactions;
browser QA is still needed for layout because jsdom has no layout engine.

For a ZIP extraction without Git history, provide the actual changed paths:
`npm run check:changed -- --files=src/pages/MapPage.tsx,src/styles.css`.
The same runner still selects the appropriate checks; do not pass an empty
or incomplete list to skip validation.

```bash
npm run dev
```

Inspect `/`. The former `/map`, `/methodology` and `/about` URLs and retired
prototype URLs must redirect to `/`.

Confirm the map displays only New Jersey. It should open on 21 counties, switch
to 564 towns/townships as the user zooms in, retain county outlines over towns,
and use smooth native wheel zoom. County-level healthcare counts should split
into smaller clusters and individual source-backed facility markers as the user
zooms. Clicking every count or marker should expose facility names and Google
Maps directions. Tracts, evidence panels and advanced controls must not appear
until the user opens a county- or town-scoped gap view. Confirm a copied county,
town or tract link restores the same official GEOID after refresh, and confirm
the selected local context brief prints without map chrome.

Open **Doctor offices** and confirm that no markers appear before a specialty is
chosen. The initial foundation should offer Pediatrics, Dermatology and
Oncology. Each selection should show its validated pilot count, split statewide
county clusters into smaller location clusters as the map zooms, and expose CMS
source specialty, practice-address, NPPES review and Census geocoder details.
Search by practice name, city, ZIP and provider name. County count clicks should
open the complete grouped location list without changing zoom. Directions,
phone and **Show on map** actions should appear before the collapsed clinician
and source details. **Show on map** should leave a highlighted office marker,
and the details dialog should trap focus and close with Escape. Mouse-wheel
zoom should continue to split counts into smaller clusters without marker-click
zoom.
Confirm the mode keeps its explicit incomplete-directory language and never
changes the potential-gap mode.

See `docs/testing.md` and `docs/access-gap-data-contract.md` for the detailed
workflow and data-claim rules.
