import fs from "node:fs/promises";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(workspaceRoot, "public", "data");
const countiesDir = path.join(dataDir, "counties", "by-state");
const countySubdivisionsDir = path.join(dataDir, "cousubs", "by-state");
const njTractCountyDir = path.join(dataDir, "tracts", "nj", "by-county");
const outputPath = path.join(dataDir, "geography-data-manifest.json");

async function readStateFipsFiles(sourceDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && /^\d{2}\.geojson$/.test(entry.name))
    .map((entry) => entry.name.replace(".geojson", ""))
    .sort();
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const njTractCountyShards = (await fs.readdir(njTractCountyDir))
    .filter((fileName) => /^\d{3}\.geojson$/.test(fileName))
    .sort()
    .map((fileName) => `/data/tracts/nj/by-county/${fileName}`);
  const manifest = {
    countiesByState: await readStateFipsFiles(countiesDir),
    countySubdivisionsByState: await readStateFipsFiles(countySubdivisionsDir),
    tractCountyShardsByState: { "34": njTractCountyShards },
    tractsByState: njTractCountyShards.length > 0 ? ["34"] : [],
    states: (await fileExists(path.join(dataDir, "us-states.geojson")))
      ? ["/data/us-states.geojson"]
      : []
  };

  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${path.relative(workspaceRoot, outputPath)} with ${manifest.countiesByState.length} county files, ${manifest.countySubdivisionsByState.length} county subdivision files and ${njTractCountyShards.length} New Jersey tract county shards.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
