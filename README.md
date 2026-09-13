# CareAtlas NJ

CareAtlas maps public healthcare-access evidence across New Jersey: 21 counties, 564 towns/townships, 2,181 census tracts and source-backed healthcare facility locations.

[Live site](https://careatlas.lmayzel930.workers.dev)

## Run locally

Install **Node.js 24** (with npm) and Git, then:

```sh
git clone https://github.com/lmayzelinstructorly-ux/careatlas-nj.git
cd careatlas-nj
npm ci
npm run dev
```

This is a private repository, so cloning requires GitHub access. Open the URL printed by Vite, normally **http://localhost:5173**. The local API runs on port **8787**. No account, API key, previous checkout or separately downloaded dataset is needed to run the core app.

County, town, tract and facility data are checked in. Basemap tiles and address lookup use external services. The optional Gemini explainer needs a server-side `GEMINI_API_KEY`; copy `.env.example` to `.env` only if configuring it. Without a key, the map and published evidence still work.

## Run all tests

```sh
npm test
```

This runs `npm run check`: UI tests, data and provenance validation, importer fixtures, map checks, production build, local server HTTP checks and the Cloudflare packaging dry run. It needs no cloud login, API credentials, private data or historical Git tags. The official-source collector check uses isolated fixtures instead of live provider websites. Internet access is needed for the initial `npm ci`.

For focused work, use `npm run test:ui`, or `npm run check:changed` to select checks from your working-tree changes. See [testing](docs/testing.md) and the [demo readiness checklist](docs/demo-readiness-checklist.md).

## Serve a production build locally

```sh
npm run build
npm start
```

Open **http://localhost:8787**. This serves both the built website and its API. `PORT` can override the server port. `npm run preview` serves only Vite's static preview; use `npm start` when testing the API.

## Project structure

- `src/`: React interface and UI tests.
- `public/data/`: published datasets, source archives and isolated test fixtures.
- `server/`: local Node HTTP server and API.
- `worker/`: Cloudflare Worker API adapter.
- `scripts/`: import, review, validation and build tools.
- `docs/`: methodology, data contracts and workflows.

The `/internal-data` development-only review route is excluded from production builds. Source archives, staging data and test fixtures are excluded from the production asset bundle. Data refresh/import commands are maintenance operations, not prerequisites for local use or testing.

## Data interpretation

Screening flags are public-health planning context, not diagnoses, medical advice, rankings or proof that care is absent. Missing evidence stays explicit; facility counts do not determine the gap classification. See [the access-gap rule](docs/batch-7-transparent-flagging.md) and [outside-review kit](docs/outside-review-kit.md).

## Deployment and license

See [deployment](docs/deployment-guide.md) for Node and Cloudflare hosting. Source code uses the [MIT License](LICENSE); underlying datasets retain their publishers' terms.
