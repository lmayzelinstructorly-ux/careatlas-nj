import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exactProductionDataPaths,
  getForbiddenProductionDistReason,
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
const distDataDir = path.join(distDir, "data");
const requiredRootAssetPaths = ["_headers", "favicon.svg"];

async function listFiles(directoryPath, relativeRoot) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, relativeRoot)));
    } else {
      files.push(normalizeDistPath(path.relative(relativeRoot, absolutePath)));
    }
  }

  return files;
}

let distDataFiles;
let distFiles;

try {
  distFiles = await listFiles(distDir, distDir);
  distDataFiles = await listFiles(distDataDir, distDir);
} catch (error) {
  if (error.code === "ENOENT") {
    console.error(
      "Production dist validation failed: dist/data does not exist. Run npm run build first."
    );
    process.exit(1);
  }

  throw error;
}

const publicRuntimeDataFiles = (await listFiles(publicDataDir, publicDir)).filter(
  isAllowedProductionDataPath
);
const requiredRuntimeDataFiles = new Set([
  ...exactProductionDataPaths,
  ...publicRuntimeDataFiles
]);
const missingRequiredFiles = [...requiredRuntimeDataFiles].filter(
  (requiredPath) => !distDataFiles.includes(requiredPath)
);
const missingRequiredAssets = requiredRootAssetPaths.filter(
  (requiredPath) => !distFiles.includes(requiredPath)
);
const unexpectedFiles = distDataFiles.filter(
  (filePath) => !isAllowedProductionDataPath(filePath)
);
const forbiddenFiles = distFiles.filter(getForbiddenProductionDistReason);

if (
  missingRequiredFiles.length > 0 ||
  missingRequiredAssets.length > 0 ||
  unexpectedFiles.length > 0 ||
  forbiddenFiles.length > 0
) {
  console.error("Production dist validation failed.");

  if (missingRequiredFiles.length > 0) {
    console.error("Missing required runtime data files:");
    for (const filePath of missingRequiredFiles) {
      console.error(`  - ${filePath}`);
    }
  }

  if (missingRequiredAssets.length > 0) {
    console.error("Missing required public assets:");
    for (const filePath of missingRequiredAssets) {
      console.error(`  - ${filePath}`);
    }
  }

  if (forbiddenFiles.length > 0) {
    console.error("Forbidden production artifacts:");
    for (const filePath of forbiddenFiles) {
      console.error(
        `  - ${filePath} (${getForbiddenProductionDistReason(filePath)})`
      );
    }
  }

  const otherUnexpectedFiles = unexpectedFiles.filter(
    (filePath) => !forbiddenFiles.includes(filePath)
  );

  if (otherUnexpectedFiles.length > 0) {
    console.error("Files outside the production data allowlist:");
    for (const filePath of otherUnexpectedFiles) {
      console.error(`  - ${filePath}`);
    }
  }

  process.exit(1);
}

console.log(
  `Production dist validation passed: ${distDataFiles.length} runtime data files match the allowlist.`
);
