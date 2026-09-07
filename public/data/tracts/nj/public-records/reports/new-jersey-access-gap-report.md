# New Jersey statewide access-gap screening report

Generated 2026-07-14 from CareAtlas rule version 1.0.0.

## What CareAtlas measures

CareAtlas combines four CDC PLACES modeled community-health estimates, the official CDC/ATSDR SVI overall percentile rank and reviewed HRSA primary-care HPSA/MUA/P designation evidence through a transparent screening rule. A fifth CDC PLACES transportation-barrier estimate, additional SVI themes, Census ACS survey-derived estimates, dental and mental-health HPSA evidence and source-backed facility records remain visible context without changing the rule.

The output is a public-health screening record. It is not a ranking, diagnosis, medical advice, individual-level statement or proof of cause.

## Four screening states

- **Potential access gap:** elevated community health need or social barriers plus documented primary-care shortage evidence.
- **Elevated need without documented shortage:** elevated need evidence without a matching active reviewed primary-care HPSA or MUA/P component.
- **No current gap flag:** this rule's elevated-need condition was not met. This does not prove adequate access.
- **Insufficient evidence:** at least one required value is missing. Missing evidence is never converted to zero.

## Rule thresholds

| Required input | Operator | Threshold | Unit |
|---|---:|---:|---|
| cdc_places_diagnosed_diabetes_crude_prevalence | >= | 12.3 | percent |
| cdc_places_coronary_heart_disease_crude_prevalence | >= | 6.1 | percent |
| cdc_places_annual_checkup_crude_prevalence | <= | 76.1 | percent |
| cdc_places_cholesterol_screening_crude_prevalence | <= | 86.8 | percent |
| cdc_svi_overall_percentile_rank | >= | 0.75 | percentile_rank_0_to_1 |
| hrsa_active_primary_care_hpsa_component_count | >= | 1 | active_designations |
| hrsa_active_muap_component_count | >= | 1 | active_designations |

Community health need is elevated when at least two of the four PLACES thresholds trigger. Social barriers are elevated when overall SVI is at or above 0.75. Documented shortage is present when at least one reviewed active primary-care HPSA or MUA/P component intersects the tract.

## Statewide results

- Potential access gap: 359
- Elevated need without documented shortage: 401
- No current gap flag: 1,404
- Insufficient evidence: 17
- Total New Jersey tracts: 2,181

## County summaries

Counts and percentages below use validated tract records. CareAtlas does not average percentile ranks or designation counts into a county score.

| County | Tracts | Potential access gap | Elevated need, no documented shortage | No current gap flag | Insufficient evidence | HRSA centers | CMS hospitals |
|---|---:|---:|---:|---:|---:|---:|---:|
| Atlantic County | 74 | 14 (18.9%) | 21 (28.4%) | 38 (51.4%) | 1 (1.4%) | 20 | 1 |
| Bergen County | 203 | 6 (3%) | 26 (12.8%) | 171 (84.2%) | 0 (0%) | 3 | 4 |
| Burlington County | 117 | 10 (8.5%) | 19 (16.2%) | 88 (75.2%) | 0 (0%) | 3 | 4 |
| Camden County | 129 | 16 (12.4%) | 32 (24.8%) | 81 (62.8%) | 0 (0%) | 13 | 3 |
| Cape May County | 33 | 10 (30.3%) | 0 (0%) | 22 (66.7%) | 1 (3%) | 1 | 1 |
| Cumberland County | 42 | 26 (61.9%) | 0 (0%) | 12 (28.6%) | 4 (9.5%) | 12 | 1 |
| Essex County | 211 | 105 (49.8%) | 28 (13.3%) | 76 (36%) | 2 (0.9%) | 24 | 7 |
| Gloucester County | 69 | 2 (2.9%) | 10 (14.5%) | 57 (82.6%) | 0 (0%) | 5 | 1 |
| Hudson County | 183 | 43 (23.5%) | 78 (42.6%) | 61 (33.3%) | 1 (0.5%) | 9 | 7 |
| Hunterdon County | 30 | 1 (3.3%) | 0 (0%) | 29 (96.7%) | 0 (0%) | 1 | 1 |
| Mercer County | 84 | 15 (17.9%) | 16 (19%) | 52 (61.9%) | 1 (1.2%) | 10 | 2 |
| Middlesex County | 192 | 18 (9.4%) | 27 (14.1%) | 146 (76%) | 1 (0.5%) | 9 | 5 |
| Monmouth County | 155 | 8 (5.2%) | 20 (12.9%) | 126 (81.3%) | 1 (0.6%) | 8 | 5 |
| Morris County | 110 | 4 (3.6%) | 5 (4.5%) | 101 (91.8%) | 0 (0%) | 7 | 2 |
| Ocean County | 145 | 30 (20.7%) | 25 (17.2%) | 87 (60%) | 3 (2.1%) | 13 | 5 |
| Passaic County | 120 | 8 (6.7%) | 56 (46.7%) | 55 (45.8%) | 1 (0.8%) | 3 | 2 |
| Salem County | 25 | 7 (28%) | 0 (0%) | 17 (68%) | 1 (4%) | 1 | 1 |
| Somerset County | 74 | 0 (0%) | 12 (16.2%) | 62 (83.8%) | 0 (0%) | 4 | 2 |
| Sussex County | 42 | 2 (4.8%) | 0 (0%) | 40 (95.2%) | 0 (0%) | 1 | 1 |
| Union County | 120 | 33 (27.5%) | 22 (18.3%) | 65 (54.2%) | 0 (0%) | 4 | 5 |
| Warren County | 23 | 1 (4.3%) | 4 (17.4%) | 18 (78.3%) | 0 (0%) | 2 | 2 |

## Source coverage

| Evidence measure | Non-missing tracts | Missing tracts | Estimate type | Source | Release |
|---|---:|---:|---|---|---:|
| Households with no vehicle available | 2166 | 15 | derived | United States Census Bureau - 2024 American Community Survey 5-year estimates | 2024 |
| Population below the poverty level | 2168 | 13 | derived | United States Census Bureau - 2024 American Community Survey 5-year estimates | 2024 |
| Civilian noninstitutionalized population with a disability | 2168 | 13 | derived | United States Census Bureau - 2024 American Community Survey 5-year estimates | 2024 |
| Civilian noninstitutionalized population without health insurance | 2168 | 13 | derived | United States Census Bureau - 2024 American Community Survey 5-year estimates | 2024 |
| Routine checkup within the past year among adults | 2169 | 12 | modeled | Centers for Disease Control and Prevention - PLACES: Local Data for Better Health, Census Tract Data, 2025 release | 2025 |
| Cholesterol screening among adults | 2169 | 12 | modeled | Centers for Disease Control and Prevention - PLACES: Local Data for Better Health, Census Tract Data, 2025 release | 2025 |
| Coronary heart disease among adults | 2169 | 12 | modeled | Centers for Disease Control and Prevention - PLACES: Local Data for Better Health, Census Tract Data, 2025 release | 2025 |
| Diagnosed diabetes among adults | 2169 | 12 | modeled | Centers for Disease Control and Prevention - PLACES: Local Data for Better Health, Census Tract Data, 2025 release | 2025 |
| Lack of reliable transportation in the past 12 months among adults | 2169 | 12 | modeled | Centers for Disease Control and Prevention - PLACES: Local Data for Better Health, Census Tract Data, 2025 release | 2025 |
| Household characteristics percentile rank | 2165 | 16 | derived | Centers for Disease Control and Prevention / Agency for Toxic Substances and Disease Registry - CDC/ATSDR Social Vulnerability Index 2022 database, New Jersey | 2022 |
| Housing type and transportation percentile rank | 2165 | 16 | derived | Centers for Disease Control and Prevention / Agency for Toxic Substances and Disease Registry - CDC/ATSDR Social Vulnerability Index 2022 database, New Jersey | 2022 |
| Overall social vulnerability percentile rank | 2165 | 16 | derived | Centers for Disease Control and Prevention / Agency for Toxic Substances and Disease Registry - CDC/ATSDR Social Vulnerability Index 2022 database, New Jersey | 2022 |
| Racial and ethnic minority status percentile rank | 2170 | 11 | derived | Centers for Disease Control and Prevention / Agency for Toxic Substances and Disease Registry - CDC/ATSDR Social Vulnerability Index 2022 database, New Jersey | 2022 |
| Socioeconomic status percentile rank | 2165 | 16 | derived | Centers for Disease Control and Prevention / Agency for Toxic Substances and Disease Registry - CDC/ATSDR Social Vulnerability Index 2022 database, New Jersey | 2022 |
| Active dental health HPSA designations intersecting tract | 2181 | 0 | designation | Health Resources and Services Administration - HRSA Shortage Areas daily data download | 2026 |
| Active mental health HPSA designations intersecting tract | 2181 | 0 | designation | Health Resources and Services Administration - HRSA Shortage Areas daily data download | 2026 |
| Active MUA/P designations intersecting tract | 2181 | 0 | designation | Health Resources and Services Administration - HRSA Shortage Areas daily data download | 2026 |
| Active primary care HPSA designations intersecting tract | 2181 | 0 | designation | Health Resources and Services Administration - HRSA Shortage Areas daily data download | 2026 |

## Missing evidence

17 tracts have at least one missing required input and remain Insufficient evidence. Missing values are unknown, not zero. Missing facility pins do not mean zero healthcare.

## Facility context and distance method

HRSA community health centers and CMS hospitals remain separate. Hospitals are not counted as primary-care capacity without supporting source evidence. Nearest safety-net center is the shortest Haversine great-circle distance from the official 2024 Census tract internal point to source-backed New Jersey HRSA community health-center coordinates, using an Earth radius of 3,958.7613 miles. This is straight-line distance, not travel distance, and nearest does not mean best or most appropriate.

## Gap drivers and action paths

Each tract record groups validated observations into transportation, coverage and affordability, ongoing-care and documented-shortage context. These groups do not add scores, rankings or new classification thresholds. The record also links to official HRSA and New Jersey resources that a user may investigate. Those links are not personalized recommendations, eligibility decisions or guaranteed solutions.

## Limitations

- This is a screening flag for public-health planning, not a score, ranking, diagnosis, medical advice or statement about an individual.
- CDC PLACES values are modeled tract estimates; SVI is an official percentile rank; HRSA designations can cover a whole tract, part of a tract or a defined population group.
- No current gap flag does not prove adequate access. It only means this versioned rule did not meet its published elevated-need condition.
- A missing required value always produces Insufficient evidence and is never treated as zero or reassuring evidence.
- CDC PLACES values are modeled population estimates, not individual diagnoses.
- ACS values are survey-derived estimates; CareAtlas does not claim they cause healthcare access conditions.
- SVI values are official national percentile ranks, not CareAtlas rankings.
- HRSA designations can apply to whole areas, parts of areas or defined population groups.
- The loaded facility layer is not a complete provider directory and does not measure medical quality.

CareAtlas provides public-health planning context only. These findings are not diagnoses, clinical guidance or medical advice.
