# Hosting CareAtlas

## Local or self-hosted Node server

Use Node.js 24 and install the locked dependencies:

```sh
npm ci
npm test
npm start
```

The test suite builds `dist/`. Alternatively, run `npm run build` before `npm start`. The server serves the website and API on port 8787; set `PORT` to change it. Check `/healthz` for readiness. Place the server behind an HTTPS reverse proxy when exposing it publicly.

No API key is needed for the core map. Optional Gemini configuration is documented in `.env.example`; keep credentials on the server. Basemap tiles and address lookup require access to their external services.

## Cloudflare Workers

`wrangler.jsonc` serves `dist/` through Static Assets and routes `/api/*` and `/healthz` to `worker/index.mjs`. The check suite includes a local Wrangler dry run; it does not publish anything or require a Cloudflare account.

To publish deliberately, authenticate to the account that should own the Worker:

```sh
npx wrangler login
npm run deploy:cloudflare
```

Review the Worker name in `wrangler.jsonc` before deploying a fork. Configure optional Gemini credentials as Worker secrets, never in client code or Git.

The existing live site is [CareAtlas NJ](https://careatlas.lmayzel930.workers.dev). Pushing code does not itself deploy it. The healthcare refresh workflow is manual because it changes source data and commits the results.
