# Healthcare Source Imports

For the full beginner-safe workflow from CSV review to production promotion,
see `docs/healthcare-data-workflow.md` from the project root.

This folder is for raw or lightly cleaned healthcare facility files that come from official or documented sources. Keep downloaded source files here before converting them into the app-ready `public/data/healthcare/facilities.json` format.

For regional HRSA expansion, use one lowercase state folder per official CSV:

```text
public/data/healthcare/imports/hrsa/<state>/
public/data/healthcare/imports/hrsa/pa/hrsa-pa.csv
public/data/healthcare/imports/hrsa/ny/hrsa-ny.csv
```

Use `npm run healthcare:hrsa:review-source` and
`npm run healthcare:hrsa:stage` with `--input` and `--state`. Full PA and NY
examples are in `docs/healthcare-data-workflow.md`.

Imported data must come from official public agencies, documented open data portals, or other traceable source-backed datasets. Do not scrape random websites or blend unsupported details into source files.

Only fill hours, prices, services, insurance, accessibility, and similar fields when the source file directly supports those values. Unknown values should stay blank, omitted, or explicitly unknown. Do not guess, infer, or label care as free or low-cost unless the source says so.

Demo files in this folder are for testing import mapping only. Do not treat them as real healthcare facilities.

## Source Reviews

Use `source-reviews.json` to track source CSV readiness before any records are
written to production healthcare data. The file defaults to:

```json
[]
```

Review a CSV without writing review metadata:

```bash
npm run review:healthcare-source -- --input=public/data/healthcare/imports/pilot-nj/example.csv --source-name="NJ pilot source" --source-type=official --state=NJ
```

Append or update the review record:

```bash
npm run review:healthcare-source -- --input=public/data/healthcare/imports/pilot-nj/example.csv --source-name="NJ pilot source" --source-type=official --state=NJ --write-review
```

The source review step checks record counts, coordinates, source information,
price information, insurance information, hours and likely duplicate
name/address pairs. It does not write to `facilities.json`; actual imports still
use the staging and promotion workflow.

Validate source reviews with:

```bash
npm run validate:healthcare:sources
```

## Staging Workflow

After source review, stage records for review instead of writing directly to
production:

```bash
npm run stage:healthcare -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ
npm run stage:healthcare -- --input=public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv --source-name="NJ pilot source" --source-type=official --state=NJ --write
npm run validate:healthcare:staging
```

Staged records are written to:

```bash
public/data/healthcare/staging/facilities.staged.json
```

Review that file before promotion. Unknown prices, insurance and hours should
remain unknown unless source-backed. Demo/sample rows should not be approved.

Promote only approved staged records:

```bash
npm run promote:healthcare:staging
npm run promote:healthcare:staging -- --write
npm run validate:healthcare
npm run check
npm run build
```

Promotion skips duplicate production IDs and writes
`public/data/healthcare/staging/latest-promotion-report.json` in write mode.

Production `source-reviews.json` should not contain demo reviews. Use
`source-reviews.sample.json` only for optional examples.

Demo or sample imports must not be written to production
`public/data/healthcare/facilities.json` by accident. The import scripts block
demo-looking input paths or rows when writing to production unless
`--allow-demo-write` is passed explicitly.

Prefer writing demo import output to:

```bash
public/data/healthcare/facilities.demo.json
```

Example:

```bash
npm run import:official-healthcare -- --source=hrsa --input=public/data/healthcare/imports/hrsa-sample.csv --output=public/data/healthcare/facilities.demo.json --write
```

Demo import reports should use `latest-demo-import-report.json`. Keep
`latest-import-report.json` for real production imports only.

## New Jersey Pilot Folder

Use `pilot-nj/` for the first real pilot workflow. Keep source-backed New
Jersey facility files there and use the folder README/template before importing:

```bash
npm run healthcare:pilot-nj:review-source
npm run healthcare:pilot-nj:review-source -- --write-review
npm run healthcare:pilot-nj:stage
npm run healthcare:pilot-nj:stage -- --write
npm run healthcare:pilot-nj:list-staged
npm run healthcare:validate-staging
npm run healthcare:pilot-nj:promote
npm run healthcare:pilot-nj:promote -- --write
npm run healthcare:pilot-nj:validate
```

The expected pilot CSV path is
`public/data/healthcare/imports/pilot-nj/nj-healthcare-pilot.csv`. Start from
`pilot-nj/nj-healthcare-pilot.template.csv`, which is header-only and contains
no fake records.
