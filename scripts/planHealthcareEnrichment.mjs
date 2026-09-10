import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnrichmentPlan } from "./lib/healthcareEnrichmentPlan.mjs";

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
    productionFile: defaultProductionPath
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--input=")) {
      args.input = path.resolve(projectRoot, arg.slice("--input=".length));
    } else if (arg.startsWith("--production-file=")) {
      args.productionFile = path.resolve(projectRoot, arg.slice("--production-file=".length));
    } else if (arg.startsWith("--output=")) {
      args.output = path.resolve(projectRoot, arg.slice("--output=".length));
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
  console.log("Plan source-backed healthcare enrichment for existing production records.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run plan:healthcare-enrichment -- --input=tmp/enrichment-input.json");
  console.log("  node scripts/planHealthcareEnrichment.mjs --input=tmp/enrichment-input.json --production-file=tmp/facilities.json --output=tmp/enrichment-plan.json");
  console.log("");
  console.log("This is a dry-run planner. It never writes production facilities.json.");
}

async function readJsonArray(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${path.relative(projectRoot, filePath).replace(/\\/g, "/")} must contain a JSON array.`);
  }

  return parsed;
}

function formatRelativePath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function printSummary(plan) {
  const { summary } = plan;

  console.log("Healthcare enrichment plan summary");
  console.log("Dry run only. No production data written. verificationStatus unchanged.");
  console.log(`Applicable records: ${summary.applicable}`);
  console.log(`Blocked records: ${summary.blocked}`);
  console.log(`No-change records: ${summary.no_change}`);
  console.log(`Total proposed field changes: ${summary.totalProposedFieldChanges}`);
  console.log("Records gaining source-backed enrichment categories:");

  for (const [category, count] of Object.entries(summary.recordsGainingEachScoreCategory)) {
    console.log(`- ${category}: ${count}`);
  }

  console.log("");
  console.log("Input records:");

  for (const record of plan.records) {
    const detail =
      record.classification === "blocked" && record.reasons.length > 0
        ? ` (${record.reasons.join(" ")})`
        : "";
    console.log(`- ${record.id}: ${record.classification}${detail}`);
  }
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

  printSummary(plan);

  if (args.output) {
    await mkdir(path.dirname(args.output), { recursive: true });
    await writeFile(args.output, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    console.log("");
    console.log(`Wrote enrichment plan report to ${formatRelativePath(args.output)}.`);
  }
}

main().catch((error) => {
  console.error("Healthcare enrichment planning failed.");
  console.error(error.message);
  process.exit(1);
});
