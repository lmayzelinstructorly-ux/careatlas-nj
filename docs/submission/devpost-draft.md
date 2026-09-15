# Devpost submission draft

Prepared September 15, 2026. This is draft copy, not a submitted entry.

## Project name

CareAtlas NJ

## Elevator pitch

Explore New Jersey healthcare-access evidence by town, understand tract-level screening flags, and trace every explanation back to official sources.

## Inspiration

Public health data is available, but a resident should not need to reconcile census identifiers and several agency datasets just to understand the evidence around their town. CareAtlas brings that evidence into one navigable map with explanations, source links and clear limitations.

## What it does

Residents can search a New Jersey municipality, explore its census tracts, inspect the evidence behind a screening result, and share or export a brief. The application covers 564 municipalities and 2,181 census tracts. It distinguishes potential gaps, elevated need without a matched shortage designation, no current flag, and insufficient evidence. Facility and specialist-office locations provide context; their pin counts do not determine a flag.

The result is a screening explanation, not a diagnosis, an individual prediction or proof that a resident cannot obtain care.

## How it was built

The pipeline joins official Census geography, CDC PLACES health estimates, New Jersey-relative CDC/ATSDR SVI ranks, and HRSA shortage designations using geographic identifiers. It preserves missing values and source provenance, evaluates an explicit versioned rule, and packages tract records into county files. ACS measures and HRSA/CMS facility information add context. A town crosswalk connects resident searches to tract evidence.

React, TypeScript, Vite, Tailwind CSS and React Leaflet provide the interface. Node.js supports local operation and Cloudflare Workers hosts the live application. The repository includes runtime data, fixtures, maintenance scripts and automated checks, so the core app and tests do not require private API keys. See the repository README for setup and the contribution document for dataset versions and reuse notices.

## Challenges

Geographic joins, mixed source vintages, missing observations and the interpretation of percentile ranks required particular care. A review identified that the imported SVI file uses New Jersey-relative ranks; labels and explanations were corrected accordingly. The classification values were unchanged by that correction. Printing was also extended to loaded results without a potential-gap flag.

## Accomplishments

CareAtlas connects a town search to inspectable tract evidence and a reusable brief. Automated checks cover data consistency, rule behavior, interface behavior, production builds and deployment packaging. A sensitivity analysis documents how alternate thresholds change results rather than presenting the chosen thresholds as empirically validated.

## What was learned

Correct computation and trustworthy interpretation are separate problems. Missing evidence needs its own state, source dates need to remain visible, and a readable explanation must preserve the limitations of the underlying measurements. Automated and AI-operated reviews cannot stand in for resident usability sessions or an independent public-health/GIS review.

## What's next

Conduct real resident usability sessions and obtain an independent methods review, then use those findings to refine the interface and screening explanation. Improve source-refresh verification and complete cross-browser print/download checks. There are currently no completed resident sessions or qualified external methods reviews recorded in the project.

## Development and AI disclosure

The author reports beginning implementation August 1, 2026 and never entering substantially the same project elsewhere. September GitHub commits imported an existing local project in installments; they are not a daily development history. Earlier dates in imported source metadata remain unreconciled with that reported timeline and are documented in contribution.md.

OpenAI ChatGPT/Codex assisted with code changes, debugging, tests, repository organization, documentation, browser QA and submission preparation. Google Gemini is an optional explanation integration, disabled in the demonstrated deployment; it does not calculate screening flags. The walkthrough uses actual application screenshots and synthetic English narration, rather than a continuous screen recording.

## Built with

React; TypeScript; Vite; Tailwind CSS; Leaflet; React Leaflet; Node.js; Cloudflare Workers; Vitest; Census TIGERweb and ACS; CDC PLACES; CDC/ATSDR SVI; HRSA; CMS/NPPES; OpenAI ChatGPT/Codex; optional Google Gemini integration (disabled in demo).

## Links and assets

- Live application: https://careatlas.lmayzel930.workers.dev
- Repository: https://github.com/lmayzelinstructorly-ux/careatlas-nj (currently private; does not yet satisfy the public-source requirement).
- Suggested track: Track 03, open technical innovation. This project does not claim to be a predictive ML model or diagnostic system.
- Video: assets/careatlas-walkthrough.mp4, 3:17; upload to a permitted video host and add its public/unlisted URL.
- Screenshots: assets/search.png, assets/tract.png, assets/sources.png, assets/export.png.
- Final entry needs the author's real full name and confirmed eligibility; do not infer either from an account handle.

## Resume after changing ChatGPT accounts

Open the existing CareAtlas folder and read AGENTS.md, this draft, README.md in this directory, contribution.md and methods-review.md. Run git status before changes and preserve pending work. GitHub and Devpost are separate accounts; retain access to the existing repository owner. Never store credentials in this document.

As of this draft, Devpost account lmayzel930 is signed in in Chrome. The Global Innovation Build Challenge V2 registration page is awaiting the user's eligibility confirmation and acceptance of the rules. No competition project has been created or submitted by this workflow yet. Resume from the visible browser state, since this status can become stale.

Next: finish registration; create and save the project draft; add screenshots and hosted video; resolve public repository access with the owner; review all fields and eligibility before final submission. Official requirements: https://gibc-v2.devpost.com/rules. Deadline shown by Devpost: October 1, 2026, 11:45 a.m. EDT.
