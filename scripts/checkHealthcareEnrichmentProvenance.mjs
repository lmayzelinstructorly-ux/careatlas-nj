import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectEnrichmentProvenanceErrors } from "./lib/healthcareEnrichmentProvenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const fixturePath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "test-fixtures",
  "enrichment-provenance.fixture.json"
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function runNodeScript(scriptPath, args, options = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  const command = `node ${scriptPath} ${args.join(" ")}`.trim();

  if (options.expectFailure) {
    assert(result.status !== 0, `${command} was expected to fail but passed.`);
    return result;
  }

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command} failed with exit code ${result.status}.`);
  }

  return result;
}

function createStagingRecord(facility, index) {
  return {
    stagingId: `staged-enrichment-provenance-${index + 1}`,
    facility,
    stagingStatus: "pending_review",
    stagingIssues: [],
    sourceFile: "public/data/healthcare/test-fixtures/enrichment-provenance.fixture.json",
    sourceName: "CareAtlas enrichment provenance fixture",
    sourceType: "official",
    state: facility.state,
    importDate: "2026-06-25"
  };
}

async function main() {
  const raw = await readFile(fixturePath, "utf8");
  const cases = JSON.parse(raw);

  assert(Array.isArray(cases), `${toProjectPath(fixturePath)} must contain an array.`);

  const validFacilities = [];
  const invalidFacilities = [];

  for (const testCase of cases) {
    const errors = collectEnrichmentProvenanceErrors(testCase.facility, {
      label: testCase.id,
      requireSourceBacked: true
    });

    if (testCase.expectedValid) {
      assert(
        errors.length === 0,
        `${testCase.id} should be valid but returned: ${errors.join(" ")}`
      );
      validFacilities.push(testCase.facility);
    } else {
      assert(
        errors.length > 0,
        `${testCase.id} should fail enrichment provenance validation.`
      );
      invalidFacilities.push(testCase.facility);
    }
  }

  assert(validFacilities.length >= 3, "Expected several valid enrichment provenance fixture records.");
  assert(invalidFacilities.length >= 3, "Expected several invalid enrichment provenance fixture records.");

  const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "careatlas-enrichment-"));

  try {
    const validProductionPath = path.join(tmpDirectory, "valid-facilities.json");
    const invalidProductionPath = path.join(tmpDirectory, "invalid-facilities.json");
    const validStagingPath = path.join(tmpDirectory, "valid-staging.json");
    const invalidStagingPath = path.join(tmpDirectory, "invalid-staging.json");

    await writeFile(validProductionPath, `${JSON.stringify(validFacilities, null, 2)}\n`, "utf8");
    await writeFile(invalidProductionPath, `${JSON.stringify(invalidFacilities, null, 2)}\n`, "utf8");
    await writeFile(
      validStagingPath,
      `${JSON.stringify(validFacilities.map(createStagingRecord), null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      invalidStagingPath,
      `${JSON.stringify(invalidFacilities.map(createStagingRecord), null, 2)}\n`,
      "utf8"
    );

    runNodeScript("scripts/validateHealthcareFacilities.mjs", [
      `--file=${toProjectPath(validProductionPath)}`,
      "--allow-demo"
    ]);
    runNodeScript(
      "scripts/validateHealthcareFacilities.mjs",
      [`--file=${toProjectPath(invalidProductionPath)}`, "--allow-demo"],
      { expectFailure: true }
    );
    runNodeScript("scripts/validateHealthcareStaging.mjs", [
      `--file=${toProjectPath(validStagingPath)}`,
      "--allow-approved-demo"
    ]);
    runNodeScript(
      "scripts/validateHealthcareStaging.mjs",
      [`--file=${toProjectPath(invalidStagingPath)}`, "--allow-approved-demo"],
      { expectFailure: true }
    );
  } finally {
    await rm(tmpDirectory, { force: true, recursive: true });
  }

  console.log(
    `Healthcare enrichment provenance checks passed for ${cases.length} fixture cases.`
  );
}

main().catch((error) => {
  console.error("Healthcare enrichment provenance checks failed.");
  console.error(error.message);
  process.exit(1);
});
