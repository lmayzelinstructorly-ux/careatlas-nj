import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import {
  buildHealthcareCoverageSummaryFromProduction,
  coverageSummaryPath,
  readJson,
  relativePath
} from "./healthcareCoverageSummary.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

function parseArgs(argv) {
  const args = { inputPath: coverageSummaryPath };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--file=")) {
      args.inputPath = path.resolve(projectRoot, arg.slice("--file=".length));
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option "${arg}".`);
    } else {
      args.inputPath = path.resolve(projectRoot, arg);
    }
  }

  return args;
}

function printHelp() {
  console.log("Validate the generated production healthcare coverage summary.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run validate:healthcare-coverage-summary");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const [actual, expected] = await Promise.all([
    readJson(args.inputPath),
    buildHealthcareCoverageSummaryFromProduction()
  ]);

  if (!isDeepStrictEqual(actual, expected)) {
    const actualStates = new Map(
      (actual.loadedStates ?? []).map((state) => [state.postalCode, state])
    );
    const expectedStates = new Map(
      expected.loadedStates.map((state) => [state.postalCode, state])
    );
    const errors = [];

    for (const [postalCode, state] of actualStates) {
      if (!expectedStates.has(postalCode)) {
        errors.push(
          `${state.name ?? postalCode} is claimed as loaded but facilities.json has no source-backed production records for ${postalCode}.`
        );
      }
    }

    for (const [postalCode, expectedState] of expectedStates) {
      const actualState = actualStates.get(postalCode);

      if (!actualState) {
        errors.push(`${expectedState.name} is missing from loadedStates.`);
      } else if (actualState.facilityCount !== expectedState.facilityCount) {
        errors.push(
          `${expectedState.name} facilityCount is ${actualState.facilityCount}; expected ${expectedState.facilityCount}.`
        );
      }
    }

    if (!isDeepStrictEqual(actual.sources, expected.sources)) {
      errors.push("Source names, datasets, counts, or loaded states disagree with facilities.json.");
    }

    if (errors.length === 0) {
      errors.push("One or more generated coverage fields disagree with facilities.json.");
    }

    console.error("Healthcare coverage summary validation failed.");
    console.error("Please fix the following issues:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error(
      "Regenerate with npm run generate:healthcare-coverage-summary -- --write."
    );
    process.exit(1);
  }

  console.log(
    `Healthcare coverage summary validation passed for ${actual.totalFacilities} facilities across ${actual.loadedStates.length} loaded state(s).`
  );
  console.log(`Validated ${relativePath(args.inputPath)}.`);
}

main().catch((error) => {
  console.error("Healthcare coverage summary validation failed.");
  console.error(error.message);
  process.exit(1);
});
