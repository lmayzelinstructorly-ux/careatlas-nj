import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir, stat } from "node:fs/promises";
import { createServer, get } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(filePath));
    else files.push(filePath);
  }
  return files;
}

function cacheDirective(cacheControl, name) {
  const match = cacheControl.match(new RegExp(`(?:^|,\\s*)${name}=(\\d+)`, "i"));
  return match ? Number(match[1]) : undefined;
}

function rawRequest(baseUrl, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = get(`${baseUrl}${pathname}`, { headers }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        body: Buffer.concat(chunks),
        headers: response.headers,
        status: response.statusCode
      }));
    });
    request.on("error", reject);
  });
}

function assertSecurityHeaders(headers, description) {
  assert.match(
    headers.get("content-security-policy") ?? "",
    /(?:^|;\s*)default-src 'self'(?:;|$)/,
    `${description} should restrict resources to CareAtlas by default.`
  );
  assert.match(
    headers.get("content-security-policy") ?? "",
    /(?:^|;\s*)frame-ancestors 'none'(?:;|$)/,
    `${description} should prevent framing.`
  );
  assert.equal(headers.get("x-frame-options"), "DENY", `${description} should deny framing for older browsers.`);
  assert.equal(headers.get("x-content-type-options"), "nosniff", `${description} should prevent MIME sniffing.`);
  assert.equal(headers.get("strict-transport-security"), "max-age=31536000", `${description} should require HTTPS after first secure contact.`);
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin", `${description} should limit cross-origin referrer detail.`);
  assert.equal(headers.get("permissions-policy"), "camera=(), geolocation=(), microphone=()", `${description} should disable unused browser capabilities.`);
}

async function availablePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert(address && typeof address === "object", "Expected an available local port.");
  const port = address.port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

const port = await availablePort();
const child = spawn(process.execPath, ["server/index.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    GEMINI_API_KEY: "",
    GOOGLE_API_KEY: "",
    PORT: String(port)
  },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
child.stdout.on("data", (chunk) => { serverOutput += chunk; });
child.stderr.on("data", (chunk) => { serverOutput += chunk; });
const baseUrl = `http://127.0.0.1:${port}`;

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Deployment server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) { ready = true; break; }
    } catch {
      // The server can refuse connections briefly while Node starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `Deployment server did not become ready.\n${serverOutput}`);

  for (const route of ["/", "/index.html", "/story", "/internal-data"]) {
    const response = await fetch(`${baseUrl}${route}`);
    const body = await response.text();
    assert.equal(response.status, 200, `${route} should return the SPA entry point.`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/, `${route} should return HTML.`);
    assert.match(body, /<div id="root"><\/div>/, `${route} should return the Vite app shell.`);
    assert.match(response.headers.get("cache-control") ?? "", /(?:^|,)\s*no-cache(?:,|$)/i, `${route} HTML should revalidate.`);
    assert.doesNotMatch(response.headers.get("cache-control") ?? "", /immutable/i, `${route} HTML must not be immutable.`);
    assertSecurityHeaders(response.headers, route);
  }
  const compressedHtmlResponse = await rawRequest(baseUrl, "/", { "Accept-Encoding": "gzip" });
  assert.equal(compressedHtmlResponse.headers["content-encoding"], "gzip", "HTML should use gzip when requested.");

  const assetFiles = await listFiles(path.join(dist, "assets"));
  assert(
    !assetFiles.some((filePath) => /(?:InternalDataReviewPage|HealthcareDataQualityDashboard|HealthcareSourceReviewPanel|HealthcareStagingReviewPanel)-.+\.js$/.test(path.basename(filePath))),
    "Development-only review modules must not be deployed."
  );
  await assert.rejects(
    stat(path.join(dist, ".vite", "manifest.json")),
    { code: "ENOENT" },
    "The Vite build manifest must not be deployed."
  );
  const hashedAsset = assetFiles.find((filePath) => (
    /-[A-Za-z0-9_-]{8,}\.(?:css|js)$/.test(path.basename(filePath))
  ));
  assert(hashedAsset, "Expected at least one hashed Vite asset in dist/assets.");
  const hashedAssetPath = `/${path.relative(dist, hashedAsset).split(path.sep).join("/")}`;
  const assetResponse = await rawRequest(baseUrl, hashedAssetPath, { "Accept-Encoding": "gzip" });
  const assetCacheControl = assetResponse.headers["cache-control"] ?? "";
  assert.equal(assetResponse.status, 200);
  assert.equal(assetResponse.headers["content-encoding"], "gzip", "Hashed JS/CSS should use gzip when requested.");
  assert.match(assetCacheControl, /(?:^|,)\s*public(?:,|$)/i);
  assert.match(assetCacheControl, /(?:^|,)\s*immutable(?:,|$)/i);
  assert((cacheDirective(assetCacheControl, "max-age") ?? 0) >= 31536000, "Hashed assets should cache for at least one year.");

  const dataFiles = (await listFiles(path.join(dist, "data"))).filter((filePath) => /\.(?:geo)?json$/i.test(filePath));
  const dataSizes = await Promise.all(dataFiles.map(async (filePath) => ({ filePath, size: (await stat(filePath)).size })));
  dataSizes.sort((left, right) => right.size - left.size);
  const largeData = dataSizes[0];
  assert(largeData?.size > 1024, "Expected a production JSON or GeoJSON file large enough to compress.");
  const dataPath = `/${path.relative(dist, largeData.filePath).split(path.sep).join("/")}`;
  const compressedDataResponse = await rawRequest(baseUrl, dataPath, { "Accept-Encoding": "gzip" });
  assert.equal(compressedDataResponse.status, 200);
  assert.equal(compressedDataResponse.headers["content-encoding"], "gzip", `${dataPath} should use gzip when requested.`);
  assert.match(compressedDataResponse.headers.vary ?? "", /(?:^|,)\s*Accept-Encoding(?:,|$)/i);
  assert.equal(gunzipSync(compressedDataResponse.body).byteLength, largeData.size, "Compressed data should decode to the source file size.");
  assert(compressedDataResponse.body.byteLength < largeData.size, "Compressed transfer should be smaller than the source data.");
  const dataCacheControl = compressedDataResponse.headers["cache-control"] ?? "";
  assert.match(dataCacheControl, /(?:^|,)\s*public(?:,|$)/i);
  assert((cacheDirective(dataCacheControl, "max-age") ?? 0) > 0, "Production data should have a finite browser cache.");
  assert((cacheDirective(dataCacheControl, "s-maxage") ?? 0) > 0, "Production data should have a finite CDN cache.");
  assert.doesNotMatch(dataCacheControl, /immutable/i, "Non-hashed production data must remain refreshable.");

  const pngFile = (await listFiles(dist)).find((filePath) => path.extname(filePath).toLowerCase() === ".png");
  if (pngFile) {
    const pngPath = `/${path.relative(dist, pngFile).split(path.sep).join("/")}`;
    const pngResponse = await rawRequest(baseUrl, pngPath, { "Accept-Encoding": "gzip" });
    assert.equal(pngResponse.status, 200);
    assert.equal(pngResponse.headers["content-encoding"], undefined, "Already-compressed PNG assets should not be recompressed.");
  }

  const healthResponse = await fetch(`${baseUrl}/healthz`);
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(Object.keys(health).sort(), ["app", "status", "timestamp"]);
  assert.equal(health.status, "ok");
  assert.equal(health.app, "CareAtlas");
  assert.equal(Number.isNaN(Date.parse(health.timestamp)), false, "Health timestamp should be ISO-compatible.");
  assert.match(healthResponse.headers.get("cache-control") ?? "", /(?:^|,)\s*no-store(?:,|$)/i);
  assertSecurityHeaders(healthResponse.headers, "/healthz");

  const aiStatusResponse = await fetch(`${baseUrl}/api/ai/status`);
  assert.equal(aiStatusResponse.status, 200);
  assert.deepEqual(await aiStatusResponse.json(), { geminiExplanation: false });
  assert.match(aiStatusResponse.headers.get("cache-control") ?? "", /(?:^|,)\s*no-store(?:,|$)/i);
  assertSecurityHeaders(aiStatusResponse.headers, "/api/ai/status");

  const aiExplainResponse = await fetch(`${baseUrl}/api/ai/explain`, {
    body: JSON.stringify({ geoid: "340010001001" }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  assert.equal(aiExplainResponse.status, 503, "The optional Gemini endpoint must fail closed when no server key is configured.");
  assert.deepEqual(await aiExplainResponse.json(), {
    error: "The optional Gemini explainer is not configured."
  });
  assert.match(aiExplainResponse.headers.get("cache-control") ?? "", /(?:^|,)\s*no-store(?:,|$)/i);
  assertSecurityHeaders(aiExplainResponse.headers, "/api/ai/explain");

  const aiStatusPostResponse = await fetch(`${baseUrl}/api/ai/status`, { method: "POST" });
  assert.equal(aiStatusPostResponse.status, 405, "The Gemini status endpoint should only accept GET and HEAD.");

  const unknownApiResponse = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(unknownApiResponse.status, 404, "Unknown API routes must not receive the SPA entry point.");
  assert.match(unknownApiResponse.headers.get("content-type") ?? "", /^application\/json\b/);
  assert.match(unknownApiResponse.headers.get("cache-control") ?? "", /(?:^|,)\s*no-store(?:,|$)/i);
  assertSecurityHeaders(unknownApiResponse.headers, "unknown API responses");

  const healthPostResponse = await fetch(`${baseUrl}/healthz`, { method: "POST" });
  assert.equal(healthPostResponse.status, 405, "The health endpoint should only accept GET and HEAD.");

  const savingsPercent = Math.round((1 - compressedDataResponse.body.byteLength / largeData.size) * 100);
  console.log(
    `Deployment server checks passed: SPA/API routing, security and cache headers, production-only assets, and gzip (${path.basename(largeData.filePath)}: ${largeData.size} -> ${compressedDataResponse.body.byteLength} bytes, ${savingsPercent}% smaller).`
  );
} finally {
  if (child.exitCode === null) {
    child.kill();
    await once(child, "exit");
  }
}
