import assert from "node:assert/strict";
import { getNjAddressSuggestions, geocodeNjAddressSuggestion } from "../server/njGeocoder.mjs";

const calls = [];
const reply = payload => ({ ok: true, json: async () => payload });
const partial = await getNjAddressSuggestions("Ma", async (url, options) => {
  calls.push({ url, params: Object.fromEntries(options.body) });
  return reply({ suggestions: [
    { text: "10 Main St, Newark, NJ 07102", magicKey: "valid" },
    { text: "10 Main St, Newark, NJ 07102", magicKey: "duplicate" },
    { text: "10 Main St, Albany, NY", magicKey: "outside" },
    { text: "Main St, Newark, NJ", magicKey: "collection", isCollection: true }
  ] });
});
assert.equal(calls[0].params.text, "Ma");
assert.deepEqual(partial, [{ text: "10 Main St, Newark, NJ 07102", magicKey: "valid" }]);

let stage = 0;
const corrected = await getNjAddressSuggestions("10 Mian, Nwark", async (url, options) => {
  stage += 1;
  if (stage === 1) return reply({ suggestions: [] });
  if (stage === 2) {
    assert(url.endsWith("/findAddressCandidates"));
    return reply({ candidates: [
      { address: "10 Main St, Newark, NJ", score: 90, attributes: { Addr_type: "PointAddress" } },
      { address: "Newark, NJ", score: 100, attributes: { Addr_type: "Locality" } }
    ] });
  }
  assert.equal(options.body.get("text"), "10 Main St, Newark, NJ");
  return reply({ suggestions: [{ text: "10 Main St, Newark, NJ", magicKey: "official" }] });
});
assert.deepEqual(corrected, [{ text: "10 Main St, Newark, NJ", magicKey: "official" }]);
assert.equal(stage, 3);

for (const attributes of [
  { Region: "NJ", Addr_type: "Locality" },
  { Region: "NY", Addr_type: "PointAddress" }
]) {
  await assert.rejects(() => geocodeNjAddressSuggestion(corrected[0], async () => reply({ candidates: [{
    address: "10 Main St, Newark, NJ", score: 100, location: { x: -74.17, y: 40.73 }, attributes
  }] })), /could not be matched/);
}
await assert.rejects(() => getNjAddressSuggestions("x"), /at least two/);
await assert.rejects(() => getNjAddressSuggestions("10 Main", async () => { throw new Error("offline"); }), /temporarily unavailable/);
console.log("Address search checks passed: partial queries, official typo correction, duplicates, region/type filtering and service errors.");
