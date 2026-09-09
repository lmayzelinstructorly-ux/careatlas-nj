const ACCESS_GAP_STATES = Object.freeze({
  POTENTIAL: "potential_access_gap",
  ELEVATED_WITHOUT_SHORTAGE: "elevated_need_without_documented_shortage",
  NO_CURRENT_FLAG: "no_current_gap_flag",
  INSUFFICIENT: "insufficient_evidence"
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compare(value, operator, threshold) {
  if (operator === ">=") return value >= threshold;
  if (operator === "<=") return value <= threshold;
  throw new Error(`Unsupported threshold operator ${operator}.`);
}

function evaluateGroup(group, observationByMeasureId) {
  const inputs = group.requiredMeasures.map((contract) => {
    const observation = observationByMeasureId.get(contract.id);
    const value = observation?.value ?? null;
    const missing = value === null || observation?.missingness?.isMissing === true;
    return {
      measureId: contract.id,
      value,
      unit: contract.unit,
      operator: contract.operator,
      threshold: contract.threshold,
      triggered: missing ? null : compare(value, contract.operator, contract.threshold),
      missing,
      missingReason: missing
        ? observation?.missingness?.reason ?? "Required observation is unavailable."
        : null
    };
  });
  const missingMeasureIds = inputs.filter(({ missing }) => missing).map(({ measureId }) => measureId);
  const triggeredCount = inputs.filter(({ triggered }) => triggered === true).length;
  const elevated = missingMeasureIds.length > 0
    ? null
    : group.combiner === "any"
      ? triggeredCount > 0
      : triggeredCount >= group.minimumTriggeredMeasures;
  return { elevated, triggeredCount, missingMeasureIds, inputs };
}

function evaluateAccessGapRule({ rule, observations }) {
  const observationByMeasureId = new Map(observations.map((observation) => [observation.measure.id, observation]));
  const health = evaluateGroup(rule.communityHealthNeed, observationByMeasureId);
  const social = evaluateGroup(rule.socialBarriers, observationByMeasureId);
  const shortage = evaluateGroup(rule.documentedShortage, observationByMeasureId);
  const missingRequiredMeasureIds = [
    ...health.missingMeasureIds,
    ...social.missingMeasureIds,
    ...shortage.missingMeasureIds
  ];

  let state;
  if (missingRequiredMeasureIds.length > 0) {
    state = ACCESS_GAP_STATES.INSUFFICIENT;
  } else {
    const elevatedNeed = health.elevated || social.elevated;
    if (elevatedNeed && shortage.elevated) state = ACCESS_GAP_STATES.POTENTIAL;
    else if (elevatedNeed) state = ACCESS_GAP_STATES.ELEVATED_WITHOUT_SHORTAGE;
    else state = ACCESS_GAP_STATES.NO_CURRENT_FLAG;
  }

  assert(rule.stateLabels[state], `Rule has no label for state ${state}.`);
  const explanations = [];
  if (state === ACCESS_GAP_STATES.INSUFFICIENT) {
    explanations.push(`Required evidence is unavailable for ${missingRequiredMeasureIds.length} measure(s).`);
  } else {
    explanations.push(
      health.elevated
        ? `${health.triggeredCount} of ${health.inputs.length} community-health thresholds were met.`
        : `${health.triggeredCount} of ${health.inputs.length} community-health thresholds were met; ${rule.communityHealthNeed.minimumTriggeredMeasures} are required.`
    );
    explanations.push(
      social.elevated
        ? "The overall CDC/ATSDR SVI rank met the published social-barrier threshold."
        : "The overall CDC/ATSDR SVI rank did not meet the published social-barrier threshold."
    );
    explanations.push(
      shortage.elevated
        ? "At least one active reviewed HRSA primary-care HPSA or MUA/P designation intersects the tract."
        : "No active reviewed HRSA primary-care HPSA or MUA/P designation matched the tract on the checked date."
    );
    if (state === ACCESS_GAP_STATES.NO_CURRENT_FLAG) {
      explanations.push("No current gap flag does not prove adequate access; this rule's elevated-need condition was not met.");
    }
  }

  return {
    state,
    label: rule.stateLabels[state],
    findings: {
      elevatedCommunityHealthNeed: health.elevated,
      elevatedSocialBarriers: social.elevated,
      documentedShortage: shortage.elevated,
      missingRequiredMeasureIds
    },
    ruleInputs: [...health.inputs, ...social.inputs, ...shortage.inputs],
    explanations
  };
}

export { ACCESS_GAP_STATES, evaluateAccessGapRule };
