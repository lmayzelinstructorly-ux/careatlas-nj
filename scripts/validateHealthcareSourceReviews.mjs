import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultReviewPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "imports",
  "source-reviews.json"
);

const allowedSourceTypes = new Set([
  "official",
  "hospital_system",
  "state_open_data",
  "federal_open_data",
  "manually_collected",
  "unknown"
]);

const allowedReadinessStatuses = new Set([
  "ready_to_import",
  "needs_review",
  "not_ready"
]);

const countFields = [
  "recordsReviewed",
  "recordsImportReady",
  "missingCoordinates",
  "coordinatesOutsideStateBounds",
  "rowsWithStateMismatch",
  "missingSourceUrl",
  "missingPriceInfo",
  "missingInsuranceInfo",
  "missingHours"
];

function parseArgs(argv) {
  const args = {
    allowDemo: false,
    inputPath: defaultReviewPath
  };

  for (const arg of argv) {
    if (arg === "--allow-demo") {
      args.allowDemo = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option "${arg}".`);
    } else {
      args.inputPath = path.resolve(projectRoot, arg);
    }
  }

  return args;
}

function printHelp() {
  console.log("Validate healthcare source review JSON data.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run validate:healthcare:sources");
  console.log("  node scripts/validateHealthcareSourceReviews.mjs public/data/healthcare/imports/source-reviews.sample.json --allow-demo");
  console.log("");
  console.log("The default production source-reviews.json file cannot contain demo records.");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value) {
  if (!hasText(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function reviewLabel(review, index) {
  if (isObject(review) && hasText(review.id)) {
    return `source review ${index + 1} (${review.id})`;
  }

  return `source review ${index + 1}`;
}

function isDemoReview(review) {
  if (!isObject(review)) {
    return false;
  }

  if (review.isDemo === true || review.isDemoData === true) {
    return true;
  }

  return /(^|[^a-z])(demo|sample|test|placeholder|fake)([^a-z]|$)/i.test(
    [
      review.id,
      review.sourceName,
      review.sourceFileName,
      review.sourceUrl,
      review.notes
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function validateReview(review, index, seenIds) {
  const errors = [];
  const label = reviewLabel(review, index);

  if (!isObject(review)) {
    return [`${label} must be an object.`];
  }

  if (hasText(review.id)) {
    if (seenIds.has(review.id)) {
      errors.push(`${label} uses duplicate id "${review.id}".`);
    }

    seenIds.add(review.id);
  }

  if (!hasText(review.sourceName)) {
    errors.push(`${label} needs a sourceName value.`);
  }

  if (!hasText(review.sourceType)) {
    errors.push(`${label} needs a sourceType value.`);
  } else if (!allowedSourceTypes.has(review.sourceType)) {
    errors.push(
      `${label} has unknown sourceType "${review.sourceType}". Use one of: ${[
        ...allowedSourceTypes
      ].join(", ")}.`
    );
  }

  if (!hasText(review.readinessStatus)) {
    errors.push(`${label} needs a readinessStatus value.`);
  } else if (!allowedReadinessStatuses.has(review.readinessStatus)) {
    errors.push(
      `${label} has unknown readinessStatus "${review.readinessStatus}". Use one of: ${[
        ...allowedReadinessStatuses
      ].join(", ")}.`
    );
  }

  if (!hasText(review.state)) {
    errors.push(`${label} needs a state value.`);
  }

  if (review.dateChecked !== undefined && !isValidDate(review.dateChecked)) {
    errors.push(`${label} dateChecked must use YYYY-MM-DD format.`);
  }

  for (const field of countFields) {
    const value = review[field];

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      errors.push(`${label} ${field} must be a nonnegative number when provided.`);
    }
  }

  if (
    typeof review.recordsImportReady === "number" &&
    typeof review.recordsReviewed === "number" &&
    review.recordsImportReady > review.recordsReviewed
  ) {
    errors.push(`${label} recordsImportReady cannot exceed recordsReviewed.`);
  }

  return errors;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  let parsed;

  try {
    const raw = await readFile(args.inputPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("Healthcare source review validation failed.");
    console.error(
      `Could not read valid JSON from ${path.relative(projectRoot, args.inputPath)}.`
    );
    console.error(`Details: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(parsed)) {
    console.error("Healthcare source review validation failed.");
    console.error(
      `${path.relative(projectRoot, args.inputPath)} must contain a JSON array.`
    );
    process.exit(1);
  }

  const seenIds = new Set();
  const errors = parsed.flatMap((review, index) =>
    validateReview(review, index, seenIds)
  );
  const isProductionReviewFile = path.resolve(args.inputPath) === defaultReviewPath;
  const demoReviewCount = parsed.filter(isDemoReview).length;

  if (isProductionReviewFile && demoReviewCount > 0 && !args.allowDemo) {
    errors.push(
      "Production source-reviews.json should not contain demo source review records."
    );
  } else if (demoReviewCount > 0 && !args.allowDemo) {
    console.warn(
      `Warning: ${path.relative(projectRoot, args.inputPath)} contains ${demoReviewCount} demo source review record${demoReviewCount === 1 ? "" : "s"}.`
    );
  }

  if (errors.length > 0) {
    console.error("Healthcare source review validation failed.");
    console.error("Please fix the following issues:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Healthcare source review validation passed for ${parsed.length} source review${parsed.length === 1 ? "" : "s"}.`
  );
}

main().catch((error) => {
  console.error("Healthcare source review validation failed.");
  console.error(error.message);
  process.exit(1);
});
