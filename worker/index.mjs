import {
  AddressLookupError,
  geocodeNjAddressSuggestion,
  getNjAddressSuggestions
} from "../server/njGeocoder.mjs";
import {
  GeminiExplanationError,
  generateGeminiExplanation,
  isGeminiExplanationConfigured
} from "../server/geminiExplanation.mjs";

const apiRateLimits = new Map();
const classificationShardCache = new Map();
const countyNames = Object.freeze({
  "001": "Atlantic County",
  "003": "Bergen County",
  "005": "Burlington County",
  "007": "Camden County",
  "009": "Cape May County",
  "011": "Cumberland County",
  "013": "Essex County",
  "015": "Gloucester County",
  "017": "Hudson County",
  "019": "Hunterdon County",
  "021": "Mercer County",
  "023": "Middlesex County",
  "025": "Monmouth County",
  "027": "Morris County",
  "029": "Ocean County",
  "031": "Passaic County",
  "033": "Salem County",
  "035": "Somerset County",
  "037": "Sussex County",
  "039": "Union County",
  "041": "Warren County"
});
const securityHeaders = Object.freeze({
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'"
  ].join("; "),
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
});

function sendJson(status, body, method = "GET") {
  const payload = JSON.stringify(body);
  const headers = new Headers(securityHeaders);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Length", String(new TextEncoder().encode(payload).byteLength));
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(method === "HEAD" ? null : payload, {
    headers,
    status
  });
}

function consumeApiQuota(request, bucket, maximumRequests) {
  const clientAddress = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const key = `${bucket}:${clientAddress}`;
  const now = Date.now();
  const current = apiRateLimits.get(key);
  const entry =
    current && now - current.startedAt < 60_000
      ? current
      : { count: 0, startedAt: now };
  entry.count += 1;
  apiRateLimits.set(key, entry);

  if (apiRateLimits.size > 2_000) {
    for (const [address, limit] of apiRateLimits) {
      if (now - limit.startedAt >= 60_000) apiRateLimits.delete(address);
    }
  }

  return entry.count <= maximumRequests;
}

async function readJsonBody(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AddressLookupError("Request body must be JSON.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 2_048) {
    throw new AddressLookupError("Request body is too large.", 413);
  }

  const chunks = [];
  const reader = request.body?.getReader();
  let size = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_048) {
        await reader.cancel();
        throw new AddressLookupError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AddressLookupError("Request body must contain valid JSON.", 400);
  }
}

async function handleAddressLookup(request, operation) {
  if (request.method !== "POST") {
    return sendJson(405, { error: "Method not allowed." }, request.method);
  }
  if (!consumeApiQuota(request, "address", 120)) {
    return sendJson(429, {
      error: "Too many address requests. Please wait a minute and try again."
    });
  }

  try {
    const body = await readJsonBody(request);
    const result =
      operation === "suggest"
        ? { suggestions: await getNjAddressSuggestions(body?.query) }
        : { match: await geocodeNjAddressSuggestion(body) };
    return sendJson(200, result);
  } catch (error) {
    const status = error instanceof AddressLookupError ? error.status : 502;
    const message =
      error instanceof AddressLookupError
        ? error.message
        : "The address lookup could not be completed.";
    return sendJson(status, { error: message });
  }
}

function tractName(tractCode) {
  const integerPart = Number(tractCode.slice(0, 4));
  const decimalPart = tractCode.slice(4);
  return `Census Tract ${integerPart}${decimalPart === "00" ? "" : `.${decimalPart}`}`;
}

async function loadTractExplanationRecord(request, environment, geoid) {
  if (typeof geoid !== "string" || !/^34\d{9}$/u.test(geoid)) {
    throw new GeminiExplanationError(
      "A valid New Jersey tract GEOID is required.",
      400
    );
  }

  const countyFips = geoid.slice(2, 5);
  let classifications = classificationShardCache.get(countyFips);

  if (!classifications) {
    const assetUrl = new URL(
      `/data/tracts/nj/classifications/access-gap-rule-v1/by-county/${countyFips}.json`,
      request.url
    );
    const response = await environment.ASSETS.fetch(assetUrl);
    if (!response.ok) {
      throw new GeminiExplanationError("The tract record could not be loaded.", 404);
    }
    classifications = await response.json();
    if (!Array.isArray(classifications)) {
      throw new GeminiExplanationError("The tract record source is invalid.");
    }
    classificationShardCache.set(countyFips, classifications);
  }

  const classification = classifications.find(
    (candidate) => candidate?.geography?.geoid === geoid
  );
  if (!classification) {
    throw new GeminiExplanationError("The tract record was not found.", 404);
  }

  return {
    geography: {
      countyName: countyNames[countyFips],
      geoid,
      name: tractName(classification.geography.tractCode)
    },
    screening: {
      findings: classification.findings,
      state: classification.state
    }
  };
}

async function handleGeminiExplanation(request, environment) {
  if (request.method !== "POST") {
    return sendJson(405, { error: "Method not allowed." }, request.method);
  }
  if (!isGeminiExplanationConfigured(environment)) {
    return sendJson(503, {
      error: "The optional Gemini explainer is not configured."
    });
  }
  if (!consumeApiQuota(request, "gemini", 20)) {
    return sendJson(429, {
      error: "Too many AI explanation requests. Please wait a minute and try again."
    });
  }

  try {
    const body = await readJsonBody(request);
    const record = await loadTractExplanationRecord(
      request,
      environment,
      body?.geoid
    );
    const explanation = await generateGeminiExplanation(record, {
      environment
    });
    return sendJson(200, { explanation });
  } catch (error) {
    const isExpectedError =
      error instanceof GeminiExplanationError ||
      error instanceof AddressLookupError;
    const status = isExpectedError ? error.status : 502;
    const message = isExpectedError
      ? error.message
      : "The Gemini explainer could not complete this request.";
    return sendJson(status, { error: message });
  }
}

export async function handleRequest(request, environment) {
  const url = new URL(request.url);

  if (url.pathname === "/healthz") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(405, { error: "Method not allowed." }, request.method);
    }
    return sendJson(
      200,
      {
        status: "ok",
        app: "CareAtlas",
        timestamp: new Date().toISOString()
      },
      request.method
    );
  }
  if (url.pathname === "/api/address/suggest") {
    return handleAddressLookup(request, "suggest");
  }
  if (url.pathname === "/api/address/geocode") {
    return handleAddressLookup(request, "geocode");
  }
  if (url.pathname === "/api/ai/status") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(405, { error: "Method not allowed." }, request.method);
    }
    return sendJson(
      200,
      { geminiExplanation: isGeminiExplanationConfigured(environment) },
      request.method
    );
  }
  if (url.pathname === "/api/ai/explain") {
    return handleGeminiExplanation(request, environment);
  }
  return sendJson(404, { error: "API route not found." }, request.method);
}

export default {
  fetch: handleRequest
};
