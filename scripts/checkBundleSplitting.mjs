import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const distDir = path.join(root, "dist");
const assetsDir = path.join(distDir, "assets");
const previousMainChunkBytes = 612_030;
const maximumMainChunkBytes = 300 * 1024;
const viteWarningChunkBytes = 500_000;

function findAsset(files, pattern, description) {
  const match = files.find((file) => pattern.test(file));
  assert(match, `${description} is missing from the production bundle.`);
  return match;
}

const [appSource, mapPageSource, assetFiles] = await Promise.all([
  readFile(path.join(root, "src", "App.tsx"), "utf8"),
  readFile(path.join(root, "src", "pages", "MapPage.tsx"), "utf8"),
  readdir(assetsDir)
]);

assert(
  appSource.includes('lazy(() => import("./pages/MapPage"))'),
  "MapPage must remain a lazy route import."
);
assert(
  appSource.includes('lazy(() => import("./pages/ProjectStoryPage"))'),
  "ProjectStoryPage must remain a lazy route import."
);
assert(
  appSource.includes("import.meta.env.DEV") &&
    appSource.includes('import("./pages/InternalDataReviewPage")'),
  "InternalDataReviewPage must remain behind the development-only guard."
);
assert(
  mapPageSource.includes('lazy(() => import("../components/CareAtlasMap"))'),
  "CareAtlasMap must remain a lazy map workspace import."
);

const mainChunk = findAsset(assetFiles, /^index-.+\.js$/, "initial app chunk");
findAsset(assetFiles, /^MapPage-.+\.js$/, "MapPage route chunk");
findAsset(assetFiles, /^ProjectStoryPage-.+\.js$/, "ProjectStoryPage route chunk");
findAsset(assetFiles, /^CareAtlasMap-.+\.js$/, "CareAtlasMap chunk");
findAsset(assetFiles, /^CareAtlasMap-.+\.css$/, "deferred Leaflet CSS");

for (const privateModule of [
  "InternalDataReviewPage",
  "HealthcareDataQualityDashboard",
  "HealthcareSourceReviewPanel",
  "HealthcareStagingReviewPanel"
]) {
  assert(
    !assetFiles.some((file) => file.startsWith(`${privateModule}-`)),
    `${privateModule} must not be included in the production bundle.`
  );
}

await assert.rejects(
  access(path.join(distDir, ".vite", "manifest.json")),
  { code: "ENOENT" },
  "The Vite build manifest must not be published."
);

const mainChunkPath = path.join(assetsDir, mainChunk);
const mainChunkBytes = (await stat(mainChunkPath)).size;
assert(
  mainChunkBytes <= maximumMainChunkBytes,
  `main chunk is ${mainChunkBytes.toLocaleString()} bytes; expected at most ${maximumMainChunkBytes.toLocaleString()} bytes.`
);
assert(
  mainChunkBytes < previousMainChunkBytes * 0.5,
  "main chunk is not at least 50% smaller than the 612.03 kB baseline."
);

const mainChunkSource = await readFile(mainChunkPath, "utf8");
assert(
  !/_leaflet_id|leaflet-container|var l="1\.9\.4"/.test(mainChunkSource),
  "Leaflet implementation code leaked into the initial app chunk."
);

const javascriptChunks = assetFiles.filter((file) => file.endsWith(".js"));
const chunkSizes = await Promise.all(
  javascriptChunks.map(async (file) => ({
    bytes: (await stat(path.join(assetsDir, file))).size,
    file
  }))
);
const oversizedChunk = chunkSizes.find(({ bytes }) => bytes > viteWarningChunkBytes);
assert(
  !oversizedChunk,
  `${oversizedChunk?.file} is ${(oversizedChunk?.bytes ?? 0).toLocaleString()} bytes and would trigger Vite's 500 kB warning.`
);

const reductionPercent = (
  100 *
  (1 - mainChunkBytes / previousMainChunkBytes)
).toFixed(1);
console.log(
  "Bundle splitting check passed: the public route and deferred map workspace are split, while development review modules and the Vite manifest are absent."
);
console.log(
  `Initial JavaScript is ${mainChunkBytes.toLocaleString()} bytes versus the 612,030-byte baseline (${reductionPercent}% smaller); Leaflet remains outside the app entry.`
);
