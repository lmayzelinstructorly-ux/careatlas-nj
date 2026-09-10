import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildBoundaryHealthcareSummaries,
  relativePath,
  summariesPath
} from "./boundaryHealthcareSummaries.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

function parseArgs(argv) {
  const args = {
    outputPath: summariesPath,
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
  console.log("Generate boundary-level healthcare access summaries.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run generate:boundary-healthcare-summaries");
  console.log("  npm run generate:boundary-healthcare-summaries -- --write");
  console.log("");
  console.log("Without --write, the command prints an audit report and does not update the generated cache.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const artifact = await buildBoundaryHealthcareSummaries();
  const counts = artifact.metadata.summaryCounts;
  const supportedCounts = artifact.metadata.supportedBoundaryCounts;
  const noAssignedCounts = artifact.metadata.noAssignedBoundaryCounts;
  const statuses = artifact.metadata.statusCounts;

  console.log("Boundary healthcare summary report");
  console.log(`Production facilities: ${artifact.metadata.totalProductionFacilities}`);
  console.log(`State summaries with assigned facilities: ${counts.state} of ${supportedCounts.state}`);
  console.log(`County summaries with assigned facilities: ${counts.county} of ${supportedCounts.county}`);
  console.log(`Local jurisdiction summaries with assigned facilities: ${counts.local_jurisdiction} of ${supportedCounts.local_jurisdiction}`);
  console.log(`States using no-assigned policy: ${noAssignedCounts.state}`);
  console.log(`Counties using no-assigned policy: ${noAssignedCounts.county}`);
  console.log(`Local jurisdictions using no-assigned policy: ${noAssignedCounts.local_jurisdiction}`);
  console.log(`Boundaries with assigned facilities: ${statuses.has_facilities ?? 0}`);
  console.log(`Boundaries with no assigned facilities: ${statuses.no_assigned_facilities ?? 0}`);
  console.log(`Limited-data summaries: ${statuses.limited_data ?? 0}`);

  if (!args.write) {
    console.log("Dry run only. Use --write to update the boundary healthcare summary cache.");
    return;
  }

  await writeFile(args.outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`Wrote ${relativePath(args.outputPath)}.`);
}

main().catch((error) => {
  console.error("Boundary healthcare summary generation failed.");
  console.error(error.message);
  process.exit(1);
});
