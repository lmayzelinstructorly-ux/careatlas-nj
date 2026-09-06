# Healthcare Provider Review Workflow

This workflow turns unknown-marker audit findings into source-backed manual
enrichment without changing production data until a reviewer explicitly applies
an approved plan.

## Open the Top Provider Packet

Run the audits and packet generator:

```powershell
npm run audit:healthcare-unknown-marker-rescue
npm run generate:healthcare-provider-review-packets
```

Open `tmp/healthcare-unknown-marker-rescue.json` and start with
`summary.easiest50RecordsToRescue`. If a record has `providerPacketPath`, open
that packet. The packet index is at `tmp/provider-review-packets/index.json`.

Each generated packet also has a reviewed JSON starter template under:

```text
tmp/provider-review-packets/reviewed-template/<provider-slug>.reviewed.json
```

Copy a template into:

```text
tmp/provider-review-packets/reviewed/<provider-slug>.reviewed.json
```

## Allowed Sources

Use source-backed pages that are official or explicitly approved:

- Official facility page.
- Health system location page.
- Other official provider page.
- Federal, state or local open data.
- Regulated directory.
- Approved nonprofit directory.
- Approved API.

Keep missing data unknown when the source does not state it.

## Banned Sources

Do not use:

- Google Maps, Google Places or Google reviews.
- Yelp.
- Reviews, ratings, patient comments or copied review snippets.
- Social posts.
- Random directories or unsourced snippets.

Do not convert weekly HRSA/CMS hours into daily hours. Do not copy facility type
or site type into `services`.

## Fill the Reviewed JSON

Required top-level fields:

- `providerGroup`
- `reviewedBy`
- `checkedDate` in `YYYY-MM-DD`
- `sourceUrl`
- `sourceTitle`
- `sourceType`
- `sourceAppliesTo`
- `facilityIds`

Use `single_location` for one facility ID only. Use `all_listed_locations` only
when the official source clearly applies to the exact `facilityIds` listed and
the field evidence says why. Use `organization_wide_policy` only for `cost` or
`insurance`.

For each field, set `apply: true` only when the value is source-backed. Add a
short evidence note that explains what the source says and why it applies.

## Build Reviewed Enrichment Input

Run:

```powershell
npm run build:healthcare-provider-reviewed-enrichment
```

This writes:

- `tmp/provider-reviewed-healthcare-enrichment-input.json`
- `tmp/provider-reviewed-healthcare-enrichment-plan.json`
- `tmp/provider-reviewed-healthcare-enrichment-report.json`

The command validates reviewed files, writes source-backed `fieldSources`, and
automatically runs:

```powershell
npm run plan:healthcare-enrichment -- --input=tmp/provider-reviewed-healthcare-enrichment-input.json --output=tmp/provider-reviewed-healthcare-enrichment-plan.json
```

It does not apply with `--write`.

## Inspect and Apply

Inspect `tmp/provider-reviewed-healthcare-enrichment-plan.json`. Only continue
when the applicable records and field changes match the reviewed source
evidence.

To apply after review, run the apply command intentionally with `--write`:

```powershell
npm run apply:healthcare-enrichment -- --input=tmp/provider-reviewed-healthcare-enrichment-input.json --write
```

After applying, rerun:

```powershell
npm run audit:healthcare-access-coverage
npm run audit:healthcare-unknown-marker-rescue
npm run audit:healthcare-provider-enrichment-opportunities
npm run generate:healthcare-provider-review-packets
npm run check
```
