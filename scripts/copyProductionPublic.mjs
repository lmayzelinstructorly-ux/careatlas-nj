import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isAllowedProductionDataPath,
  normalizeDistPath
} from "./productionDataAllowlist.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const publicDir = path.join(projectRoot, "public");
const publicDataDir = path.join(publicDir, "data");
const distDir = path.join(projectRoot, "dist");
const exactPublicAssetPaths = ["_headers", "favicon.svg"];
const copiedPaths = [];

async function copyPublicFile(relativePath) {
  const sourcePath = path.join(publicDir, relativePath);
  const destinationPath = path.join(distDir, relativePath);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  copiedPaths.push(normalizeDistPath(relativePath));
}

async function copyAllowedData(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      await copyAllowedData(absolutePath);
      continue;
    }

    const relativePath = normalizeDistPath(path.relative(publicDir, absolutePath));

    if (isAllowedProductionDataPath(relativePath)) {
      await copyPublicFile(relativePath);
    }
  }
}

try {
  for (const assetPath of exactPublicAssetPaths) {
    await copyPublicFile(assetPath);
  }

  await copyAllowedData(publicDataDir);
} catch (error) {
  console.error(`Production public copy failed: ${error.message}`);
  process.exit(1);
}

console.log(
  `Production public allowlist applied: copied ${copiedPaths.length} runtime file${copiedPaths.length === 1 ? "" : "s"} to dist.`
);
