import assert from "node:assert/strict";
import {
  buildGeminiExplanationInput,
  generateGeminiExplanation,
  isGeminiExplanationConfigured
} from "../server/geminiExplanation.mjs";

const record = {
  geography: {
    countyName: "Essex County",
    geoid: "34013008100",
    name: "Census tract 81"
  },
  screening: {
    findings: {
      documentedShortage: true,
      elevatedCommunityHealthNeed: true,
      elevatedSocialBarriers: false,
      missingRequiredMeasureIds: []
    },
    state: "potential_access_gap"
  }
};

assert.equal(isGeminiExplanationConfigured({}), false);
assert.equal(
  isGeminiExplanationConfigured({ GOOGLE_API_KEY: "unrelated-google-key" }),
  false
);
assert.equal(
  isGeminiExplanationConfigured({ GEMINI_API_KEY: "test-key" }),
  true
);

const safeInput = buildGeminiExplanationInput(record);
assert.equal(safeInput.geography.geoid, "34013008100");
assert.equal(safeInput.result.state, "potential_access_gap");
assert(!JSON.stringify(safeInput).toLowerCase().includes("address"));

let capturedRequest;
const safeFetch = async (url, request) => {
  capturedRequest = { request, url };
  return new Response(
    JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              reasons: [
                "Reviewed public data crossed a community health-need threshold.",
                "Official data show documented primary-care shortage evidence."
              ],
              summary:
                "The published screening rule marks this tract as a potential access gap because need and shortage evidence appear together."
            })
          }]
        }
      }]
    }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );
};

const explanation = await generateGeminiExplanation(record, {
  environment: {
    GEMINI_API_KEY: "test-key",
    GEMINI_MODEL: "gemini-3.5-flash"
  },
  fetchImplementation: safeFetch
});
assert.equal(explanation.model, "gemini-3.5-flash");
assert.equal(explanation.reasons.length, 2);
assert(capturedRequest.url.endsWith("gemini-3.5-flash:generateContent"));
assert.equal(capturedRequest.request.headers["x-goog-api-key"], "test-key");
const requestBody = JSON.parse(capturedRequest.request.body);
assert.equal(requestBody.store, false);
assert.equal(requestBody.generationConfig.responseMimeType, "application/json");
assert(!JSON.stringify(requestBody.contents).toLowerCase().includes("address"));
assert(
  requestBody.systemInstruction.parts[0].text.includes(
    "never add facts"
  )
);

const unsafeFetch = async () =>
  new Response(
    JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              reasons: ["You should seek treatment.", "This is the best area."],
              summary: "You need to follow this medical recommendation."
            })
          }]
        }
      }]
    }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );

await assert.rejects(
  generateGeminiExplanation(record, {
    environment: { GEMINI_API_KEY: "test-key" },
    fetchImplementation: unsafeFetch
  }),
  /did not pass CareAtlas safety checks/u
);

console.log(
  "Gemini explanation check passed: server-only public inputs, no address, store=false, structured output and unsafe-output rejection."
);
