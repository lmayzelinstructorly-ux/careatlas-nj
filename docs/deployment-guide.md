# Deployment guide: free, no-container-cold-start CareAtlas hosting

This is the practical deployment path for the public URL used in applications,
portfolios and competition submissions. CareAtlas deploys as one Cloudflare
Worker with Static Assets: Cloudflare serves the React build and public data
from its CDN, while the Worker handles `/healthz` and the same-origin `/api/*`
routes.

Current production URL:
[https://careatlas.lmayzel930.workers.dev](https://careatlas.lmayzel930.workers.dev)

This avoids [Render Free's idle container shutdown](https://render.com/docs/free)
without paying for an always-on Node process. Cloudflare Workers use
[lightweight V8 isolates](https://developers.cloudflare.com/workers/reference/how-workers-works/)
rather than starting a Node container for an idle request. On the
[Workers Free plan](https://developers.cloudflare.com/workers/platform/pricing/),
static asset requests are free and unlimited; Worker code has a 100,000-request
daily allowance. The validated CareAtlas build is far below the Free plan's
20,000 file and 25 MiB-per-file static asset limits.

## 1. What is already configured

- `wrangler.jsonc` deploys `dist/` as static assets with SPA fallback.
- Only `/api/*` and `/healthz` run Worker code. Map bundles and data files go
  directly through the free static asset path.
- `worker/index.mjs` preserves the address lookup, optional Gemini explanation,
  JSON body limits, rate limits and security headers.
- `public/_headers` applies the same browser security policy to static assets
  and gives hashed bundles and refreshable public data appropriate cache rules.
- `npm run check:cloudflare-deploy` validates the Worker routes, asset limits,
  headers and a Wrangler deployment dry run.

The existing Node server remains useful for local development and as a legacy
fallback. `render.yaml` is intentionally back on Render Free, so accepting that
fallback cannot accidentally create the $7 monthly compute charge. Render Free
still sleeps and should not be the competition demo URL.

## 2. One-time free Cloudflare setup

1. Create or sign in to a Cloudflare account; no paid Workers plan is needed.
2. In **Workers & Pages**, choose **Create application**, then **Import a
   repository**.
3. Connect this GitHub repository and name the Worker `careatlas` so it matches
   `wrangler.jsonc`.
4. Use `main` as the production branch.
5. Set the build command to `npm run build`. Leave the deploy command at its
   default, `npx wrangler deploy`.
6. Choose **Save and Deploy**. The public URL will use a `workers.dev` subdomain.

Cloudflare's Git integration then rebuilds and deploys pushes to `main` without
requiring a paid runner or storing a deploy token in this repository.

For a one-off CLI deployment instead, run:

```bash
npm ci
npm run check:changed
npx wrangler login
npm run deploy:cloudflare
```

The login step opens Cloudflare authorization in the browser. Never commit the
Wrangler login state, account tokens or runtime secrets.

## 3. Optional Gemini plain-language explainer

CareAtlas works without AI: the published rule, tract status and primary
plain-language explanation are deterministic. To enable the optional Gemini
rephrasing panel, add `GEMINI_API_KEY` as an encrypted Worker secret:

```bash
npx wrangler secret put GEMINI_API_KEY
```

The non-secret model name is already pinned in `wrangler.jsonc`.

- Never prefix the key with `VITE_` or place it in client code.
- Use a Gemini authorization key restricted to the Gemini API.
- Set billing and quota alerts in Google Cloud.
- Keep Gemini project logging disabled for this feature. Requests also set
  `store: false`.
- Redeploy after changing the secret, then verify `/api/ai/status` returns
  `{"geminiExplanation":true}`.

Gemini receives only a server-loaded public tract GEOID and its validated rule
result. It never receives the searched street address, free-form user text or
patient data, and its output cannot alter the published classification.

## 4. Verify the live deploy

Open these on the new Worker URL:

- `/` returns the public New Jersey map.
- `/story` returns the SPA after a hard refresh.
- `/healthz` returns `status: "ok"`, `app: "CareAtlas"` and a timestamp.
- `/api/ai/status` reports whether the optional Gemini secret is configured.
- `/api/not-a-route` returns a JSON 404 instead of the SPA.

Confirm the map opens on New Jersey counties, zooms into towns/townships, keeps
county outlines visible and never leaves New Jersey. Also test address lookup
and, if enabled, one Gemini explanation.

## 5. Make the Worker URL canonical

The first Worker deployment completed successfully on August 31, 2026. For any
future URL or custom-domain change:

1. Update the README live-demo URL.
2. Update the absolute `og:url` and canonical tags in `index.html`.
3. Keep the Render service only as an optional fallback, or suspend it after
   the Worker URL has passed the live smoke test.

For a custom domain, attach a domain managed in the same Cloudflare account.
A custom domain is optional; the free `workers.dev` URL is sufficient for
competition judging.

## 6. Free-plan guardrails

- Static assets do not consume the Worker request allowance because
  `run_worker_first` is limited to `/api/*` and `/healthz`.
- The dynamic allowance is 100,000 requests per day. CareAtlas returns an error
  if the account exhausts that allowance; it never silently starts billing.
- Do not enable the Workers Paid plan unless usage later justifies it.
- Run `npm run check:changed` after changes. Release checks include a Wrangler
  dry run and enforce the current Free-plan asset constraints.
- Keep an uptime check on `/healthz` if desired. It is a real health check here,
  not an artificial ping used to keep a sleeping container alive.
