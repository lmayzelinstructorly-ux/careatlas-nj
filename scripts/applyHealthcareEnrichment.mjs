import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnrichmentPlan } from "./lib/healthcareEnrichmentPlan.mjs";
import { collectEnrichmentProvenanceErrors } from "./lib/healthcareEnrichmentProvenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultProductionPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);

function parseArgs(argv) {
  const args = {
    productionFile: defaultProductionPath,
    write: false
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg.startsWith("--input=")) {
      args.input = path.resolve(projectRoot, arg.slice("--input=".length));
    } else if (arg.startsWith("--production-file=")) {
      args.productionFile = path.resolve(projectRoot, arg.slice("--production-file=".length));
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  if (!args.help && !args.input) {
    throw new Error("--input=<path> is required.");
  }

  return args;
}

function printHelp() {
  console.log("Apply source-backed healthcare enrichment to production records.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run apply:healthcare-enrichment -- --input=tmp/enrichment-input.json");
  console.log("  npm run apply:healthcare-enrichment -- --input=tmp/enrichment-input.json --write");
  console.log("");
  console.log("Without --write, this prints the apply report and writes nothing.");
  console.log("Only records the enrichment plan classifies as applicable are changed;");
  console.log("every applied field must carry source_backed field-level provenance.");
  console.log("verificationStatus is never changed by enrichment.");
}

function formatRelativePath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

async function readJsonArray(filePath) {
  const parsed = JSON.parse(await readFile(filePath, "utf8"));

  if (!Array.isArray(parsed)) {
    throw new Error(`${formatRelativePath(filePath)} must contain a JSON array.`);
  }

  return parsed;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const fieldValueKeys = {
  accessibility: ["accessibilityInfo"],
  acceptingPatients: [
    "acceptingPatients",
    "acceptingPatientsInfo",
    "acceptingPatientsNotes"
  ],
  cost: ["priceInfo"],
  hours: ["hours"],
  insurance: ["insuranceInfo"],
  languages: ["languages", "languageNotes"],
  services: ["services"]
};

function applyEnrichmentToFacility(facility, input, appliedFields) {
  const enriched = structuredClone(facility);
  const enrichment = isObject(input.enrichment) ? input.enrichment : {};
  const inputFieldSources = isObject(input.fieldSources) ? input.fieldSources : {};
  const fieldSources = isObject(enriched.fieldSources)
    ? enriched.fieldSources
    : {};

  for (const field of appliedFields) {
    for (const key of fieldValueKeys[field] ?? []) {
      if (Object.prototype.hasOwnProperty.call(enrichment, key)) {
        enriched[key] = structuredClone(enrichment[key]);
      }
    }

    if (Object.prototype.hasOwnProperty.call(inputFieldSources, field)) {
      fieldSources[field] = structuredClone(inputFieldSources[field]);
    }
  }

  if (Object.keys(fieldSources).length > 0) {
    enriched.fieldSources = fieldSources;
  }

  return enriched;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const productionFacilities = await readJsonArray(args.productionFile);
  const enrichmentInputs = await readJsonArray(args.input);
  const plan = buildEnrichmentPlan(productionFacilities, enrichmentInputs);
  const inputById = new Map(
    enrichmentInputs
      .filter((input) => input?.id !== undefined)
      .map((input) => [input.id, input])
  );
  const applicableRecords = plan.records.filter(
    (record) => record.classification === "applicable"
  );
  const applicableById = new Map(applicableRecords.map((record) => [record.id, record]));

  const nextFacilities = [];
  const provenanceErrors = [];
  let appliedCount = 0;
  let appliedFieldCount = 0;

  for (const facility of productionFacilities) {
    const planRecord = applicableById.get(facility.id);
    const input = planRecord ? inputById.get(facility.id) : undefined;

    if (!planRecord || !input) {
      nextFacilities.push(facility);
      continue;
    }

    const enriched = applyEnrichmentToFacility(facility, input, planRecord.appliedFields);
    const errors = collectEnrichmentProvenanceErrors(enriched, {
      requireSourceBacked: true,
      label: facility.id
    });

    if (errors.length > 0) {
      provenanceErrors.push(...errors);
      nextFacilities.push(facility);
      continue;
    }

    nextFacilities.push(enriched);
    appliedCount += 1;
    appliedFieldCount += planRecord.appliedFields.length;
  }

  console.log("Healthcare enrichment apply report");
  console.log(`Applicable records: ${plan.summary.applicable}`);
  console.log(`Blocked records: ${plan.summary.blocked}`);
  console.log(`No-change records: ${plan.summary.no_change}`);
  console.log(`Records enriched: ${appliedCount}`);
  console.log(`Fields enriched: ${appliedFieldCount}`);
  console.log("Records gaining source-backed enrichment categories:");

  for (const [category, count] of Object.entries(
    plan.summary.recordsGainingEachScoreCategory
  )) {
    console.log(`- ${category}: ${count}`);
  }

  if (provenanceErrors.length > 0) {
    console.error("");
    console.error("Provenance validation failed after merge; nothing was written:");
    for (const error of provenanceErrors.slice(0, 20)) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  if (!args.write) {
    console.log("");
    console.log("Dry run only. Re-run with --write to update the production file.");
    return;
  }

  await writeFile(
    args.productionFile,
    `${JSON.stringify(nextFacilities, null, 2)}\n`,
    "utf8"
  );
  console.log("");
  console.log(
    `Wrote ${appliedCount} enriched records to ${formatRelativePath(args.productionFile)}.`
  );
  console.log(
    "Re-run assign:facility-boundaries, generate:boundary-healthcare-summaries and generate:healthcare-coverage-summary if enrichment changed scoring inputs."
  );
}

main().catch((error) => {
  console.error("Healthcare enrichment apply failed.");
  console.error(error.message);
  process.exit(1);
});
