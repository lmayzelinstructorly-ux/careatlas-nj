import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { evaluateAccessGapRule } from './lib/accessGapRuleV1.mjs';

// Offline analysis of published evidence. This never changes the production rule.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.join(root, 'public/data/tracts/nj');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const rule = await read(path.join(data, 'access-gap-rule.v1.json'));
const directory = path.join(data, 'classifications/access-gap-rule-v1/by-county');
const records = [];
const observations = new Map();
for (const file of (await fs.readdir(directory)).filter(f => f.endsWith('.json')).sort()) {
  records.push(...await read(path.join(directory, file)));
  for (const family of ['cdc-places', 'cdc-svi', 'hrsa-shortage']) {
    for (const observation of await read(path.join(data, 'evidence', family, 'by-county', file))) {
      const geoid = observation.geography.geoid;
      if (!observations.has(geoid)) observations.set(geoid, []);
      observations.get(geoid).push(observation);
    }
  }
}
assert.equal(new Set(records.map(r => r.geography.geoid)).size, records.length);
for (const record of records) {
  assert.equal(evaluateAccessGapRule({rule, observations: observations.get(record.geography.geoid)}).state,
    record.state, `Published state mismatch: ${record.geography.geoid}`);
}
const scenarios = [
  ['Published rule', () => {}],
  ['SVI threshold 0.70', r => { r.socialBarriers.requiredMeasures[0].threshold = 0.70; }],
  ['SVI threshold 0.80', r => { r.socialBarriers.requiredMeasures[0].threshold = 0.80; }],
  ['Health: at least 1 of 4', r => { r.communityHealthNeed.minimumTriggeredMeasures = 1; }],
  ['Health: at least 3 of 4', r => { r.communityHealthNeed.minimumTriggeredMeasures = 3; }]
];
const results = scenarios.map(([name, change]) => {
  const candidate = structuredClone(rule);
  change(candidate);
  const counts = {};
  let changed = 0, newlyFlagged = 0, removedFlags = 0;
  for (const record of records) {
    const state = evaluateAccessGapRule({rule: candidate, observations: observations.get(record.geography.geoid)}).state;
    counts[state] = (counts[state] ?? 0) + 1;
    if (state !== record.state) changed++;
    if (state === 'potential_access_gap' && record.state !== state) newlyFlagged++;
    if (record.state === 'potential_access_gap' && record.state !== state) removedFlags++;
  }
  return {name, counts, changed, newlyFlagged, removedFlags};
});
const output = {ruleVersion: rule.ruleVersion, tractCount: records.length,
  purpose: 'One-factor sensitivity analysis, not validation against actual healthcare access.', results};
const destination = path.join(root, 'docs/submission/sensitivity.json');
await fs.mkdir(path.dirname(destination), {recursive: true});
await fs.writeFile(destination, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
