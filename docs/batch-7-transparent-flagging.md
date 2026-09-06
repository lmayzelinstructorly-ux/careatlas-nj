# Batch 7 transparent flagging

Batch 7 writes and applies one New Jersey tract screening rule. The rule is a
versioned public data contract, not an opaque score, ranking, diagnosis,
medical recommendation or statement about an individual.

## Rule version 1.0.0

The source of truth is
`public/data/tracts/nj/access-gap-rule.v1.json`. The generator reads that file;
thresholds are not hidden in application code.

### Elevated community health need

At least two of four CDC PLACES thresholds must be met:

- diagnosed diabetes at or above 12.3 percent
- coronary heart disease at or above 6.1 percent
- annual checkup at or below 76.1 percent
- cholesterol screening at or below 86.8 percent

These fixed cut points are the New Jersey 75th percentiles for the two chronic-
disease measures and 25th percentiles for the two preventive-care measures.
They were calculated once from the 2,169 non-missing tract estimates in the
pinned CDC PLACES 2025 release with linear interpolation at `(n - 1) * p`.
They are state-relative screening thresholds, not clinical cutoffs, and remain
fixed for this rule version.

### Elevated social barriers

The official CDC/ATSDR SVI 2022 overall national percentile rank must be at or
above 0.75. CareAtlas copies that rank and does not re-rank SVI.

### Documented shortage

At least one active reviewed HRSA primary-care HPSA or MUA/P designation must
intersect the tract. A designation can cover a whole tract, part of a tract or
a defined population group. A zero means the reviewed files had no matching
active component on the checked date; it does not prove adequate access.

## State precedence

1. `insufficient_evidence` - any required input is unavailable. This always
   overrides every other result.
2. `potential_access_gap` - community health need or social barriers are
   elevated, and documented shortage is present.
3. `elevated_need_without_documented_shortage` - community health need or
   social barriers are elevated, but reviewed primary-care HPSA/MUA/P evidence
   is absent.
4. `no_current_gap_flag` - neither elevated-need condition is met. A shortage
   designation may still be present, and this state does not prove adequate
   access.

Every output record preserves the seven input values, operators, thresholds,
trigger results, missing reasons, rule version, explanations, limitations and
source checked dates. No score or rank is generated.

## Context that stays separate

The direct PLACES transportation-barrier estimate, ACS social measures, the
four SVI themes, and dental and mental-health HPSA designations remain validated
context for the public evidence panel. Rule version 1.0.0 does not silently
double-count those correlated fields.

Facility records also remain separate context. The current HRSA/CMS layer is
not a complete provider directory, so the rule does not treat a low loaded-pin
count as proof of low capacity.

## Production artifacts

- classification schema:
  `public/data/tracts/access-gap-classification.v1.schema.json`
- versioned rule: `public/data/tracts/nj/access-gap-rule.v1.json`
- 21 county shards:
  `public/data/tracts/nj/classifications/access-gap-rule-v1/by-county`
- statewide and county counts:
  `public/data/tracts/nj/access-gap-rule-v1-summary.json`

## Reproduction and validation

```bash
npm run check:access-gap-rule
npm run apply:access-gap-rule
npm run validate:access-gap-classifications
npm run check
npm run build
```

The fixture check covers all states, exact threshold edges, values immediately
below a cutoff and missing-data precedence. The independent production
validator recomputes each state from disclosed inputs and rejects duplicate
GEOIDs, unknown states, stale thresholds, missing explanations, absent
limitations, scores, ranks or summary-count drift.
