# Codex Task Checklist

Use this checklist before finishing a CareAtlas task.

## Changed Files

- What files changed?
- Did `package.json` change?
- Did `package-lock.json` change?
- Did generated data files change?
- Did files in `public/data` change?

## Terminal Checks

- What scripts were run?
- Did `npm run check` pass when the task was meaningful code or data work?
- Did `npm run build` pass?
- Did relevant validation scripts pass, and what was the validation result?
- Did `npm run validate:healthcare` pass when healthcare data, scoring or data
  quality changed?
- Did generated data scripts run when generated data changed?
- Did `npm run build:data-manifest` run when geography manifest inputs changed?
- Did `npm run build:search-index` run when boundary search data changed?
- Did `npm run check:map-search-performance` pass when map search loading or
  generated search shards changed?
- Did `npm run build:local-search-index` run when local jurisdiction search data
  changed?

Use npm scripts and terminal output as the source of truth.

## Package Changes

- Were dependencies added, removed or updated?
- If `npm install` changed `package-lock.json`, was the change expected and
  needed?
- Were any heavy browser testing frameworks avoided unless explicitly requested?

## Manual Testing Recommendations

Tell the user what they should manually test with:

```bash
npm run dev
```

Recommend manual testing for:

- `/`
- `/map`
- Boundary clicking
- Boundary search
- Road modes
- Healthcare features when the task touched healthcare code or data

Do not include app browser connector testing as a required step.

## GitHub Status

- What branch is the work on?
- Was a commit created, and what was the commit message?
- Was the branch pushed?
- Was a pull request created or updated?
