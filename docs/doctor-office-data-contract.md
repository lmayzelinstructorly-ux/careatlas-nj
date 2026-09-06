# CareAtlas doctor-office data contract

This contract governs the separate **Doctor offices** provider-discovery map.
Doctor-office records are location context only. They never create, remove,
modify or validate a CareAtlas potential-access-gap classification.

## Product question

The layer may answer:

> Which source-backed practice locations in the current CareAtlas release list
> at least one clinician in the specialty I selected?

It must not claim that the list is a complete directory, that a clinician is
available, that an office accepts a particular patient or insurance plan, or
that one clinician or practice is better than another.

## Evaluated official sources

### CMS Doctors and Clinicians National Downloadable File

The first discovery source is the CMS Provider Data Catalog's
[National Downloadable File](https://data.cms.gov/provider-data/dataset/mj5m-pzi6).
CMS documents one row per clinician/enrollment/group/address combination
(`NPI-Ind_enrl_ID-Org_PAC_ID-adrs_id`), and says that the file uses a 12-month
claims lookback. It supplies clinician identity, primary and secondary
specialties, group affiliation when present, practice address, address ID and
limited contact fields.

This source is preferred over raw NPPES for the first map because its rows are
already organized around Medicare-listed clinicians and practice locations.
Its scope is still limited:

- it covers clinicians and groups listed through Medicare Care Compare, not
  every licensed clinician or practice;
- it uses Medicare PECOS and claims data, not a universal provider census;
- one clinician can appear in several enrollments, groups, addresses or rows;
- credentials and specialties can differ across enrollments;
- an address line may be suppressed, and `ln_2_sprs=Y` means the displayed
  address may be incomplete;
- a listed location does not establish appointment availability, patient
  acceptance, capacity, insurance acceptance, hours, price or quality.

The current field definitions are documented in the official
[Doctors and Clinicians data dictionary](https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/physician/DOC_Data_Dictionary.pdf).

### NPPES

The official [NPPES dissemination page](https://www.cms.gov/medicare/regulations-guidance/administrative-simplification/data-dissemination)
and [download page](https://download.cms.gov/nppes/NPI_Files.html) describe the
monthly replacement file, weekly increments, deactivation file and the
non-primary Practice Location Reference File. The NPI Registry is updated
daily; replacement and incremental files have their own release dates.

NPPES is a supporting identity and status source, not proof of a current
doctor office. CMS states that an NPI does not validate licensing or
credentialing, and NPPES data is reported by providers, representatives or an
organization's authorized official. An active NPI can have stale or
administrative addresses. A deactivated NPI must not be published as an active
provider record.

### U.S. Census Bureau Geocoder

The official [Census Geocoding Services API](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html)
is the coordinate source. It calculates a coordinate from an address range; it
does not verify that a medical practice currently operates at that point.
CareAtlas records the benchmark, match type, matched address and checked date.
Unmatched or ambiguous addresses are not mapped.

## What counts as an office location

CareAtlas uses **CMS-listed practice location** as the precise public label.
An imported row is eligible only when all of the following are true:

1. The row comes from a pinned release of the Doctors and Clinicians National
   Downloadable File.
2. `state=NJ`, `NPI`, `Ind_enrl_ID`, `adrs_id`, street line 1, city and ZIP are
   present.
3. A primary or secondary CMS specialty maps to a published CareAtlas
   specialty family.
4. The NPI is not deactivated in the pinned NPPES status snapshot used for the
   import.
5. The Census geocoder returns one accepted address match with valid
   coordinates inside exactly one official New Jersey county boundary.

This definition does not establish that the location is open to the public or
that the clinician currently sees patients there. Rows with a fully suppressed
street address are excluded. Rows with `ln_2_sprs=Y` may be retained only as a
building-level location, visibly labeled as incomplete; no suite is inferred.

## Specialty normalization

The public selector uses a small, versioned allowlist. Matching is
case-insensitive after whitespace normalization and may use the CMS primary or
secondary specialty fields. The initial families are:

| CareAtlas specialty | Exact CMS specialty labels |
| --- | --- |
| Pediatrics | `PEDIATRIC MEDICINE` |
| Dermatology | `DERMATOLOGY` |
| Oncology | `MEDICAL ONCOLOGY`, `HEMATOLOGY/ONCOLOGY`, `SURGICAL ONCOLOGY`, `RADIATION ONCOLOGY`, `GYNECOLOGICAL ONCOLOGY` |

The family is a search convenience, not a claim that every listed clinician
offers the same services. Source specialty text remains visible on the
provider record. Adding or changing a mapping requires a contract version
change, fixture coverage and production revalidation.

## Grouping and duplicates

- Exact duplicate source rows are identified by
  `NPI + Ind_enrl_ID + Org_PAC_ID + adrs_id` and collapsed while preserving the
  source identity.
- An office group uses the full CMS `adrs_id` plus the normalized complete
  address. The final two address-ID characters are retained so distinct suites
  are not silently merged.
- Multiple rows for the same NPI at one office are displayed as one clinician.
  All distinct source specialties, enrollments and group affiliations remain
  in provenance.
- Multiple clinicians at the same office key are shown under one map location.
- A practice name is displayed only when source rows agree. Otherwise the
  location is labeled **Multiple practices at this address**, with the
  source-listed affiliations shown per clinician.
- Same-looking addresses with different full address IDs remain separate and
  are flagged for review rather than guessed to be one office.

## Active and deactivated records

A pinned NPPES deactivation snapshot is required before promotion. NPIs marked
deactivated on or before the import's checked date are excluded. Reactivated
NPIs may return only in a later import whose pinned source shows them active.
The public record uses `not_deactivated_in_snapshot` precisely: absence from
the pinned report means only **not listed as deactivated in that source
snapshot**. It does not prove current practice activity, licensing, patient
acceptance or appointment availability.

The production artifact records its NPPES release and check dates. If a current
status snapshot is missing, the import may remain in staging but production
promotion must fail.

## Provenance and freshness

The layer-level artifact records:

- schema and specialty-normalization versions;
- CMS dataset ID, source URL, source-data date, release date and checked date;
- NPPES source URL, replacement/status release and checked date;
- Census geocoder benchmark, geography vintage and checked date;
- included and excluded counts by reason;
- an explicit `isComplete: false` coverage statement.

Every office record retains the CMS address ID, contributing source-row IDs,
provider NPIs, source specialty text, NPPES status-check date and geocoder
match metadata. The public control shows the release/check dates; the office
panel shows record provenance and limitations.

Freshness describes the source snapshots, not real-time office status. CMS
publishes a next-update date in the dataset metadata, so CareAtlas records a
monthly review date and treats a CMS snapshot as stale after 45 days. The
public control shows an amber historical-data warning after that threshold;
the warning does not hide records or imply that a more recent office status is
known.

## Production architecture and promotion gate

The reproducible importer is `scripts/importCmsDoctorOffices.mjs`, run through
`npm run import:doctor-offices`. Its pins live in
`scripts/lib/doctorOfficeSourceConfig.mjs`. It:

1. queries New Jersey rows from all five CMS primary/secondary specialty
   fields using exact source-specialty labels after the official metadata API
   confirms the pinned dataset ID, modified date and release date;
2. downloads and parses the pinned official NPPES deactivation workbook;
3. applies the required-field, specialty, deactivation and duplicate gates;
4. groups clinicians with the disclosed full-address identity;
5. submits only eligible groups to the official Census batch geocoder;
6. assigns a county only when the coordinate falls in exactly one official New
   Jersey county polygon; and
7. writes a deterministic artifact with source-result digests, refresh policy
   and exclusion counts; and
8. writes unmatched groups to the ignored, non-production geocode review queue.

Raw CMS responses, NPPES workbook contents and Census batch responses are
processed in memory and are never copied into the production bundle. Future
review packets or cached source material must remain in an ignored working
directory or `public/data/doctor-offices/staging/`, which is explicitly
forbidden from the production build. The allowlisted runtime artifact is:

`/public/data/doctor-offices/nj.json`

The importer writes unmatched address groups to
`public/data/doctor-offices/staging/unmatched-geocodes.review.json`. Use
`npm run review:doctor-office-geocodes` to list or annotate them. Any
non-pending review status requires an official evidence URL. Review records do
not accept manual coordinates and never publish a location: an office remains
excluded until a later official-source import receives an accepted Census
geocode inside exactly one official New Jersey county.

Records may be promoted only when the reproducible importer and independent
validator demonstrate all of these checks:

1. pinned official source URLs and release/check dates;
2. required source columns and source-row identity;
3. exact specialty mapping with unmapped values reported;
4. NPPES deactivation handling and snapshot coverage for every NPI;
5. duplicate-row, address-key and clinician grouping counts;
6. accepted Census geocoder match metadata;
7. coordinate containment in exactly one official New Jersey county;
8. explicit missingness and exclusion counts;
9. no ratings, rankings, quality, capacity, availability, insurance or medical
   advice fields;
10. monthly next-review and 45-day stale-warning metadata; and
11. production artifact validation, UI interaction tests and public map
    workflow checks.

`scripts/validateDoctorOffices.mjs` independently reconciles row and office
counts, specialty totals, duplicate identities, NPPES/geocoder/source digests,
coordinates and county containment, while scanning for forbidden claim fields.
`scripts/checkDoctorOfficePipeline.mjs` guards the pinned-source and transform
architecture. `npm run test:doctor-office-ui` exercises the specialty/search
controls, deterministic filters, care-first location cards, load failures,
freshness threshold and accessible dialog behavior. All run in the full project
check.

## Current validated pilot status

The August 30, 2026 production artifact passed the promotion gate and publishes
734 CMS-listed New Jersey practice-location groups containing 1,514 distinct
clinicians across the three selected specialty families. Specialty counts can
overlap when one address contains clinicians in more than one family:

- Pediatrics: 254 locations and 456 clinicians
- Dermatology: 271 locations and 378 clinicians
- Oncology: 280 locations and 683 clinicians

The exact CMS queries returned 2,976 rows. Twenty-five repeated query results were
collapsed by the source-row identity, one row lacked a required address field,
and the remaining 2,950 eligible rows formed 926 candidate office groups. The
Census geocoder matched 734; the 192 unmatched groups were excluded and written
to the ignored review queue. No mapped
coordinate fell outside the official New Jersey county boundaries, and no
eligible CMS NPI appeared in the pinned NPPES deactivation report.

The artifact pins the CMS release published August 13, 2026, the August 10,
2026 NPPES deactivation report and the Census geocoder run checked August 30,
2026. Its next source-review date is September 10, 2026.

These counts describe this source release and import, not the full New Jersey
provider universe. Coverage remains explicitly incomplete.

## Unknowns that remain unknown

CareAtlas does not infer or publish:

- whether the location is accepting patients or appointments;
- whether a specific clinician currently practices at the address;
- office hours, wait times, capacity or accessibility accommodations;
- accepted insurance, network status, price or eligibility;
- services beyond the source specialty label;
- licensing, board certification, medical quality or outcomes;
- whether a missing marker means no doctor office exists;
- whether the location changes healthcare access in a tract, town or county.
