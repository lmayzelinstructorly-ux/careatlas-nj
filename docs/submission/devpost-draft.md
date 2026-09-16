# Devpost submission draft

Updated September 16, 2026. This is draft copy, not a submitted entry.

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

- Live application: <https://careatlas.lmayzel930.workers.dev>
- Repository: <https://github.com/lmayzelinstructorly-ux/careatlas-nj> (public; visibility verified September 15, 2026)
- Suggested track: Track 03, open technical innovation. This project does not claim to be a predictive ML model or diagnostic system.
- Video: pending. Use [the live recording script](demo-recording-script.md) for the final demo. The older [screenshot-based walkthrough](assets/careatlas-walkthrough.mp4) remains clearly labeled.
- Gallery: [town search](assets/search.png), [source evidence](assets/sources.png), and [export controls](assets/export.png), with additional screenshots available in this directory.
- Project card: [PNG](assets/careatlas-brand-card.png) and editable [SVG](assets/careatlas-brand-card.svg).

## Submission status

| Item | Status |
| --- | --- |
| Public repository | Ready |
| Live application | Ready |
| Draft story and technology list | Ready for final review |
| Captioned gallery images | Ready |
| New continuous demo recording | Pending |
| Final rules/eligibility review | Pending |
| Final Devpost submission | Not submitted |

Before submission, verify the current [Global Innovation Build Challenge V2 rules](https://gibc-v2.devpost.com/rules), record and upload the final demo, review every public claim against the running application, and complete the final eligibility and submission steps manually.
