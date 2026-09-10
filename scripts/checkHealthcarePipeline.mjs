import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isWithinStateBounds, loadStateBounds } from "./lib/stateBounds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const fixtureCsvPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "test-fixtures",
  "healthcare-pipeline-fixture.csv"
);
const tmpDirectory = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "test-fixtures",
  "tmp"
);
const tmpStagingPath = path.join(tmpDirectory, "facilities.staged.json");
const tmpProductionPath = path.join(tmpDirectory, "facilities.pipeline-output.json");
const tmpPromotionReportPath = path.join(tmpDirectory, "latest-promotion-report.json");
const realProductionPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);
const realStagingPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "staging",
  "facilities.staged.json"
);

function toProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readMaybe(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function readJsonArray(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  assert(Array.isArray(parsed), `${toProjectPath(filePath)} must contain a JSON array.`);
  return parsed;
}

function runNodeScript(scriptPath, args, options = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  const command = `node ${path.basename(scriptPath)} ${args.join(" ")}`.trim();

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

function hasDemoMarker(facility) {
  return (
    facility?.isDemoData === true ||
    facility?.verificationStatus === "demo" ||
    /(^|[^a-z])(demo|sample|test|placeholder|fake|fixture)([^a-z]|$)/i.test(
      [
        facility?.id,
        facility?.name,
        facility?.sourceDataset,
        facility?.sourceInfo?.sourceName,
        facility?.sourceInfo?.notes
      ]
        .filter(Boolean)
        .join(" ")
    )
  );
}

async function assertRealFilesUnchanged(beforeProduction, beforeStaging) {
  const afterProduction = await readMaybe(realProductionPath);
  const afterStaging = await readMaybe(realStagingPath);

  assert(
    afterProduction === beforeProduction,
    `${toProjectPath(realProductionPath)} changed during the pipeline check.`
  );
  assert(
    afterStaging === beforeStaging,
    `${toProjectPath(realStagingPath)} changed during the pipeline check.`
  );
}

async function main() {
  const beforeProduction = await readMaybe(realProductionPath);
  const beforeStaging = await readMaybe(realStagingPath);

  try {
    console.log("Step 0: Checking reusable official state bounds");
    const stateCoordinateFixtures = {
      NJ: [40.2206, -74.7699],
      NY: [42.6526, -73.7562],
      PA: [40.2732, -76.8867],
      DE: [39.1582, -75.5244],
      CT: [41.7658, -72.6734],
      MD: [38.9784, -76.4922],
      DC: [38.9072, -77.0369]
    };

    for (const [state, [latitude, longitude]] of Object.entries(stateCoordinateFixtures)) {
      const bounds = await loadStateBounds(projectRoot, state);
      assert(
        isWithinStateBounds(latitude, longitude, bounds),
        `${state} fixture coordinate should be within the official state boundary extent.`
      );
      assert(
        !isWithinStateBounds(0, 0, bounds),
        `${state} bounds should reject a clearly out-of-state coordinate.`
      );
    }

    await rm(tmpDirectory, { force: true, recursive: true });
    await mkdir(tmpDirectory, { recursive: true });
    await writeFile(tmpProductionPath, "[]\n", "utf8");

    console.log("Step 1: Reviewing fixture CSV");
    runNodeScript("scripts/reviewHealthcareImportFile.mjs", [
      `--input=${toProjectPath(fixtureCsvPath)}`,
      "--source-name=CareAtlas test fixture",
      "--source-type=unknown",
      "--state=NJ"
    ]);

    console.log("Step 2: Staging fixture records");
    runNodeScript("scripts/stageHealthcareImport.mjs", [
      `--input=${toProjectPath(fixtureCsvPath)}`,
      "--source-name=CareAtlas test fixture",
      "--source-type=unknown",
      "--state=NJ",
      `--output=${toProjectPath(tmpStagingPath)}`,
      "--allow-demo",
      "--replace",
      "--write"
    ]);
    runNodeScript("scripts/listStagedHealthcareFacilities.mjs", [
      `--file=${toProjectPath(tmpStagingPath)}`
    ]);

    console.log("Step 3: Validating staged records");
    runNodeScript("scripts/validateHealthcareStaging.mjs", [
      `--file=${toProjectPath(tmpStagingPath)}`
    ]);

    console.log("Step 4: Approving one staged record");
    const stagedBeforeReview = await readJsonArray(tmpStagingPath);
    assert(stagedBeforeReview.length >= 2, "The pipeline fixture must stage at least two records.");

    const approvedStagingId = stagedBeforeReview[0].stagingId;
    const pendingStagingId = stagedBeforeReview[1].stagingId;
    const approvedFacilityId = stagedBeforeReview[0].facility.id;
    const pendingFacilityId = stagedBeforeReview[1].facility.id;

    runNodeScript("scripts/reviewStagedHealthcareFacility.mjs", [
      `--file=${toProjectPath(tmpStagingPath)}`,
      `--id=${approvedStagingId}`,
      "--status=approved",
      "--notes=Approved inside the isolated healthcare pipeline fixture check.",
      "--clear-issues",
      "--write"
    ]);
    runNodeScript("scripts/validateHealthcareStaging.mjs", [
      `--file=${toProjectPath(tmpStagingPath)}`,
      "--allow-approved-demo"
    ]);

    const stagedAfterReview = await readJsonArray(tmpStagingPath);
    const pendingRecord = stagedAfterReview.find(
      (record) => record.stagingId === pendingStagingId
    );
    assert(
      pendingRecord?.stagingStatus !== "approved",
      "The second fixture record should remain pending or needs_more_source_info."
    );

    console.log("Step 5: Promoting approved records to temporary output");
    runNodeScript("scripts/promoteStagedHealthcareFacilities.mjs", [
      `--staging-file=${toProjectPath(tmpStagingPath)}`,
      `--production-file=${toProjectPath(tmpProductionPath)}`,
      `--report-file=${toProjectPath(tmpPromotionReportPath)}`,
      "--allow-demo-output"
    ]);
    runNodeScript("scripts/promoteStagedHealthcareFacilities.mjs", [
      `--staging-file=${toProjectPath(tmpStagingPath)}`,
      `--production-file=${toProjectPath(tmpProductionPath)}`,
      `--report-file=${toProjectPath(tmpPromotionReportPath)}`,
      "--allow-demo-output",
      "--write"
    ]);

    const promotedFacilities = await readJsonArray(tmpProductionPath);
    const promotedIds = new Set(promotedFacilities.map((facility) => facility.id));

    assert(
      promotedFacilities.length === 1,
      `Expected exactly one approved fixture record to be promoted, found ${promotedFacilities.length}.`
    );
    assert(
      promotedIds.has(approvedFacilityId),
      "The approved fixture record was not promoted to the temporary output."
    );
    assert(
      !promotedIds.has(pendingFacilityId),
      "A pending fixture record was unexpectedly promoted."
    );
    assert(
      promotedFacilities.every(hasDemoMarker),
      "Temporary output should only contain clearly marked fixture/demo records."
    );

    console.log("Step 6: Validating temporary production output");
    runNodeScript("scripts/validateHealthcareFacilities.mjs", [
      `--file=${toProjectPath(tmpProductionPath)}`,
      "--allow-demo"
    ]);
    runNodeScript("scripts/validateHealthcareFacilities.mjs", [
      `--file=${toProjectPath(realProductionPath)}`
    ]);

    const realFacilities = await readJsonArray(realProductionPath);
    assert(
      !realFacilities.some(hasDemoMarker),
      "Real production facilities.json contains demo/sample-looking healthcare records."
    );

    await assertRealFilesUnchanged(beforeProduction, beforeStaging);
    console.log("Healthcare pipeline check passed.");
  } catch (error) {
    await assertRealFilesUnchanged(beforeProduction, beforeStaging);
    throw error;
  }
}

main().catch((error) => {
  console.error("Healthcare pipeline check failed.");
  console.error(error.message);
  process.exit(1);
});
