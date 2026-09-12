# Student Opportunities Manual Discovery Workflow

Student Opportunities is a source-backed index of health, medicine, public
health, research, volunteer, internship, course, summer program, shadowing,
competition, and related student opportunities.

This feature is intentionally limited:

- It is not a complete list.
- It does not rank or rate programs.
- It does not verify admissions value, acceptance chances, program quality,
  deadlines, fees, eligibility fit, or outcomes.
- It provides source links so users can verify details before relying on a
  listing.

Production listings appear on the public Student Opportunities page only after
source capture, staging, manual review, approval, promotion, and validation.

## Source Evidence

Acceptable source evidence includes:

- Official program page.
- Official organization page.
- Government page.
- University, hospital, or nonprofit page.
- Official application page.
- Official PDF or announcement page.

These are not acceptable by themselves:

- Random blog list.
- AI-generated summary.
- Reddit or forum post.
- Search result snippet.
- Unsourced spreadsheet.
- "Heard from someone" notes.
- Review or rating site.
- Marketing claim that does not identify the actual opportunity.

## Manual Discovery Steps

1. Search manually for candidate programs.
2. Open the actual source page.
3. Confirm the source page supports the title, organization, and basic
   description.
4. Copy the source URL.
5. Fill the CSV template with only facts supported by the source.
6. Leave unknown fields blank or use conservative text such as
   `See source page.`
7. Stage the CSV with the student opportunities staging script.
8. List staged records.
9. Manually review each source before approval.
10. Promote only after review.

The template lives at:

```text
public/data/student-opportunities/imports/student-opportunities-template.csv
```

That file is an import template only. It is not production data, is not loaded
by the public page, and should contain only the header row until real
source-backed candidates are intentionally collected.

## Commands

Run staging and review commands as dry runs first. Add `--write` only when you
intend to save the result.

Stage a completed CSV as a dry run:

```bash
npm run stage:student-opportunities -- --input=public/data/student-opportunities/imports/student-opportunities-template.csv --source-name="Manual source review"
```

Stage and save intentionally:

```bash
npm run stage:student-opportunities -- --input=public/data/student-opportunities/imports/student-opportunities-template.csv --source-name="Manual source review" --write
```

List staged records:

```bash
npm run list:student-opportunities:staging
```

Create a review packet as a dry run:

```bash
npm run create:student-opportunities-review-packet
```

Save the review packet intentionally:

```bash
npm run create:student-opportunities-review-packet -- --write
```

The review packet is for manual review only. It summarizes staged records,
source links, staging issues, and reviewer checklist items; it does not approve,
promote, publish, or change any opportunity record.

Review a staged record as a dry run:

```bash
npm run review:student-opportunities:staged -- --id=<staging-id> --status=approved --notes="Source checked" --clear-issues
```

Review and save intentionally:

```bash
npm run review:student-opportunities:staged -- --id=<staging-id> --status=approved --notes="Source checked" --clear-issues --write
```

Promote approved staged records as a dry run:

```bash
npm run promote:student-opportunities:staging
```

Promote and save intentionally:

```bash
npm run promote:student-opportunities:staging -- --write
```

Validate production opportunities:

```bash
npm run validate:student-opportunities
```

Run the full project check:

```bash
npm run check
```

## Review Checklist

Before approving a staged record, the reviewer must confirm:

- Source URL opens and is relevant.
- Title is supported by the source.
- Organization is supported by the source.
- Opportunity type is reasonable.
- Audience is supported or conservatively described.
- Modality and location are supported or left unknown or blank.
- Deadline is supported or `See source page.`
- No medical advice.
- No admissions guarantee.
- No quality or ranking claim.
- No inferred eligibility, fees, outcomes, or acceptance chances.

If any item is uncertain, do not approve the record. Keep the staging status as
pending, rejected, or needing more source information until the source evidence
is strong enough.

## Source-Backed Location Coordinates

Coordinates are optional. Existing records do not need latitude or longitude,
and blank coordinates are preferred unless the location is source-backed or
manually verified from a source.

Do not infer coordinates from city, state, organization name, or general program
copy. Do not use external geocoding unless a future task explicitly approves
that workflow. If coordinates are supplied, latitude and longitude must both be
present, valid numeric values, and supported by `locationSourceUrl` plus
`locationProvenanceNotes` explaining how the location was source-backed or
manually verified.

Clinic-level matching should not be built until opportunity coordinates or
equivalent source-backed location details are available. State overlap reports
are readiness checks only; they do not calculate distance or claim nearby
clinics.

## CSV Column Guidance

Do not add fake programs, sample programs, or placeholder rows. The CSV template
contains only headers on purpose.

- `id`: Stable slug for the opportunity. Use a conservative human-readable slug
  only after the source-backed record is ready to stage.
- `title`: Opportunity title exactly as supported by the source.
- `organizationName`: Organization responsible for the opportunity.
- `opportunityType`: One of `volunteer`, `internship`, `research`,
  `shadowing`, `competition`, `course`, `summer_program`, or `other`.
- `audience`: Source-backed or conservative audience description.
- `city`: City only when supported by the source.
- `state`: Two-letter state only when supported by the source.
- `locationName`: Optional source-backed campus, site, building, or location
  name.
- `latitude`: Optional source-backed or manually verified latitude. If present,
  `longitude`, `locationSourceUrl`, and `locationProvenanceNotes` are required.
- `longitude`: Optional source-backed or manually verified longitude. If
  present, `latitude`, `locationSourceUrl`, and `locationProvenanceNotes` are
  required.
- `locationSourceUrl`: URL for the source used to support the coordinates or
  location details.
- `locationProvenanceNotes`: Short explanation of how the location or
  coordinates were source-backed or manually verified.
- `modality`: One of `in_person`, `remote`, `hybrid`, or `unknown`.
- `focusAreas`: Source-backed focus areas separated with semicolons.
- `eligibilitySummary`: Brief supported eligibility summary, or
  `See source page.`
- `deadlineText`: Supported deadline text, or `See source page.`
- `sourceName`: Name of the official/source page or organization.
- `sourceUrl`: URL for the source page used to support the listing.
- `dateFound`: Date the source was found, formatted as `YYYY-MM-DD`.
- `lastChecked`: Date the source was last checked, formatted as `YYYY-MM-DD`.
- `provenanceNotes`: Short notes about what the source supports.
- `dataCompletenessNotes`: Short notes about fields left unknown or incomplete.

When in doubt, leave a field blank or point users back to the source page. Do not
infer eligibility, fees, outcomes, deadlines, or acceptance chances from vague
copy.
