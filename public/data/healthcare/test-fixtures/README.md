# Healthcare Pipeline Test Fixtures

Files in this folder are only for CareAtlas pipeline testing.

They are not real healthcare data, must not be promoted into production
`public/data/healthcare/facilities.json`, and should only be used by scripts
that write to temporary test output files.

The fixture CSV intentionally contains fake demo records so the healthcare
source review, staging, review, promotion and validation workflow can be tested
without inventing real healthcare centers or touching production data.

`hrsa-refresh-audit/` contains a small official-column CSV fixture and a fake
production JSON fixture. They cover stable-ID matching, additions, removals,
duplicates, field changes, invalid coordinates and out-of-bounds coordinates.
The refresh audit check reads these files only and never uses them as production
healthcare records.

`enrichment-provenance.fixture.json` contains fake facilities that exercise the
field-level provenance rules for future enrichment. It includes valid service,
hours and accessibility examples, invalid missing service provenance, invalid
undated hours, organization-wide insurance that is not location-specific,
banned Google/Yelp/review sources, and blank unknown fields that should pass.
