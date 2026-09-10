import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(
  root,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
const outputPath = path.join(
  root,
  "public",
  "data",
  "healthcare",
  "by-state",
  "34.json"
);

const facilities = JSON.parse(await readFile(sourcePath, "utf8"));

if (!Array.isArray(facilities)) {
  throw new Error("Production healthcare facilities must be an array.");
}

const newJerseyFacilities = facilities.filter(
  (facility) =>
    facility.stateFips === "34" ||
    String(facility.state).toUpperCase() === "NJ"
);

if (newJerseyFacilities.length === 0) {
  throw new Error("No New Jersey healthcare facilities were found.");
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(newJerseyFacilities, null, 2)}\n`,
  "utf8"
);

console.log(
  `Wrote ${path.relative(root, outputPath)} with ${newJerseyFacilities.length} source-backed New Jersey facilities.`
);
