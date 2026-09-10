import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "../worker/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const wranglerConfigPath = path.join(root, "wrangler.jsonc");
const securityHeaderNames = [
  "content-security-policy",
  "permissions-policy",
  "referrer-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options"
];

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

function assertSecurityHeaders(headers, description) {
  for (const header of securityHeaderNames) {
    assert(headers.has(header), `${description} should include ${header}.`);
  }
  assert.match(
    headers.get("content-security-policy"),
    /(?:^|;\s*)frame-ancestors 'none'(?:;|$)/,
    `${description} should prevent framing.`
  );
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
}

async function assetResponse(input) {
  const url = new URL(input);
  const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const candidate = path.resolve(dist, relativePath);
  if (!candidate.startsWith(`${dist}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const source = await readFile(candidate);
    return new Response(source, {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (error) {
    if (error.code === "ENOENT") return new Response("Not found", { status: 404 });
    throw error;
  }
}

const config = JSON.parse(await readFile(wranglerConfigPath, "utf8"));
assert.equal(config.name, "careatlas");
assert.equal(config.main, "worker/index.mjs");
assert.equal(config.workers_dev, true);
assert.equal(config.assets.directory, "./dist");
assert.equal(config.assets.binding, "ASSETS");
assert.equal(config.assets.not_found_handling, "single-page-application");
assert.deepEqual(config.assets.run_worker_first, ["/api/*", "/healthz"]);

const distFiles = await listFiles(dist);
assert(distFiles.length <= 20_000, "The free Workers plan allows at most 20,000 static asset files.");
const sizes = await Promise.all(
  distFiles.map(async (filePath) => ({ filePath, size: (await stat(filePath)).size }))
);
const largestAsset = sizes.sort((left, right) => right.size - left.size)[0];
assert(
  largestAsset.size <= 25 * 1024 * 1024,
  `${path.relative(root, largestAsset.filePath)} exceeds the 25 MiB static asset limit.`
);

const staticHeaders = await readFile(path.join(dist, "_headers"), "utf8");
for (const header of securityHeaderNames) {
  assert.match(
    staticHeaders.toLowerCase(),
    new RegExp(`(?:^|\\n)\\s*${header}:`, "u"),
    `The Cloudflare static header policy should include ${header}.`
  );
}
assert.match(staticHeaders, /\/assets\/\*/u);
assert.match(staticHeaders, /max-age=31536000, immutable/u);
assert.match(staticHeaders, /\/data\/\*/u);
assert.match(staticHeaders, /CDN-Cache-Control: public, max-age=86400/u);

const environment = {
  ASSETS: { fetch: assetResponse },
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "gemini-3.5-flash"
};

const healthResponse = await handleRequest(
  new Request("https://careatlas.example/healthz"),
  environment
);
assert.equal(healthResponse.status, 200);
assert.equal((await healthResponse.json()).app, "CareAtlas");
assertSecurityHeaders(healthResponse.headers, "/healthz");

const aiStatusResponse = await handleRequest(
  new Request("https://careatlas.example/api/ai/status"),
  environment
);
assert.equal(aiStatusResponse.status, 200);
assert.deepEqual(await aiStatusResponse.json(), { geminiExplanation: false });
assertSecurityHeaders(aiStatusResponse.headers, "/api/ai/status");

const aiUnavailableResponse = await handleRequest(
  new Request("https://careatlas.example/api/ai/explain", {
    body: JSON.stringify({ geoid: "34001000100" }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  }),
  environment
);
assert.equal(aiUnavailableResponse.status, 503);
assert.deepEqual(await aiUnavailableResponse.json(), {
  error: "The optional Gemini explainer is not configured."
});

const invalidAddressResponse = await handleRequest(
  new Request("https://careatlas.example/api/address/suggest", {
    body: JSON.stringify({ query: "Main" }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  }),
  environment
);
assert.equal(invalidAddressResponse.status, 400);

const unknownApiResponse = await handleRequest(
  new Request("https://careatlas.example/api/not-a-route"),
  environment
);
assert.equal(unknownApiResponse.status, 404);
assert.deepEqual(await unknownApiResponse.json(), { error: "API route not found." });

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  assert.match(String(input), /^https:\/\/generativelanguage\.googleapis\.com\//u);
  assert.equal(init.headers["x-goog-api-key"], "test-key");
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            reasons: [
              "Reviewed public data crossed the published need threshold.",
              "The reviewed shortage evidence did not cross its threshold."
            ],
            summary: "The published screening rule found elevated need without documented shortage evidence."
          })
        }]
      }
    }]
  }), { status: 200 });
};

try {
  const explanationResponse = await handleRequest(
    new Request("https://careatlas.example/api/ai/explain", {
      body: JSON.stringify({ geoid: "34001000100" }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }),
    { ...environment, GEMINI_API_KEY: "test-key" }
  );
  assert.equal(explanationResponse.status, 200);
  const payload = await explanationResponse.json();
  assert.equal(payload.explanation.model, "gemini-3.5-flash");
  assert.equal(payload.explanation.reasons.length, 2);
} finally {
  globalThis.fetch = originalFetch;
}

const temporaryOutput = await mkdtemp(path.join(tmpdir(), "careatlas-cloudflare-"));
try {
  const wranglerPath = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
  const dryRun = spawnSync(
    process.execPath,
    [wranglerPath, "deploy", "--dry-run", "--outdir", temporaryOutput],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      shell: false
    }
  );
  assert.equal(
    dryRun.status,
    0,
    `Wrangler dry run failed.\n${dryRun.stdout}\n${dryRun.stderr}`
  );
} finally {
  await rm(temporaryOutput, { force: true, recursive: true });
}

console.log(
  `Cloudflare deployment check passed: ${distFiles.length} static assets, largest ${(largestAsset.size / 1024 / 1024).toFixed(2)} MiB, Worker API and Wrangler dry run valid.`
);
