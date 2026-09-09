import fs from "node:fs/promises";
import path from "node:path";
import { ACCESS_GAP_STATES, evaluateAccessGapRule } from "./lib/accessGapRuleV1.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const rule = JSON.parse(await fs.readFile(
  path.join(projectRoot, "public", "data", "tracts", "nj", "access-gap-rule.v1.json"),
  "utf8"
));
const classificationSchema = JSON.parse(await fs.readFile(
  path.join(projectRoot, "public", "data", "tracts", "access-gap-classification.v1.schema.json"),
  "utf8"
));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function observation(measureId, value, missingReason = null) {
  return {
    measure: { id: measureId },
    value,
    missingness: { isMissing: value === null, reason: missingReason }
  };
}

function buildInputs(overrides = {}) {
  const defaults = {
    cdc_places_diagnosed_diabetes_crude_prevalence: 10,
    cdc_places_coronary_heart_disease_crude_prevalence: 5,
    cdc_places_annual_checkup_crude_prevalence: 80,
    cdc_places_cholesterol_screening_crude_prevalence: 90,
    cdc_svi_overall_percentile_rank: 0.5,
    hrsa_active_primary_care_hpsa_component_count: 0,
    hrsa_active_muap_component_count: 0
  };
  return Object.entries({ ...defaults, ...overrides }).map(([id, value]) =>
    observation(id, value, value === null ? "Fixture missing value." : null)
  );
}

function evaluate(overrides) {
  return evaluateAccessGapRule({ rule, observations: buildInputs(overrides) });
}

assert(rule.ruleVersion === "1.0.0", "Fixture expected rule version 1.0.0.");
assert(rule.statesInPrecedenceOrder[0] === ACCESS_GAP_STATES.INSUFFICIENT,
  "Insufficient evidence must have first precedence.");
assert(new Set(rule.statesInPrecedenceOrder).size === 4, "Rule must define four unique states.");
assert(classificationSchema.additionalProperties === false,
  "Classification schema must reject undisclosed top-level fields.");
assert(JSON.stringify(classificationSchema.properties.state.enum) === JSON.stringify(rule.statesInPrecedenceOrder.slice(1).concat(rule.statesInPrecedenceOrder[0])),
  "Classification schema and rule must define the same four states.");
assert(!classificationSchema.properties.score && !classificationSchema.properties.rank,
  "Classification schema must not define a score or rank.");

assert(evaluate({
  cdc_places_diagnosed_diabetes_crude_prevalence: 12.3,
  cdc_places_coronary_heart_disease_crude_prevalence: 6.1,
  hrsa_active_primary_care_hpsa_component_count: 1
}).state === ACCESS_GAP_STATES.POTENTIAL, "Inclusive health and shortage thresholds should flag a potential gap.");

assert(evaluate({ cdc_svi_overall_percentile_rank: 0.75 }).state === ACCESS_GAP_STATES.ELEVATED_WITHOUT_SHORTAGE,
  "Inclusive SVI threshold without shortage should produce elevated need without documented shortage.");

assert(evaluate({ hrsa_active_muap_component_count: 1 }).state === ACCESS_GAP_STATES.NO_CURRENT_FLAG,
  "A shortage designation without elevated need should not satisfy the complete potential-gap rule.");

assert(evaluate({
  cdc_places_diagnosed_diabetes_crude_prevalence: 12.3,
  cdc_places_coronary_heart_disease_crude_prevalence: 6.1,
  hrsa_active_primary_care_hpsa_component_count: 1,
  cdc_svi_overall_percentile_rank: null
}).state === ACCESS_GAP_STATES.INSUFFICIENT, "Missing required data must override an otherwise positive flag.");

assert(evaluate({
  cdc_places_diagnosed_diabetes_crude_prevalence: 12.2999,
  cdc_places_coronary_heart_disease_crude_prevalence: 6.0999
}).state === ACCESS_GAP_STATES.NO_CURRENT_FLAG, "Values below inclusive high-prevalence thresholds must not trigger.");

for (const scenario of [evaluate({}), evaluate({ cdc_svi_overall_percentile_rank: null })]) {
  assert(!("score" in scenario) && !("rank" in scenario), "The evaluator must not produce a score or rank.");
  assert(scenario.ruleInputs.every(({ triggered, missing }) => missing ? triggered === null : typeof triggered === "boolean"),
    "Every rule input must disclose its threshold result or missingness.");
}

console.log("Access-gap rule fixture and edge-case checks passed.");
