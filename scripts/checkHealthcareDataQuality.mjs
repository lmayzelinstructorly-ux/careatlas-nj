import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const tscPath = path.join(
  projectRoot,
  "node_modules",
  "typescript",
  "bin",
  "tsc"
);

async function findCompiledFile(directory, fileName) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nestedResult = await findCompiledFile(entryPath, fileName);

      if (nestedResult) {
        return nestedResult;
      }
    }

    if (entry.isFile() && entry.name === fileName) {
      return entryPath;
    }
  }

  return null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createFacility(overrides = {}) {
  return {
    id: "verified-clinic",
    name: "Verified Clinic",
    facilityType: "community_health_center",
    address: "100 Example Street",
    city: "Sampleville",
    state: "NJ",
    latitude: 40.7,
    longitude: -74.1,
    phone: "555-0100",
    website: "https://example.org",
    services: ["primary care", "vaccination referrals", "basic screenings"],
    hours: {
      monday: "8:00 AM - 6:00 PM",
      tuesday: "8:00 AM - 6:00 PM",
      wednesday: "8:00 AM - 6:00 PM",
      thursday: "8:00 AM - 6:00 PM",
      friday: "8:00 AM - 6:00 PM"
    },
    priceInfo: {
      priceLevel: "low_cost",
      acceptsSlidingScale: true,
      priceNotes: "Test data only."
    },
    insuranceInfo: {
      acceptsMedicaid: true,
      acceptsMedicare: true,
      acceptsUninsured: true
    },
    sourceInfo: {
      sourceName: "CareAtlas quality test",
      sourceUrl: "https://example.org",
      lastChecked: "2026-05-29"
    },
    fieldSources: {
      cost: {
        field: "cost",
        status: "source_backed",
        sourceUrl: "https://example.org/locations/verified-clinic/cost",
        sourceTitle: "Verified Clinic cost information",
        checkedDate: "2026-05-29",
        sourceType: "official_facility_page",
        locationSpecific: true
      },
      hours: {
        field: "hours",
        status: "source_backed",
        sourceUrl: "https://example.org/locations/verified-clinic/hours",
        sourceTitle: "Verified Clinic hours",
        checkedDate: "2026-05-29",
        sourceType: "official_facility_page",
        locationSpecific: true
      },
      insurance: {
        field: "insurance",
        status: "source_backed",
        sourceUrl: "https://example.org/locations/verified-clinic/insurance",
        sourceTitle: "Verified Clinic insurance information",
        checkedDate: "2026-05-29",
        sourceType: "official_facility_page",
        locationSpecific: true
      },
      services: {
        field: "services",
        status: "source_backed",
        sourceUrl: "https://example.org/locations/verified-clinic/services",
        sourceTitle: "Verified Clinic services",
        checkedDate: "2026-05-29",
        sourceType: "official_facility_page",
        locationSpecific: true
      }
    },
    lastVerified: "2026-05-29",
    verificationStatus: "verified",
    ...overrides
  };
}

async function main() {
  const outputDirectory = await mkdtemp(
    path.join(os.tmpdir(), "careatlas-quality-")
  );

  try {
    const compileResult = spawnSync(
      process.execPath,
      [
        tscPath,
        "src/utils/healthcareDataQuality.ts",
        "--target",
        "ES2022",
        "--module",
        "ES2022",
        "--moduleResolution",
        "bundler",
        "--outDir",
        outputDirectory,
        "--skipLibCheck"
      ],
      {
        cwd: projectRoot,
        encoding: "utf8"
      }
    );

    if (compileResult.status !== 0) {
      process.stderr.write(compileResult.stdout);
      process.stderr.write(compileResult.stderr);
      throw new Error("Could not compile healthcare data quality utility.");
    }

    const compiledUtilityPath = await findCompiledFile(
      outputDirectory,
      "healthcareDataQuality.js"
    );

    if (!compiledUtilityPath) {
      throw new Error("Compiled healthcare data quality utility was not found.");
    }

    const { auditHealthcareFacilityData, auditSingleHealthcareFacility } =
      await import(pathToFileURL(compiledUtilityPath));

    const emptyAudit = auditHealthcareFacilityData([]);
    assert(
      emptyAudit.totalFacilities === 0,
      "Empty audit should report zero facilities."
    );
    assert(
      emptyAudit.readinessLevel === "insufficient_data",
      "Empty audit should be insufficient data."
    );
    assert(
      typeof emptyAudit.emptyMessage === "string" &&
        emptyAudit.emptyMessage.length > 0,
      "Empty audit should include a friendly message."
    );

    const verifiedAudit = auditSingleHealthcareFacility(createFacility());
    assert(
      verifiedAudit.readinessLevel === "ready",
      "Complete verified record should be ready."
    );
    assert(
      verifiedAudit.qualityScore >= 82,
      "Complete verified record should have a high quality score."
    );
    assert(
      verifiedAudit.missingFields.length === 0,
      "Complete verified record should not report missing fields."
    );

    const sparseAudit = auditSingleHealthcareFacility(
      createFacility({
        address: "",
        latitude: undefined,
        longitude: undefined,
        phone: undefined,
        website: undefined,
        services: [],
        hours: {},
        priceInfo: {
          priceLevel: "unknown"
        },
        insuranceInfo: {},
        fieldSources: undefined,
        sourceInfo: undefined,
        lastVerified: "",
        verificationStatus: "unverified"
      })
    );
    assert(
      sparseAudit.readinessLevel === "insufficient_data",
      "Sparse unverified record should be insufficient data."
    );
    assert(
      sparseAudit.qualityScore < verifiedAudit.qualityScore,
      "Sparse record should score lower than complete verified record."
    );
    assert(
      sparseAudit.missingFields.includes("coordinates"),
      "Sparse record should report missing coordinates."
    );
    assert(
      sparseAudit.recommendedDataFixes.length > 0,
      "Sparse record should include recommended data fixes."
    );

    const demoAudit = auditHealthcareFacilityData([
      createFacility({
        id: "demo-clinic",
        name: "Demo Clinic",
        verificationStatus: "demo"
      })
    ]);
    assert(
      demoAudit.demoCount === 1,
      "Dataset audit should count demo records."
    );
    assert(
      demoAudit.readinessLevel === "insufficient_data",
      "All-demo dataset should be insufficient data."
    );

    const mixedAudit = auditHealthcareFacilityData([
      createFacility({ id: "one", name: "One Clinic" }),
      createFacility({
        id: "two",
        name: "Two Clinic",
        sourceInfo: undefined,
        verificationStatus: "needs_review"
      }),
      createFacility({
        id: "three",
        name: "Three Clinic",
        services: [],
        verificationStatus: "unverified"
      })
    ]);
    assert(
      mixedAudit.totalFacilities === 3,
      "Dataset audit should preserve total facility count."
    );
    assert(
      mixedAudit.verifiedCount === 1 &&
        mixedAudit.needsReviewCount === 1 &&
        mixedAudit.unverifiedCount === 1,
      "Dataset audit should count verification states."
    );
    assert(
      mixedAudit.percentWithCoordinates === 100,
      "Dataset audit should calculate coordinate coverage."
    );
    assert(
      mixedAudit.topDataGaps.length > 0,
      "Dataset audit should report top data gaps."
    );
    assert(
      mixedAudit.recommendedNextSteps.length > 0,
      "Dataset audit should include recommended next steps."
    );

    console.log("Healthcare data quality checks passed.");
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error("Healthcare data quality checks failed.");
  console.error(error.message);
  process.exit(1);
});
