# Screening methods review — September 14, 2026

Reviewer: OpenAI Codex, an AI coding assistant. This is a technical desk review, not an independent public-health/GIS expert review or validation against actual access to care. No external reviewer participated.

## Findings and disposition

**Corrected: SVI reference population.** The importer pins `2022/csv/states/NewJersey.csv`, but the interface, rule description and exported provenance called its values national percentiles. CDC's [2022 documentation, page 2](https://www.atsdr.cdc.gov/place-health/media/pdfs/2024/10/SVI2022Documentation.pdf) distinguishes state-relative from nationwide ranks. A fresh September 14 download of the pinned state file matched all 10,905 published observations, including missing values, with zero mismatches. Tract `34013000100` has `RPL_THEMES=0.7361`. Labels and provenance now say **New Jersey percentile**. No numeric inputs, cutoffs or classifications were changed; rule 1.0.0 receives a descriptive correction rather than a new decision rule.

**Sensitivity is material.** Run `node scripts/reviewScreeningSensitivity.mjs` from the repo root. It reads the checked-in evidence, verifies that all 2,181 published classifications agree with the evaluator, and varies one decision setting at a time without editing production data. The reproducible output is [sensitivity.json](sensitivity.json).

| Scenario | Potential gap | Elevated without shortage | No current flag | Insufficient | Any state changed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Published rule | 359 | 401 | 1,404 | 17 | 0 |
| SVI cutoff 0.70 | 368 | 445 | 1,351 | 17 | 53 |
| SVI cutoff 0.80 | 348 | 371 | 1,445 | 17 | 41 |
| At least 1 of 4 health indicators | 453 | 720 | 991 | 17 | 413 |
| At least 3 of 4 health indicators | 290 | 276 | 1,598 | 17 | 194 |

The health-indicator requirement has a larger effect in these scenarios than the SVI perturbations. This does not establish an optimal cutoff, error rate, confidence interval or clinical validity. Keep the fixed published rule for reproducibility; describe its threshold choices as project design decisions. Do not choose a setting simply because it produces a preferred number of flags.

**Indicator interpretation needs restraint.** The four PLACES measures are modeled crude prevalence estimates; diabetes and coronary heart disease reflect burden, while checkup and cholesterol screening reflect reported service use. They do not measure appointment availability or explain why care was missed. Crude rates also reflect age composition. Indicators may be correlated, so “two of four” is not two independent confirmations. CDC describes the estimation approach in its [PLACES methodology](https://www.cdc.gov/places/methodology/index.html). SVI was developed for social vulnerability and emergency planning; using it as access-barrier context is a CareAtlas interpretation, not an official healthcare-access diagnosis.

**Missing-data behavior is conservative, but coverage remains incomplete.** Any missing required input wins before other rule conditions, leaving 17 tracts insufficient. This can suppress a result even where another branch has evidence; it is an explicit design choice, not a statistical correction. ACS contextual ratios do not carry combined margins of error. Their displayed precision must not imply certainty. The current pipeline does not propagate PLACES uncertainty into flag probabilities.

**Geographic joins have measurable limitations.** Exact 11-digit GEOIDs prevent name-based matches but do not prove identical boundaries across years. The tract foundation uses 2024 geometry, SVI uses 2022 data, and PLACES uses its pinned release. The town crosswalk reports 2,171 internal-point assignments, 3 largest-overlap fallbacks and 7 unassigned tracts. There are 898 cross-town tracts, 40 towns without primary-assigned tracts, and 102 tracts with less than 90% mapped polygon-area coverage. These are polygon-area measures, not population coverage. Generalized town boundaries and tract geometry can disagree near edges. Keep these distinctions in every town claim; do not sum overlapping town counts into a statewide total.

**Shortage evidence is not universal resident coverage.** The stored HRSA summary has 28 unmatched active MUA/P components. County-subdivision matches use the tract's internal point, not an exhaustive polygon intersection. “Intersecting” should therefore be read as the documented matching procedure, not an exact measurement of designated area. Defined-population designations need not apply to all residents. Unmatched historical codes may omit real designated areas; zero matching records is not proof of adequate access. Independent review should prioritize those 28 components and boundary-edge cases.

**Temporal provenance needs reconciliation.** Source records contain June/July review and generation dates, while the author reports starting implementation August 1. These stored dates are not evidence of when code was written or of a fresh September source review. Some classifications say generated July 13 while listing a July 14 source check. Preserve the original fields, identify their provenance, and resolve the discrepancy before claiming an audited development chronology. No dates were backdated or silently rewritten in this review.

## What would establish stronger evidence

A qualified reviewer should examine the source-population correction, indicator dependence, cutoff rationale, unmatched HRSA components and several cross-boundary tracts. Compare selected flagged and unflagged areas with independent local evidence such as appointment access or travel time; HRSA agreement alone is circular because HRSA is already an input. Record disagreements as well as agreement. Until then, the supported claim is a transparent, reproducible screening tool whose real-world validity remains unestablished.
