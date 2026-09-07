import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import {
  AddressLookupError,
  geocodeNjAddressSuggestion,
  getNjAddressSuggestions
} from "./njGeocoder.mjs";
import {
  GeminiExplanationError,
  generateGeminiExplanation,
  isGeminiExplanationConfigured
} from "./geminiExplanation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

try {
  process.loadEnvFile(path.join(root, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") {
    console.warn("CareAtlas could not load the local .env file.");
  }
}

const port = Number(process.env.PORT) || 8787;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};
const compressResponse = compression({ threshold: 0 });
const apiRateLimits = new Map();
const tractRecordShardCache = new Map();
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

function writeResponseHead(response, status, headers = {}) {
  response.writeHead(status, { ...securityHeaders, ...headers });
}

function cacheControlFor(filePath) {
  const relativePath = path.relative(dist, filePath).split(path.sep).join("/");
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".html") return "no-cache";
  if (
    relativePath.startsWith("assets/") &&
    /-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(path.basename(filePath))
  ) {
    return "public, max-age=31536000, immutable";
  }
  if (
    relativePath.startsWith("data/") &&
    (extension === ".json" || extension === ".geojson")
  ) {
    return "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
  }
  return "public, max-age=3600";
}

function sendJson(response, status, body, method = "GET") {
  const payload = JSON.stringify(body);
  writeResponseHead(response, status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(method === "HEAD" ? undefined : payload);
}

function consumeApiQuota(request, bucket, maximumRequests) {
  const key = `${bucket}:${request.socket.remoteAddress ?? "unknown"}`;
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
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AddressLookupError("Request body must be JSON.", 415);
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2_048) {
      throw new AddressLookupError("Request body is too large.", 413);
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AddressLookupError("Request body must contain valid JSON.", 400);
  }
}

async function handleAddressLookup(request, response, operation) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed." }, request.method);
  }
  if (!consumeApiQuota(request, "address", 120)) {
    return sendJson(response, 429, {
      error: "Too many address requests. Please wait a minute and try again."
    });
  }

  try {
    const body = await readJsonBody(request);
    const result =
      operation === "suggest"
        ? { suggestions: await getNjAddressSuggestions(body?.query) }
        : { match: await geocodeNjAddressSuggestion(body) };
    return sendJson(response, 200, result);
  } catch (error) {
    const status = error instanceof AddressLookupError ? error.status : 502;
    const message =
      error instanceof AddressLookupError
        ? error.message
        : "The address lookup could not be completed.";
    return sendJson(response, status, { error: message });
  }
}

async function loadTractPublicRecord(geoid) {
  if (typeof geoid !== "string" || !/^34\d{9}$/u.test(geoid)) {
    throw new GeminiExplanationError("A valid New Jersey tract GEOID is required.", 400);
  }

  const countyFips = geoid.slice(2, 5);
  let records = tractRecordShardCache.get(countyFips);
  if (!records) {
    const relativePath = path.join(
      "data",
      "tracts",
      "nj",
      "public-records",
      "tracts",
      "by-county",
      `${countyFips}.json`
    );
    let source;
    for (const candidate of [
      path.join(dist, relativePath),
      path.join(root, "public", relativePath)
    ]) {
      try {
        source = await readFile(candidate, "utf8");
        break;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (!source) {
      throw new GeminiExplanationError("The tract record could not be loaded.", 404);
    }
    records = JSON.parse(source);
    if (!Array.isArray(records)) {
      throw new GeminiExplanationError("The tract record source is invalid.");
    }
    tractRecordShardCache.set(countyFips, records);
  }

  const record = records.find((candidate) => candidate?.geography?.geoid === geoid);
  if (!record) {
    throw new GeminiExplanationError("The tract record was not found.", 404);
  }
  return record;
}

async function handleGeminiExplanation(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed." }, request.method);
  }
  if (!isGeminiExplanationConfigured()) {
    return sendJson(response, 503, {
      error: "The optional Gemini explainer is not configured."
    });
  }
  if (!consumeApiQuota(request, "gemini", 20)) {
    return sendJson(response, 429, {
      error: "Too many AI explanation requests. Please wait a minute and try again."
    });
  }

  try {
    const body = await readJsonBody(request);
    const record = await loadTractPublicRecord(body?.geoid);
    const explanation = await generateGeminiExplanation(record);
    return sendJson(response, 200, { explanation });
  } catch (error) {
    const isExpectedError =
      error instanceof GeminiExplanationError ||
      error instanceof AddressLookupError;
    const status = isExpectedError ? error.status : 502;
    const message =
      isExpectedError
        ? error.message
        : "The Gemini explainer could not complete this request.";
    return sendJson(response, status, { error: message });
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname === "/healthz") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(response, 405, { error: "Method not allowed." }, request.method);
    }
    return sendJson(response, 200, {
      status: "ok",
      app: "CareAtlas",
      timestamp: new Date().toISOString()
    }, request.method);
  }
  if (url.pathname === "/api/address/suggest") {
    return handleAddressLookup(request, response, "suggest");
  }
  if (url.pathname === "/api/address/geocode") {
    return handleAddressLookup(request, response, "geocode");
  }
  if (url.pathname === "/api/ai/status") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(response, 405, { error: "Method not allowed." }, request.method);
    }
    return sendJson(response, 200, {
      geminiExplanation: isGeminiExplanationConfigured()
    }, request.method);
  }
  if (url.pathname === "/api/ai/explain") {
    return handleGeminiExplanation(request, response);
  }
  if (url.pathname.startsWith("/api/")) {
    return sendJson(response, 404, { error: "API route not found." }, request.method);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    writeResponseHead(response, 405, { "Cache-Control": "no-store" });
    return response.end();
  }
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const resolved = path.resolve(dist, requested);
  const safePath = resolved.startsWith(`${dist}${path.sep}`) ? resolved : path.join(dist, "index.html");
  let filePath = safePath;
  try { if (!(await stat(filePath)).isFile()) filePath = path.join(dist, "index.html"); }
  catch { filePath = path.join(dist, "index.html"); }
  try {
    const info = await stat(filePath);
    writeResponseHead(response, 200, {
      "Cache-Control": cacheControlFor(filePath),
      "Content-Length": info.size,
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
    });
    if (request.method === "HEAD") return response.end();
    createReadStream(filePath).pipe(response);
  } catch {
    writeResponseHead(response, 404, { "Cache-Control": "no-store" });
    response.end("Build not found. Run npm run build first.");
  }
}

createServer((request, response) => {
  compressResponse(request, response, () => {
    handleRequest(request, response).catch(() => {
      if (!response.headersSent) {
        writeResponseHead(response, 500, { "Cache-Control": "no-store" });
      }
      response.end();
    });
  });
}).listen(port, () => {
  console.log(`CareAtlas server listening on http://localhost:${port}`);
});
