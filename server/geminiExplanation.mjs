const defaultModel = "gemini-3.5-flash";
const geminiApiBase = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiExplanationError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "GeminiExplanationError";
    this.status = status;
  }
}

export function isGeminiExplanationConfigured(environment = process.env) {
  return Boolean(environment.GEMINI_API_KEY);
}

function getGeminiConfiguration(environment) {
  const apiKey = environment.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiExplanationError(
      "The optional Gemini explainer is not configured.",
      503
    );
  }

  const requestedModel = environment.GEMINI_MODEL || defaultModel;
  const model = /^[a-z0-9][a-z0-9._-]{2,80}$/iu.test(requestedModel)
    ? requestedModel
    : defaultModel;
  return { apiKey, model };
}

function getNeedFinding(findings) {
  if (
    findings.elevatedCommunityHealthNeed &&
    findings.elevatedSocialBarriers
  ) {
    return "Reviewed public data crossed thresholds for community health need and social barriers.";
  }
  if (findings.elevatedCommunityHealthNeed) {
    return "Reviewed public data crossed a threshold for community health need.";
  }
  if (findings.elevatedSocialBarriers) {
    return "Reviewed public data crossed a threshold for social barriers.";
  }
  return "The published rule did not find an elevated need or barrier threshold.";
}

export function buildGeminiExplanationInput(record) {
  return {
    geography: {
      countyName: record.geography.countyName,
      geoid: record.geography.geoid,
      name: record.geography.name
    },
    result: {
      documentedShortage: record.screening.findings.documentedShortage,
      missingRequiredValueCount:
        record.screening.findings.missingRequiredMeasureIds.length,
      needFinding: getNeedFinding(record.screening.findings),
      state: record.screening.state
    },
    ruleMeaning:
      "Potential gap requires elevated community need or social barriers together with documented primary-care shortage evidence. Missing required data produces insufficient evidence. Facility pins do not determine the result."
  };
}

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reasons: {
      type: "array",
      description: "Two or three short facts copied or directly paraphrased from the supplied rule result.",
      items: { type: "string" },
      minItems: 2,
      maxItems: 3
    },
    summary: {
      type: "string",
      description: "A plain-language explanation of the supplied screening result, not advice or a new conclusion."
    }
  },
  required: ["summary", "reasons"]
};

function validateExplanation(value) {
  const summary = typeof value?.summary === "string" ? value.summary.trim() : "";
  const reasons = Array.isArray(value?.reasons)
    ? value.reasons.map((reason) =>
        typeof reason === "string" ? reason.trim() : ""
      )
    : [];
  const combined = [summary, ...reasons].join(" ");
  const forbidden =
    /(?:https?:\/\/|<|>|\byou (?:should|need to|must)\b|\bseek (?:care|treatment)\b|\bdiagnos(?:e|is)\b|\bprescrib|\bguarantee[ds]?\b|\bbest\b|\bworst\b)/iu;

  if (
    !summary ||
    summary.length > 320 ||
    reasons.length < 2 ||
    reasons.length > 3 ||
    reasons.some((reason) => !reason || reason.length > 180) ||
    forbidden.test(combined)
  ) {
    throw new GeminiExplanationError(
      "Gemini returned an explanation that did not pass CareAtlas safety checks."
    );
  }

  return { reasons, summary };
}

export async function generateGeminiExplanation(
  record,
  {
    environment = process.env,
    fetchImplementation = fetch
  } = {}
) {
  const { apiKey, model } = getGeminiConfiguration(environment);
  const input = buildGeminiExplanationInput(record);
  let response;

  try {
    response = await fetchImplementation(
      `${geminiApiBase}/${encodeURIComponent(model)}:generateContent`,
      {
        body: JSON.stringify({
          contents: [{ parts: [{ text: JSON.stringify(input) }], role: "user" }],
          generationConfig: {
            maxOutputTokens: 420,
            responseJsonSchema,
            responseMimeType: "application/json",
            temperature: 0.15
          },
          store: false,
          systemInstruction: {
            parts: [{
              text: [
                "You are a plain-language public-health data explainer.",
                "Use only the supplied CareAtlas rule result; never add facts, numbers, causes, diagnoses, medical advice, rankings, or care recommendations.",
                "Never change or second-guess the screening state.",
                "Call it a potential access gap only when that is the supplied state, and make clear it is a screening signal rather than proof that care is absent."
              ].join(" ")
            }]
          }
        }),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        method: "POST",
        signal: AbortSignal.timeout(12_000)
      }
    );
  } catch {
    throw new GeminiExplanationError(
      "The Gemini explainer is temporarily unavailable."
    );
  }

  if (!response.ok) {
    throw new GeminiExplanationError(
      response.status === 429
        ? "The Gemini explainer has reached its temporary request limit."
        : "The Gemini explainer could not complete this request.",
      response.status === 429 ? 429 : 502
    );
  }

  const rawPayload = await response.text();
  if (rawPayload.length > 32_000) {
    throw new GeminiExplanationError(
      "Gemini returned an unexpectedly large response."
    );
  }

  let payload;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    throw new GeminiExplanationError(
      "Gemini did not return a usable explanation."
    );
  }
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new GeminiExplanationError(
      "Gemini did not return a usable explanation."
    );
  }

  let explanation;
  try {
    explanation = JSON.parse(text);
  } catch {
    throw new GeminiExplanationError(
      "Gemini did not return valid structured output."
    );
  }

  return { ...validateExplanation(explanation), model };
}
