import { spawn } from "node:child_process";
import path from "node:path";

const npmCliPath =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

const checks = [
  {
    label: "address search and geocoding regression checks",
    command: ["run", "check:address-search"]
  },
  {
    label: "healthcare validation and data quality",
    command: ["run", "validate:healthcare"]
  },
  {
    label: "healthcare enrichment plan fixture check",
    command: ["run", "check:healthcare-enrichment-plan"]
  },
  {
    label: "healthcare enrichment provenance fixtures",
    command: ["run", "check:healthcare-enrichment-provenance"]
  },
  {
    label: "healthcare provider enrichment opportunity audit",
    command: ["run", "audit:healthcare-provider-enrichment-opportunities"]
  },
  {
    label: "healthcare provider review packet generation",
    command: ["run", "generate:healthcare-provider-review-packets"]
  },
  {
    label: "healthcare reviewed provider enrichment importer dry run",
    command: ["run", "build:healthcare-provider-reviewed-enrichment"]
  },
  {
    label: "healthcare official-source enrichment collector check",
    command: ["run", "check:healthcare-official-enrichment"]
  },
  {
    label: "healthcare staging validation",
    command: ["run", "validate:healthcare:staging"]
  },
  {
    label: "healthcare pipeline end-to-end check",
    command: ["run", "check:healthcare-pipeline"]
  },
  {
    label: "read-only HRSA refresh audit fixture check",
    command: ["run", "check:hrsa-refresh-audit"]
  },
  {
    label: "public on-map safety and source copy check",
    command: ["run", "check:public-safety-copy"]
  },
  {
    label: "doctor-office production artifact validation",
    command: ["run", "validate:doctor-offices"]
  },
  {
    label: "doctor-office official import pipeline check",
    command: ["run", "check:doctor-office-pipeline"]
  },
  {
    label: "doctor-office specialty-first layer check",
    command: ["run", "check:doctor-office-layer"]
  },
  {
    label: "resident map and doctor-office UI interaction tests",
    command: ["run", "test:ui"]
  },
  {
    label: "public map workflow check",
    command: ["run", "check:public-map-workflow"]
  },
  {
    label: "Gemini explanation safety fixture check",
    command: ["run", "check:gemini-explanation"]
  },
  {
    label: "New Jersey map geography consistency check",
    command: ["run", "check:nj-map-geography"]
  },
  {
    label: "tract facility proximity fixture and production check",
    command: ["run", "check:tract-facility-proximity"]
  },
  {
    label: "demo readiness documentation check",
    command: ["run", "check:demo-readiness"]
  },
  {
    label: "healthcare production coverage summary validation",
    command: ["run", "validate:healthcare-coverage-summary"]
  },
  {
    label: "facility boundary assignment validation",
    command: ["run", "validate:facility-boundaries"]
  },
  {
    label: "boundary healthcare summary validation",
    command: ["run", "validate:boundary-healthcare-summaries"]
  },
  {
    label: "New Jersey tract foundation validation",
    command: ["run", "validate:nj-tract-foundation"]
  },
  {
    label: "tract evidence schema fixture check",
    command: ["run", "check:tract-evidence-schema"]
  },
  {
    label: "CDC PLACES importer fixture check",
    command: ["run", "check:cdc-places-importer"]
  },
  {
    label: "CDC PLACES production evidence validation",
    command: ["run", "validate:cdc-places"]
  },
  {
    label: "Batch 6 social and shortage importer fixture checks",
    command: ["run", "check:batch6-importers"]
  },
  {
    label: "Batch 6 social and shortage production validation",
    command: ["run", "validate:batch6"]
  },
  {
    label: "Batch 7 transparent rule fixture and edge-case checks",
    command: ["run", "check:access-gap-rule"]
  },
  {
    label: "Batch 7 transparent tract classification validation",
    command: ["run", "validate:access-gap-classifications"]
  },
  {
    label: "Batch 8 public tract and county record generation",
    command: ["run", "build:batch8-public-records"]
  },
  {
    label: "Batch 8 public record validation",
    command: ["run", "validate:batch8-public-records"]
  },
  {
    label: "Batch 8 public map, evidence and download checks",
    command: ["run", "check:batch8-public-layer"]
  },
  {
    label: "New Jersey tract-to-town foundation generation",
    command: ["run", "build:nj-town-gap-foundation"]
  },
  {
    label: "New Jersey tract-to-town foundation validation",
    command: ["run", "validate:nj-town-gap-foundation"]
  },
  {
    label: "source file size guard",
    command: ["run", "check:source-file-size"]
  },
  {
    label: "geography data manifest generation",
    command: ["run", "build:data-manifest"]
  },
  {
    label: "boundary search index generation",
    command: ["run", "build:search-index"],
    retries: 1
  },
  {
    label: "local jurisdiction search index generation",
    command: ["run", "build:local-search-index"],
    retries: 1
  },
  {
    label: "production build",
    command: ["run", "build"]
  },
  {
    label: "local production server routes",
    command: ["run", "check:local-server"]
  },
  {
    label: "Cloudflare Worker deployment dry run",
    command: ["run", "check:cloudflare-deploy"]
  },
  {
    label: "route and map bundle splitting",
    command: ["run", "check:bundle-splitting"]
  },
  {
    label: "lazy map search performance",
    command: ["run", "check:map-search-performance"]
  },
  {
    label: "intent-driven map healthcare data performance",
    command: ["run", "check:map-healthcare-data-performance"]
  }
];

function formatCommand(command) {
  return ["npm", ...command].join(" ");
}

function runCheck({ label, command }) {
  return new Promise((resolve, reject) => {
    console.log(`\n==> Running ${label}...`);
    console.log(`Command: ${formatCommand(command)}`);

    const child = spawn(process.execPath, [npmCliPath, ...command], {
      shell: false,
      stdio: "inherit"
    });

    child.on("error", (error) => {
      reject(
        new Error(`${formatCommand(command)} could not start: ${error.message}`)
      );
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const reason =
        signal === null
          ? `exited with code ${code}`
          : `stopped after signal ${signal}`;

      reject(new Error(`${formatCommand(command)} ${reason}.`));
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

for (const check of checks) {
  const maxAttempts = (check.retries ?? 0) + 1;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await runCheck(check);
        break;
      } catch (error) {
        if (attempt >= maxAttempts) {
          throw error;
        }

        console.warn(
          `Retrying ${formatCommand(check.command)} after a transient failure...`
        );
        await wait(500);
      }
    }
  } catch (error) {
    console.error("\nProject checks failed.");
    console.error(error.message);
    console.error("Fix the issue above, then run npm run check again.");
    process.exit(1);
  }
}

console.log("\nAll terminal checks passed.");
