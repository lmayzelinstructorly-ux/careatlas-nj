# Search repair — September 16, 2026

The resident search now ranks exact and prefix matches before approximate matches. Longer query words tolerate bounded spelling errors and adjacent transpositions, using the same matching logic for every NJ place. Tested examples include nwark, ed, ediosn, jersey ci, newark city nj and piscatway. The result limit remains 16 and search stays local to the already-loaded official boundaries.

Address suggestions now begin at two characters rather than silently requiring a number. When a numbered address has no suggestions, the official NJ locator supplies possible spelling corrections, which are resolved back to official selectable suggestions. A user still selects a result before geocoding; location acceptance retains the NJ bounds and minimum score checks and now rejects locality/street-name-only matches. Not every partial query or typo has a result in the upstream service.

Related fixes prevent old suggestions and pending geocodes from overriding edited/cleared input, close empty results with Escape, remove references to hidden active options, distinguish town-data loading from no match, and avoid repeated legal-type suffixes such as Jersey City City.

Validation: 34 UI tests passed, including 10 new search regressions. New offline address-service fixtures passed. The full release checks were executed; copy/implementation assertions and the former four-character invalid-input fixture were updated to the new behavior, and failed/remaining checks were rerun successfully. Production build, local HTTP checks, Cloudflare dry run, bundle and search performance checks passed. No production data changes resulted.

Deployed Cloudflare version: e75c49cd-3d15-431b-8d1e-fa4b218c6e0b. Live HTTP checks returned six suggestions for both 920 Br and 920 Brod, Nwark, and confirmed the updated frontend bundle. A direct official-service check resolved the corrected Newark address as a PointAddress with score 100. Chrome was disconnected at final verification; no fresh manual Chrome search pass is claimed.

The Devpost entry remains unsubmitted, with its video URL blank.
