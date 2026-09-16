# Contributing to CareAtlas NJ

Thank you for helping improve CareAtlas. Changes should keep the project reproducible, cautious in its public-health claims, and usable without private data or credentials.

## Before you start

1. Install Node.js 24 and run `npm ci`.
2. Read the relevant contract or workflow in `docs/` before changing data, screening rules, geography, or source interpretation.
3. Create a focused branch from `main` and keep unrelated changes out of the pull request.

## Project standards

- Use official, source-backed geography and healthcare data. Do not invent facilities, coordinates, access details, or evidence.
- Preserve missing values and provenance. Unknown is not zero.
- Keep facility locations separate from the access-gap classification.
- Do not add patient data, diagnoses, medical advice, facility rankings, or claims that a flag proves care is unavailable.
- Keep test fixtures and staging records separate from production data.
- Prefer small, readable changes within the existing React, TypeScript, Vite, Tailwind, and React Leaflet architecture.

## Validation

Run change-aware checks while working:

```sh
npm run check:changed
```

Before opening a pull request, run the full suite:

```sh
npm test
```

The full suite includes UI tests, data/provenance validation, production packaging, local route checks, and a Cloudflare dry run. If a check cannot run, document the exact command, error, and remaining risk in the pull request.

## Pull requests

Include:

- a concise explanation of the resident or maintainer problem being solved;
- the files and behavior changed;
- commands used for verification;
- screenshots for visible interface changes; and
- any data-source, methodology, accessibility, or deployment limitations that remain.

Do not include credentials, local `.env` files, patient information, or unreviewed production data.
