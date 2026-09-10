# Healthcare Import Staging

For the full beginner-safe workflow from CSV review to production promotion,
see `docs/healthcare-data-workflow.md` from the project root.

`facilities.staged.json` stores normalized candidate healthcare facility records before they become production data.

Staged records are not production healthcare data yet. They are candidates created from source-backed imports so reviewers can check structure, missing fields, duplicates and source metadata before anything is promoted to `public/data/healthcare/facilities.json`.

Records must be reviewed before promotion. Use `stagingStatus: "approved"` only when the candidate is source-backed and ready to become production data. Use `pending_review`, `rejected`, or `needs_more_source_info` when more review is needed.

Missing fields should stay unknown. Do not invent coordinates, hours, services, prices, insurance details or accessibility information. Unknown price, insurance and hours fields should be tracked as staging issues, not filled by guesswork.

Demo, sample, test, placeholder or fake-looking rows should not be promoted to production. Keep demo/sample rows in demo files and do not mark them approved for production promotion.

## Review Workflow

1. Stage source-backed records into `facilities.staged.json`.
2. List staged records and filter by review status or data issues.
3. Review one staged record at a time with a dry run.
4. Save the review update with `--write` only after checking the change.
5. Validate staging.
6. Dry-run promotion.
7. Promote approved records with `--write`.
8. Validate production data.
9. Run the end-to-end healthcare pipeline check.
10. Run `npm run check`, run `npm run build`, then manually test with `npm run dev`.

List all staged records:

```bash
npm run list:healthcare:staging
```

List records still waiting for review:

```bash
npm run list:healthcare:staging -- --status=pending_review
```

Preview a review update without changing the staging file:

```bash
npm run review:healthcare:staged -- --id=staged-123 --status=approved --notes="Source checked"
```

Save a review update:

```bash
npm run review:healthcare:staged -- --id=staged-123 --status=approved --notes="Source checked" --write
```

Add a review issue when more source information is needed:

```bash
npm run review:healthcare:staged -- --id=staged-123 --status=needs_more_source_info --issue="Source page does not confirm hours" --write
```

Validate staging:

```bash
npm run validate:healthcare:staging
```

Dry-run promotion:

```bash
npm run promote:healthcare:staging
```

Promote approved records:

```bash
npm run promote:healthcare:staging -- --write
```

Promotion only merges records marked `approved`. It skips rejected records,
pending records, records needing more source information, demo-looking records,
invalid records and duplicate production IDs. In write mode it also updates
`latest-promotion-report.json`.

## End-to-end Healthcare Pipeline Check

Use the isolated pipeline check after changing healthcare review, staging,
approval, promotion or validation scripts:

```bash
npm run check:healthcare-pipeline
```

The check uses fake records from
`public/data/healthcare/test-fixtures/healthcare-pipeline-fixture.csv` and
writes only under `public/data/healthcare/test-fixtures/tmp/`. It reviews the
source CSV, stages fixture records, approves one temporary staged record, leaves
another unapproved, promotes only the approved record to a temporary output,
validates that output, and confirms production `facilities.json` and the real
staging file were not modified.

## Field-level Enrichment Review

Optional enriched services, daily hours, insurance, cost/sliding-fee details
and accessibility values use a `facility.fieldSources` object. Each populated
field must have a matching `fieldSources.<field>` entry with the exact field
name, source URL, source title or label, checked date, source type and
`locationSpecific: true`.

Approve enriched records only when each populated entry is `source_backed`.
Entries with `needs_review`, missing checked dates, generic organization pages,
or banned Google/Yelp/review sources remain blocked from production promotion.
Missing entries mean the source did not provide the field; do not infer a value.
