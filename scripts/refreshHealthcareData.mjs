import { execFileSync } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");

const cmsDownloadUrl =
  "https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0/download?format=csv";
const hrsaDownloadUrl =
  "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv";

const cmsEnrichmentOutput =
  "public/data/healthcare/imports/cms/enrichment/cms-medicare-insurance-enrichment.json";
const hrsaEnrichmentOutput =
  "public/data/healthcare/imports/hrsa/enrichment/hrsa-designation-enrichment.json";

function parseArgs(argv) {
  const args = { skipCms: false, skipHrsa: false, skipChecks: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--skip-cms") args.skipCms = true;
    else if (arg === "--skip-hrsa") args.skipHrsa = true;
    else if (arg === "--skip-checks") args.skipChecks = true;
    else throw new Error(`Unknown option "${arg}".`);
  }
  return args;
}

function printHelp() {
  console.log("Refresh healthcare enrichment from the latest official CMS and HRSA data.");
  console.log("");
  console.log("Downloads the official CMS Hospital General Information CSV and the");
  console.log("official HRSA Health Center Service Delivery and Look-Alike Sites CSV,");
  console.log("regenerates the dataset-derived enrichment inputs, applies them through");
  console.log("the provenance-validated enrichment pipeline, regenerates dependent");
  console.log("artifacts and reruns the audits and project checks.");
  console.log("");
  console.log("The apply step only fills fields that are currently unknown; it never");
  console.log("overwrites existing source-backed values and never changes");
  console.log("verificationStatus. New facilities in the source data are reported but");
  console.log("not imported; importing new records stays in the staged review pipeline.");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/refreshHealthcareData.mjs [--skip-cms] [--skip-hrsa] [--skip-checks]");
}

function run(label, command, commandArgs) {
  console.log(`\n==> ${label}`);
  console.log(`    ${command === process.execPath ? "node" : command} ${commandArgs.join(" ")}`);
  execFileSync(command, commandArgs, { cwd: projectRoot, stdio: "inherit" });
}

function runNodeScript(label, scriptRelativePath, scriptArgs = []) {
  run(label, process.execPath, [path.join(projectRoot, scriptRelativePath), ...scriptArgs]);
}

async function download(label, url, outputRelativePath) {
  console.log(`\n==> Downloading ${label}`);
  console.log(`    ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${label} download failed with HTTP ${response.status}.`);
  }
  const text = await response.text();
  if (!text.includes(",") || text.trim().length < 1000) {
    throw new Error(`${label} download looks too small to be the official CSV.`);
  }
  const outputPath = path.join(projectRoot, outputRelativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, text);
  const { size } = await stat(outputPath);
  console.log(`    Saved ${outputRelativePath} (${size.toLocaleString()} bytes).`);
  return outputRelativePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const checkedDate = new Date().toISOString().slice(0, 10);
  console.log(`Healthcare data refresh starting (checked date ${checkedDate}).`);

  if (!args.skipCms) {
    const cmsCsv = await download(
      "CMS Hospital General Information",
      cmsDownloadUrl,
      "public/data/healthcare/imports/cms/hospital-general-information-latest.csv"
    );
    runNodeScript(
      "Generating CMS Medicare-registration enrichment input",
      "scripts/generateCmsMedicareEnrichmentInput.mjs",
      [`--input=${cmsCsv}`, `--output=${cmsEnrichmentOutput}`, `--checked-date=${checkedDate}`]
    );
    runNodeScript(
      "Applying CMS enrichment (only fills unknown fields)",
      "scripts/applyHealthcareEnrichment.mjs",
      [`--input=${cmsEnrichmentOutput}`, "--write"]
    );
  }

  if (!args.skipHrsa) {
    const hrsaCsv = await download(
      "HRSA Health Center Service Delivery and Look-Alike Sites",
      hrsaDownloadUrl,
      `tmp/hrsa-sites-${checkedDate}.csv`
    );
    runNodeScript(
      "Generating HRSA designation enrichment input",
      "scripts/generateHrsaEnrichmentInput.mjs",
      [`--input=${hrsaCsv}`, `--output=${hrsaEnrichmentOutput}`, `--checked-date=${checkedDate}`]
    );
    runNodeScript(
      "Applying HRSA enrichment (only fills unknown fields)",
      "scripts/applyHealthcareEnrichment.mjs",
      [`--input=${hrsaEnrichmentOutput}`, "--write"]
    );
    runNodeScript(
      "Refreshing HRSA weekly operating-hours notes",
      "scripts/refreshHrsaHoursNotes.mjs",
      [`--input=${hrsaCsv}`, "--write"]
    );
  }

  runNodeScript("Reassigning facility boundaries", "scripts/assignFacilityBoundaries.mjs", [
    "--write"
  ]);
  runNodeScript(
    "Regenerating boundary healthcare summaries",
    "scripts/generateBoundaryHealthcareSummaries.mjs",
    ["--write"]
  );
  runNodeScript(
    "Regenerating healthcare coverage summary",
    "scripts/generateHealthcareCoverageSummary.mjs",
    ["--write"]
  );
  runNodeScript(
    "Regenerating New Jersey public facility shard",
    "scripts/buildNjHealthcareFacilityShard.mjs"
  );
  runNodeScript(
    "Auditing access coverage",
    "scripts/auditHealthcareAccessCoverage.mjs"
  );
  runNodeScript(
    "Auditing unknown marker rescue",
    "scripts/auditHealthcareUnknownMarkerRescue.mjs"
  );

  if (!args.skipChecks) {
    run("Running project checks", "npm", ["run", "check"]);
  }

  console.log("\nHealthcare data refresh complete.");
}

main().catch((error) => {
  console.error("Healthcare data refresh failed.");
  console.error(error.message ?? error);
  process.exitCode = 1;
});
