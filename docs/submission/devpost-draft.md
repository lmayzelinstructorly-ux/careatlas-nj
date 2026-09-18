# Devpost submission draft

Updated September 17, 2026. This copy is saved in the Devpost draft; the entry has not been submitted.

## Project name

CareAtlas NJ

## Elevator pitch

Explore New Jersey care locations and access evidence by town, then trace each screening result to official sources.

## Project story

**Track 03 — Open (General Technical Invention)**

### Inspiration

Healthcare-access information is spread across directories, maps and agency datasets. A resident may want to know which care locations are recorded nearby, whether a specialty office appears in a public snapshot, and why a census tract received an access-screening result. CareAtlas NJ brings those questions into one map while keeping the underlying sources and limits visible.

### What it does

Search a New Jersey town or township, or locate a tract from a street address, then switch among three views:

- **Hospitals & community health centers:** Explore 62 hospitals and 153 HRSA community health centers with source-backed location and contact details.
- **Doctor offices (pilot):** Search 734 CMS-listed office locations across pediatrics, dermatology and oncology by ZIP, town, practice or clinician. Open the filtered results, inspect the listed clinicians, and find phone numbers or directions. This monthly snapshot is incomplete and does not confirm appointments, insurance or current operation.
- **Potential gaps:** Explore screening results for 2,181 census tracts connected to 564 municipalities. Select a tract to see the rule's inputs, an explanation, source dates and limitations. Copy a link, print a brief or download the published record.

A quick tour: choose Newark City to explore recorded care sites, select Dermatology and search Edison in the office pilot, then open a Newark tract's evidence brief. The three views answer different questions. Facility and office pins never determine a tract's gap status.

CareAtlas is a planning and explanation tool. A flag is not a diagnosis or proof that care is unavailable; no current flag is not proof that access is adequate; and a missing marker does not mean no provider exists.

### How I built it

The data pipeline joins official Census geography, CDC PLACES estimates, New Jersey-relative CDC/ATSDR Social Vulnerability Index ranks, and HRSA shortage designations. It preserves missing values and source provenance, applies a versioned screening rule, validates tract records and publishes county-sized files. Census ACS measures and HRSA/CMS facility data add context. A geographic crosswalk connects familiar town names to tract evidence.

The interface uses React, TypeScript, Vite, Tailwind CSS and React Leaflet. Node.js supports local development; Cloudflare Workers serves the deployed app. The public repository includes setup instructions, runtime data, tests and validation scripts. The core map and checks require no private API key.

### Challenges and decisions

The hardest work was making different geographic units, source dates and missing observations understandable together. A review found that the imported SVI ranks are relative to New Jersey, so I corrected the labels and explanations without changing the underlying values or classifications. I also kept the care-location and office layers separate from the screening rule so a dense or sparse set of pins cannot create a misleading flag.

The office pilot maps only address groups with an accepted Census geocode. Its records are shown as source listings, not provider recommendations. On the interface side, I made filtered office results reachable directly and moved tract source dates and links closer to the result.

### Accomplishments and what I learned

CareAtlas is a working, deployed application with a reproducible local setup. Residents can move from a place they know to care listings or a tract result, inspect the supporting record, and retain a shareable or printable brief. Automated checks cover data consistency, rule behavior, interface behavior and deployment packaging. An offline sensitivity analysis shows how classifications change under alternative thresholds; it does not claim the chosen thresholds are empirically validated.

This project taught me that correct computation and trustworthy interpretation are separate tasks. Unknown evidence must stay unknown, source dates must remain visible, and an explanation must preserve the limits of the original measurements.

### What's next

Run resident usability sessions and obtain an independent public-health or GIS methods review, then use those findings to improve the interface and screening explanations. Neither review has been completed yet.

### Development and AI assistance

I began implementation on August 1, 2026 and have not entered substantially the same project in another hackathon. September GitHub commits uploaded an existing local project in installments; the repository documents that chronology and earlier source metadata. OpenAI ChatGPT/Codex assisted with development, debugging, tests, documentation and submission preparation. Google Gemini is an optional explanation integration, disabled in the demonstrated deployment; it does not calculate screening results.

[Methods, source versions, reuse notes and sensitivity analysis](https://github.com/methmoussa/careatlas-nj/tree/main/docs/submission) are available in the repository.

## Built with

React; TypeScript; Vite; Tailwind CSS; Leaflet; React Leaflet; Node.js; Cloudflare Workers; Vitest; Census TIGERweb, ACS and Geocoder; CDC PLACES; CDC/ATSDR SVI; HRSA; CMS/NPPES; OpenStreetMap/CARTO map tiles; OpenAI ChatGPT/Codex; optional Google Gemini integration (disabled in demo).

## Links and media

- Live application: <https://careatlas.lmayzel930.workers.dev>
- Repository: <https://github.com/methmoussa/careatlas-nj>
- Video: pending. Record and host a 2–5 minute live demonstration using the [recording script](demo-recording-script.md). The older [screenshot-based walkthrough](assets/careatlas-walkthrough.mp4) is a planning artifact, not the intended submission video.
- Gallery: the current Devpost draft opens with the CareAtlas brand card, followed by captioned Newark town-search, tract-evidence and export screenshots. The three app screenshots satisfy the challenge's image minimum. A current care-location or doctor-office capture would show those views more directly when available.
- Project card: [PNG](assets/careatlas-brand-card.png) and editable [SVG](assets/careatlas-brand-card.svg).

## Remaining steps

The Devpost entry is a draft with four of five steps complete. The video URL is blank, and final submission has not occurred. Before submission, upload the live demo to an allowed public or unlisted video host, inspect the rendered gallery and story, and complete the final rules and eligibility review.
