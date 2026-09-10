import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import https from "node:https";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import AdmZip from "adm-zip";
import shapefile from "shapefile";

const censusBaseUrl = "https://www2.census.gov/geo/tiger/GENZ2024/shp";
const workspaceRoot = path.resolve(import.meta.dirname, "..");
const cacheDir = path.join(workspaceRoot, ".boundary-cache");
const outputDir = path.join(workspaceRoot, "public", "data");
const countyOutputDir = path.join(outputDir, "counties", "by-state");
const countySubdivisionOutputDir = path.join(outputDir, "cousubs", "by-state");

const excludedStateFipsCodes = new Set(["02", "15", "60", "66", "69", "72", "78"]);

const stateFipsCodes = [
  "01",
  "04",
  "05",
  "06",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "50",
  "51",
  "53",
  "54",
  "55",
  "56"
];

function isMainlandUsStateFips(stateFips) {
  return typeof stateFips === "string" && !excludedStateFipsCodes.has(stateFips);
}

function isMainlandUsFeature(properties) {
  return isMainlandUsStateFips(properties.STATEFP);
}

const boundaryLayers = [
  {
    name: "U.S. states",
    zipName: "cb_2024_us_state_500k.zip",
    shapeName: "cb_2024_us_state_500k",
    outputName: "us-states.geojson",
    filter: isMainlandUsFeature
  },
  {
    name: "U.S. counties",
    zipName: "cb_2024_us_county_500k.zip",
    shapeName: "cb_2024_us_county_500k",
    outputDir: countyOutputDir,
    splitByState: true,
    filter: isMainlandUsFeature
  }
];

const countySubdivisionLayers = stateFipsCodes.map((stateFips) => ({
  name: `County subdivisions for state ${stateFips}`,
  zipName: `cb_2024_${stateFips}_cousub_500k.zip`,
  shapeName: `cb_2024_${stateFips}_cousub_500k`,
  outputName: `${stateFips}.geojson`,
  outputDir: countySubdivisionOutputDir,
  stateFips
}));

function getZipUrl(zipName) {
  return `${censusBaseUrl}/${zipName}`;
}

function request(url, redirectsRemaining = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          location &&
          redirectsRemaining > 0
        ) {
          response.resume();
          resolve(request(new URL(location, url).toString(), redirectsRemaining - 1));
          return;
        }

        if (statusCode !== 200) {
          response.resume();
          reject(new Error(`Download failed for ${url}: ${statusCode}`));
          return;
        }

        resolve(response);
      })
      .on("error", reject);
  });
}

async function downloadFile(url, destination) {
  try {
    const cachedFile = await fs.stat(destination);

    if (cachedFile.isFile() && cachedFile.size > 0) {
      console.log(`Using cached download ${path.relative(workspaceRoot, destination)}`);
      return;
    }
  } catch {
    // Cache miss: download the source ZIP.
  }

  const response = await request(url);
  await pipeline(response, createWriteStream(destination));
}

async function extractZip(zipPath, destination) {
  const zip = new AdmZip(zipPath);
  await fs.rm(destination, { force: true, recursive: true });
  await fs.mkdir(destination, { recursive: true });
  zip.extractAllTo(destination, true);
}

async function convertShapefileToGeoJson(layer, extractedDir) {
  const shpPath = path.join(extractedDir, `${layer.shapeName}.shp`);
  const dbfPath = path.join(extractedDir, `${layer.shapeName}.dbf`);
  const source = await shapefile.open(shpPath, dbfPath);
  const features = [];

  while (true) {
    const result = await source.read();

    if (result.done) {
      break;
    }

    if (!layer.filter || layer.filter(result.value.properties ?? {})) {
      features.push(result.value);
    }
  }

  return {
    type: "FeatureCollection",
    name: layer.shapeName,
    features
  };
}

async function writeGeoJson(layer, geoJson) {
  const targetOutputDir = layer.outputDir ?? outputDir;

  if (layer.splitByState) {
    await fs.mkdir(targetOutputDir, { recursive: true });

    const writtenPaths = [];

    for (const stateFips of stateFipsCodes) {
      const stateGeoJson = {
        ...geoJson,
        name: `${geoJson.name}_${stateFips}`,
        features: geoJson.features.filter(
          (feature) => feature.properties?.STATEFP === stateFips
        )
      };

      if (stateGeoJson.features.length === 0) {
        continue;
      }

      const outputPath = path.join(targetOutputDir, `${stateFips}.geojson`);
      await fs.writeFile(outputPath, `${JSON.stringify(stateGeoJson)}\n`, "utf8");
      writtenPaths.push(outputPath);
    }

    return writtenPaths;
  }

  const outputPath = path.join(targetOutputDir, layer.outputName);
  await fs.mkdir(targetOutputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(geoJson)}\n`, "utf8");
  return outputPath;
}

async function copyLegacyNewJerseyMunicipalitiesFile() {
  const sourcePath = path.join(countySubdivisionOutputDir, "34.geojson");
  const legacyPath = path.join(outputDir, "nj-municipalities.geojson");

  try {
    await fs.copyFile(sourcePath, legacyPath);
    console.log(
      `Updated legacy ${path.relative(workspaceRoot, legacyPath)} from ${path.relative(
        workspaceRoot,
        sourcePath
      )}`
    );
  } catch (error) {
    console.warn(`Could not update legacy New Jersey municipalities file: ${error}`);
  }
}

async function removeExcludedCountySubdivisionFiles() {
  await fs.mkdir(countyOutputDir, { recursive: true });
  await fs.mkdir(countySubdivisionOutputDir, { recursive: true });

  await Promise.all(
    Array.from(excludedStateFipsCodes, (stateFips) =>
      Promise.all([
        fs.rm(path.join(countyOutputDir, `${stateFips}.geojson`), {
          force: true
        }),
        fs.rm(path.join(countySubdivisionOutputDir, `${stateFips}.geojson`), {
          force: true
        })
      ])
    ).flat()
  );
}

async function processLayer(layer) {
  const zipPath = path.join(cacheDir, layer.zipName);
  const extractedDir = path.join(cacheDir, layer.shapeName);
  const url = getZipUrl(layer.zipName);

  console.log(`Downloading ${layer.name}: ${url}`);
  await downloadFile(url, zipPath);

  console.log(`Extracting ${layer.zipName}`);
  await extractZip(zipPath, extractedDir);

  console.log(`Converting ${layer.name} to GeoJSON`);
  const geoJson = await convertShapefileToGeoJson(layer, extractedDir);
  const outputPaths = await writeGeoJson(layer, geoJson);

  if (Array.isArray(outputPaths)) {
    console.log(
      `Wrote ${outputPaths.length} state-specific files in ${path.relative(
        workspaceRoot,
        layer.outputDir
      )} (${geoJson.features.length} features)`
    );
  } else {
    console.log(
      `Wrote ${path.relative(workspaceRoot, outputPaths)} (${geoJson.features.length} features)`
    );
  }

  return outputPaths;
}

async function main() {
  await fs.mkdir(cacheDir, { recursive: true });

  for (const layer of boundaryLayers) {
    await processLayer(layer);
  }

  const downloadedCountySubdivisionStates = [];
  const failedCountySubdivisionStates = [];

  for (const layer of countySubdivisionLayers) {
    try {
      await processLayer(layer);
      downloadedCountySubdivisionStates.push(layer.stateFips);
    } catch (error) {
      failedCountySubdivisionStates.push(layer.stateFips);
      console.warn(`Skipping county subdivisions for state ${layer.stateFips}: ${error}`);
    }
  }

  await copyLegacyNewJerseyMunicipalitiesFile();
  await removeExcludedCountySubdivisionFiles();

  console.log(
    `Downloaded county subdivision files for ${downloadedCountySubdivisionStates.length} states.`
  );

  if (failedCountySubdivisionStates.length > 0) {
    console.warn(
      `County subdivision downloads failed for: ${failedCountySubdivisionStates.join(", ")}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
