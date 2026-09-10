import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildHealthcareCoverageSummaryFromProduction,
  coverageSummaryPath,
  relativePath
} from "./healthcareCoverageSummary.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

function parseArgs(argv) {
  const args = {
    outputPath: coverageSummaryPath,
    write: false
  };

  for (const arg of argv) {
    if (arg === "--write") {
      args.write = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = path.resolve(projectRoot, arg.slice("--output=".length));
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  return args;
}

function printHelp() {
  console.log("Generate the production healthcare coverage summary.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run generate:healthcare-coverage-summary");
  console.log("  npm run generate:healthcare-coverage-summary -- --write");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const summary = await buildHealthcareCoverageSummaryFromProduction();

  console.log("Healthcare production coverage summary");
  console.log(`Production facilities: ${summary.totalFacilities}`);
  console.log(
    `Loaded states: ${summary.loadedStates.map((state) => state.name).join(", ") || "none"}`
  );
  console.log(
    `Facilities with valid coordinates: ${summary.coordinateCoverage.facilitiesWithValidCoordinates}`
  );

  if (!args.write) {
    console.log("Dry run only. Use --write to update the generated artifact.");
    return;
  }

  await writeFile(args.outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`Wrote ${relativePath(args.outputPath)}.`);
}

main().catch((error) => {
  console.error("Healthcare coverage summary generation failed.");
  console.error(error.message);
  process.exit(1);
});
