import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const defaultFacilitiesPath = path.join(
  projectRoot,
  "public",
  "data",
  "healthcare",
  "facilities.json"
);

const officialSourceUrl =
  "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv";
const sourceTitle =
  "HRSA Health Center Service Delivery and Look-Alike Sites (official CSV)";

function parseArgs(argv) {
  const args = { input: "", output: "", facilities: defaultFacilitiesPath, checkedDate: "" };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--input=")) args.input = path.resolve(projectRoot, arg.slice(8));
    else if (arg.startsWith("--output=")) args.output = path.resolve(projectRoot, arg.slice(9));
    else if (arg.startsWith("--facilities=")) {
      args.facilities = path.resolve(projectRoot, arg.slice(13));
    } else if (arg.startsWith("--checked-date=")) {
      args.checkedDate = arg.slice(15);
    } else throw new Error(`Unknown option "${arg}".`);
  }
  return args;
}

function printHelp() {
  console.log(
    "Generate a healthcare enrichment input file from the official HRSA CSV."
  );
  console.log("");
  console.log(
    "Derives only designation-level facts the HRSA row itself supports:"
  );
  console.log(
    "- insurance: Medicaid/uninsured access from the FQHC or Look-Alike"
  );
  console.log(
    "  designation, Medicare only when the row lists a Medicare billing number"
  );
  console.log(
    "- cost: sliding fee discount availability from the same designation"
  );
  console.log("");
  console.log("Usage:");
  console.log(
    "  node scripts/generateHrsaEnrichmentInput.mjs --input=path/to/official.csv \\"
  );
  console.log(
    "    --output=path/to/enrichment.json --checked-date=YYYY-MM-DD"
  );
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { cell += '"'; index += 1; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (inQuotes) throw new Error("The source CSV has an open quoted cell.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function cellText(value) {
  const text = String(value ?? "").trim();
  return text.toLowerCase() === "null" ? "" : text;
}

function buildFieldSource(field, checkedDate, reviewerNote) {
  return {
    field,
    status: "source_backed",
    sourceUrl: officialSourceUrl,
    sourceTitle,
    checkedDate,
    sourceType: "federal_open_data",
    locationSpecific: true,
    sourceLocationScope: "facility_location",
    reviewerNote
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.input) throw new Error("Missing --input=path/to/official.csv.");
  if (!args.output) throw new Error("Missing --output=path/to/enrichment.json.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.checkedDate)) {
    throw new Error("Missing or invalid --checked-date=YYYY-MM-DD.");
  }

  const facilities = JSON.parse(await readFile(args.facilities, "utf8"));
  if (!Array.isArray(facilities)) {
    throw new Error("The facilities file must contain an array.");
  }

  const parsed = parseCsv(await readFile(args.input, "utf8"));
  if (parsed.length < 2) throw new Error("The official source CSV has no data rows.");
  const headers = parsed[0].map((header) => header.trim());
  const columnIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  for (const required of [
    "BPHC Assigned Number",
    "Health Center Type",
    "FQHC Site Medicare Billing Number",
    "Site Status Description"
  ]) {
    if (columnIndex[required] === undefined) {
      throw new Error(`The source CSV is missing the "${required}" column.`);
    }
  }

  const rowsBySourceId = new Map();
  for (const row of parsed.slice(1)) {
    const sourceId = cellText(row[columnIndex["BPHC Assigned Number"]]);
    if (sourceId) rowsBySourceId.set(sourceId, row);
  }

  const enrichmentInputs = [];
  let unmatchedFacilities = 0;
  let inactiveRows = 0;
  let undesignatedRows = 0;
  let medicareBackedCount = 0;

  for (const facility of facilities) {
    const row = facility.sourceId ? rowsBySourceId.get(facility.sourceId) : undefined;
    if (!row) {
      unmatchedFacilities += 1;
      continue;
    }

    if (cellText(row[columnIndex["Site Status Description"]]) !== "Active") {
      inactiveRows += 1;
      continue;
    }

    const healthCenterType = cellText(row[columnIndex["Health Center Type"]]);
    const isLookAlike = /look-?alike/i.test(healthCenterType);
    const isHealthCenterProgramSite = /federally qualified health center/i.test(
      healthCenterType
    );
    if (!isHealthCenterProgramSite) {
      undesignatedRows += 1;
      continue;
    }

    const designationLabel = isLookAlike
      ? "Federally Qualified Health Center (FQHC) Look-Alike"
      : "Federally Qualified Health Center (FQHC)";
    const medicareBillingNumber = cellText(
      row[columnIndex["FQHC Site Medicare Billing Number"]]
    );

    const insuranceInfo = {
      acceptsMedicaid: true,
      acceptsUninsured: true,
      insuranceNotes:
        `HRSA lists this site as a ${designationLabel}. Health Center Program sites participate in Medicaid and serve patients regardless of insurance status.` +
        (medicareBillingNumber
          ? " The HRSA record includes an FQHC Medicare billing number for this site."
          : " The HRSA record does not list a Medicare billing number for this site, so Medicare acceptance stays unknown.") +
        " Confirm plan and network details with the site."
    };
    if (medicareBillingNumber) {
      insuranceInfo.acceptsMedicare = true;
      medicareBackedCount += 1;
    }

    const priceInfo = {
      priceLevel: facility.priceInfo?.priceLevel ?? "unknown",
      acceptsSlidingScale: true,
      priceNotes:
        `HRSA lists this site as a ${designationLabel}. Health Center Program sites offer a sliding fee discount schedule based on income and family size. Exact charges are set by the site and are not listed in the HRSA record.`
    };

    const insuranceReviewerNote =
      `Derived from the official HRSA CSV row for this site: Health Center Type "${healthCenterType}"` +
      (medicareBillingNumber
        ? " with an FQHC Site Medicare Billing Number present."
        : " (no Medicare billing number listed).");
    const costReviewerNote =
      `Derived from the official HRSA CSV row for this site: Health Center Program designation "${healthCenterType}" requires a sliding fee discount program.`;

    enrichmentInputs.push({
      id: facility.id,
      enrichment: { insuranceInfo, priceInfo },
      fieldSources: {
        insurance: buildFieldSource("insurance", args.checkedDate, insuranceReviewerNote),
        cost: buildFieldSource("cost", args.checkedDate, costReviewerNote)
      }
    });
  }

  await writeFile(args.output, `${JSON.stringify(enrichmentInputs, null, 2)}\n`);

  console.log(`Matched HRSA rows for ${enrichmentInputs.length} production facilities.`);
  console.log(`Medicare billing number present: ${medicareBackedCount}.`);
  console.log(`Facilities without a matching CSV row: ${unmatchedFacilities}.`);
  console.log(`Skipped inactive rows: ${inactiveRows}.`);
  console.log(`Skipped rows without a Health Center Program designation: ${undesignatedRows}.`);
  console.log(`Wrote ${path.relative(projectRoot, args.output)}.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
