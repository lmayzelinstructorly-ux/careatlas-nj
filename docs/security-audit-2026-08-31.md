# CareAtlas NJ security audit — 2026-08-31

This is a focused code, dependency, deployment and privacy review of the public
CareAtlas NJ map and its small same-origin API. It is not a third-party
penetration test.

## Result

No known dependency vulnerability, tracked secret or unmitigated high-risk
finding was found in the reviewed scope. The optional Gemini feature remains
off unless a dedicated server-side key is configured.

This review replaces the July 16 audit. The August review upgraded the packages
that had entered vulnerable advisory ranges:

- `react-router-dom` and `react-router`: 7.16.0 to 7.18.3
- `postcss`: 8.5.19 to 8.5.26
- `nanoid`: 3.3.12 to 3.3.18
- `adm-zip`: 0.5.17 to 0.6.0

Both `npm audit` and `npm audit --omit=dev` reported zero known
vulnerabilities after those upgrades.

## Checks and controls

- A tracked-file pattern scan found no likely Google/Gemini key or private-key
  block. No tracked `.pem` or `.key` file exists; `.env.example` contains names
  and safe placeholders only, while local environment files remain ignored.
- Production responses set a restrictive Content Security Policy, deny
  framing, disable MIME sniffing and unused browser permissions, limit
  referrer detail and set HSTS.
- API routes use explicit methods, JSON content-type checks, a 2 KB body limit,
  no-store responses and per-IP request quotas.
- Only production-allowlisted files enter `dist`; the Gemini tract lookup
  accepts only an 11-digit New Jersey tract GEOID and constructs a fixed shard
  path.
- Address lookup uses a fixed official New Jersey geocoder endpoint. CareAtlas
  does not log or persist the searched address, and no address is included in
  the Gemini request.
- The public React runtime does not use `dangerouslySetInnerHTML`, `eval` or
  dynamically generated executable code. External public links are fixed or
  come from validated source artifacts and open with `rel="noreferrer"`.
- The primary deployment is now configured for Cloudflare Workers with Static
  Assets. Static files use the CDN path, while only `/api/*` and `/healthz` run
  lightweight Worker code; this removes the Render Free container wake-up from
  the recommended public URL without a paid compute plan.

## Optional Gemini boundary

Gemini has one narrow role: on explicit request, it may rephrase an already
computed public tract screening result. It cannot classify a tract or change
the deterministic status.

- Only `GEMINI_API_KEY` enables the feature; the key never enters Vite or the
  client bundle.
- The browser sends only the selected public tract GEOID. The server loads a
  small allowlisted subset of that tract's public record.
- There is no free-form prompt and no patient, facility, street-address or
  resident data in the model input.
- Requests set `store: false`, use JSON-schema structured output and cap model
  response size.
- Server validation rejects malformed, oversized or advisory/ranking output.
  The UI labels accepted wording as AI-generated and points back to the
  published data and sources.

Google's relevant controls are documented in the official
[API-key security guidance](https://ai.google.dev/gemini-api/docs/api-key),
[structured-output guide](https://ai.google.dev/gemini-api/docs/structured-output)
and [logging documentation](https://ai.google.dev/gemini-api/docs/logs-datasets).

## Verification

The August release gate covers dependency advisories, the Gemini safety fixture,
public-health copy, county/town coverage totals, TypeScript, the production
build and the data pipelines. The deployment-route test separately checks API
fallthrough, disabled-AI behavior, cache rules, compression and security
headers.

## Remaining operational risks

- A live Gemini response was not sent during this audit because no API key was
  present. Mocked structured and unsafe responses cover the integration logic;
  the live feature still needs a one-time deployment smoke test after a key is
  configured.
- Rate limits are in memory and apply per Worker isolate. If CareAtlas grows
  beyond the competition-demo traffic profile, move them to a shared gateway
  or rate-limit store.
- Automated checks do not replace manual keyboard, small-screen and map
  interaction testing in the deployed browser.
- The Cloudflare repository integration completed successfully, and the first
  live deployment passed direct SPA, health, API-status, JSON-404, security-
  header and warm-response smoke tests at the production Worker URL.
- Dependencies, source datasets and model behavior change over time; rerun this
  audit for meaningful releases and key/model changes.
