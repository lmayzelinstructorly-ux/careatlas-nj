# CareAtlas Project Instructions

CareAtlas is a public health access-gap mapping project.

Future Codex tasks should follow these guidelines and can use this file as the
standard workflow reference.

- This app is called CareAtlas.
- Use React, Vite, TypeScript, Tailwind CSS, and React Leaflet.
- Do not rewrite the whole app unless the user specifically asks for that.
- Only edit files related to the assigned task.
- Keep data files in `/public/data`.
- Do not add login, patient data, diagnoses, or medical advice.
- Present health data as public health indicators only.
- Keep the current public product focused on one New Jersey boundary map with counties and towns/townships only until the base map is explicitly expanded again.
- Do not restore retired Disease Map or Student Opportunities routes unless the user explicitly requests a separate future project.
- Do not label an area as a healthcare-access gap from facility pins alone; follow `docs/access-gap-data-contract.md`.
- After each task, summarize what changed and how to test it.
- Use terminal checks as the routine testing workflow in `CODEX_TESTING.md` and `docs/testing.md`.
- Do not use the app browser connector for routine testing.
- The human user will manually test the app in their own browser with `npm run dev`.
- After editing, Codex must run `npm run check:changed` automatically. Do not
  ask the human user to run terminal checks.
- `npm run check:changed` selects the smallest relevant checks from the Git
  working-tree changes, keeps successful output concise and shows useful output
  when a check fails.
- Use `npm run check` only when the changed-check runner selects it, when doing
  release or deployment work, or when the user explicitly requests the full
  suite.

## Standard Testing Workflow

- Inspect the repo and relevant files before changing anything.
- Codex runs `npm install` if dependencies are missing; do not delegate this to
  the human user.
- Use terminal checks as the routine verification source.
- After edits, run `npm run check:changed`. It automatically runs the full suite
  for healthcare data, boundary data, pipeline scripts and build configuration.
- During debugging, Codex may run one focused check that directly covers the
  failing area, then rerun `npm run check:changed` once after the fix.
- Do not rerun a passing check unless a later edit touched files covered by it.
- Run healthcare validation scripts directly only when diagnosing healthcare
  data, search, markers, summaries, insights or pipeline logic.
- Known healthcare checks in `package.json`:
  - `npm run validate:healthcare`
  - `npm run check:healthcare-quality`
  - `npm run check:healthcare-pipeline`
- Run boundary validation or generation scripts directly only when diagnosing
  boundary data, assignment, summaries, choropleth logic or selected-boundary
  behavior.
- Known boundary checks and generators in `package.json`:
  - `npm run build:data-manifest`
  - `npm run build:search-index`
  - `npm run build:local-search-index`
  - `npm run assign:facility-boundaries`
  - `npm run validate:facility-boundaries`
  - `npm run generate:boundary-healthcare-summaries`
  - `npm run validate:boundary-healthcare-summaries`
  - `npm run check:facility-boundaries`
  - `npm run check:boundary-healthcare-summaries`
  - `npm run check:boundary-healthcare-insights`
- Run `npm run check:changed` once after the final edit.
- Do not run `npm run build` separately after `npm run check`; the full check
  already includes the production build.
- Do not use the app browser connector for routine testing.
- If the browser connector or preview fails, do not treat that as a source-code
  failure by itself.
- The human user will manually test with `npm run dev`.

## Available Project Scripts

These npm scripts currently exist and are commonly relevant to Codex work:

- App lifecycle: `npm run dev`, `npm run build`, `npm run preview`
- Automatic change-aware verification: `npm run check:changed`
- Full verification: `npm run check`, `npm run validate`
- Public map UX: `npm run check:public-map-workflow`
- Healthcare validation: `npm run validate:healthcare`,
  `npm run validate:healthcare:staging`, `npm run validate:healthcare:sources`,
  `npm run check:healthcare-quality`, `npm run check:healthcare-pipeline`
- Healthcare import workflow: `npm run import:healthcare`,
  `npm run import:official-healthcare`, `npm run review:healthcare-source`,
  `npm run stage:healthcare`, `npm run list:healthcare:staging`,
  `npm run review:healthcare:staged`, `npm run promote:healthcare:staging`
- Boundary and geography data: `npm run build:data-manifest`,
  `npm run build:search-index`, `npm run build:local-search-index`,
  `npm run download:boundaries`, `npm run assign:facility-boundaries`,
  `npm run validate:facility-boundaries`,
  `npm run generate:boundary-healthcare-summaries`,
  `npm run validate:boundary-healthcare-summaries`
- New Jersey tract foundation: `npm run build:nj-tract-foundation`,
  `npm run validate:nj-tract-foundation`, `npm run check:tract-evidence-schema`
- CDC PLACES tract evidence: `npm run import:cdc-places`,
  `npm run check:cdc-places-importer`, `npm run validate:cdc-places`
- Batch 6 evidence: `npm run check:batch6-importers`,
  `npm run validate:batch6`
- Batch 7 transparent flagging: `npm run apply:access-gap-rule`,
  `npm run check:access-gap-rule`,
  `npm run validate:access-gap-classifications`
- Batch 8 public tract map and records: `npm run build:batch8-public-records`,
  `npm run validate:batch8-public-records`, `npm run check:batch8-public-layer`,
  `npm run check:batch8`
- New Jersey town gap foundation: `npm run build:nj-town-gap-foundation`,
  `npm run validate:nj-town-gap-foundation`,
  `npm run check:nj-town-gap-foundation`

## Standard GitHub Workflow

- Work directly on `main` unless the user specifically asks for a branch or PR.
- Check the current branch before editing.
- Pull latest changes before editing.
- Keep changes focused on the assigned task.
- Commit after checks pass.
- Use a clear task-specific commit message.
- Push to GitHub.
- Do not force push.
- Do not create extra branches or PRs unless pushing to `main` is blocked or the
  user asks.

## Data Safety Rules

- Do not add fake healthcare centers to production `facilities.json`.
- Do not invent healthcare records.
- Do not invent coordinates, addresses, services, prices, hours or insurance
  details.
- Demo, sample and template data must stay separate from production data.
- Production healthcare data must be source-backed.
- Missing data should stay unknown.
- Do not publish facility scores, rankings, adjustable weights or best/worst lists.
- Do not claim medical quality.

## Boundary Safety Rules

- Use official Census, legal or administrative boundary data.
- Do not add fake placeholder polygons.
- Do not add natural geography, terrain, parks, mountains or reserves.
- Keep the app focused on mainland/lower 48 U.S. plus Washington, D.C.

## Future Prompt Shortcut

Future Codex prompts can simply say:

`Follow AGENTS.md for standard testing, data safety and GitHub update rules.`
