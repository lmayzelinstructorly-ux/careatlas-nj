const exactProductionDataPaths = new Set([
  "data/geography/search/search-manifest.json",
  "data/geography/search/states.json",
  "data/geography-data-manifest.json",
  "data/doctor-offices/nj.json",
  "data/healthcare/boundary-healthcare-summaries.json",
  "data/healthcare/coverage-summary.json",
  "data/healthcare/by-state/34.json",
  "data/healthcare/facility-boundary-assignments.json",
  "data/healthcare-resources.json",
  "data/tracts/nj/coverage-summary.json",
  "data/tracts/nj/cdc-places-coverage-summary.json",
  "data/tracts/nj/cdc-svi-coverage-summary.json",
  "data/tracts/nj/census-acs-coverage-summary.json",
  "data/tracts/nj/hrsa-shortage-coverage-summary.json",
  "data/tracts/nj/batch-6-coverage-summary.json",
  "data/tracts/nj/access-gap-rule.v1.json",
  "data/tracts/nj/access-gap-rule-v1-summary.json",
  "data/tracts/nj/facility-tract-assignments.json",
  "data/tracts/nj/tract-foundation.json",
  "data/tracts/nj/town-foundation/summary.json",
  "data/tracts/nj/public-records/download-manifest.json",
  "data/tracts/nj/public-records/counties/new-jersey-counties.json",
  "data/tracts/nj/public-records/counties/new-jersey-counties.csv",
  "data/tracts/nj/public-records/reports/new-jersey-access-gap-report.md",
  "data/tracts/tract-evidence.v1.schema.json",
  "data/tracts/access-gap-classification.v1.schema.json",
  "data/us-states.geojson"
]);

const productionDataPathPatterns = [
  /^data\/counties\/by-state\/\d{2}\.geojson$/,
  /^data\/cousubs\/by-state\/\d{2}\.geojson$/,
  /^data\/geography\/search\/states\/\d{2}\.json$/,
  /^data\/tracts\/nj\/by-county\/\d{3}\.geojson$/,
  /^data\/tracts\/nj\/evidence\/cdc-places\/by-county\/\d{3}\.json$/,
  /^data\/tracts\/nj\/evidence\/(?:cdc-svi|census-acs|hrsa-shortage)\/by-county\/\d{3}\.json$/,
  /^data\/tracts\/nj\/classifications\/access-gap-rule-v1\/by-county\/\d{3}\.json$/,
  /^data\/tracts\/nj\/town-foundation\/by-county\/\d{3}\.json$/,
  /^data\/tracts\/nj\/public-records\/tracts\/by-county\/\d{3}\.(?:json|csv)$/
];

const forbiddenProductionDistPatterns = [
  {
    pattern: /(?:^|\/)hrsa-refresh-(?:audit|review-packet)(?:-|\/|\.|$)/i,
    reason: "HRSA refresh review artifacts"
  },
  { pattern: /^data\/healthcare\/imports(?:\/|$)/, reason: "healthcare imports" },
  {
    pattern: /^data\/healthcare\/staging(?:\/|$)/,
    reason: "healthcare staging data"
  },
  {
    pattern: /^data\/healthcare\/test-fixtures(?:\/|$)/,
    reason: "healthcare test fixtures"
  },
  {
    pattern: /^data\/doctor-offices\/staging(?:\/|$)/,
    reason: "doctor-office staging data"
  },
  {
    pattern: /^data\/(?:boundary-search-index|local-jurisdiction-search-index)\.json$/,
    reason: "unused monolithic search indexes"
  },
  { pattern: /(?:^|\/)source-reviews?(?:\.|\/|$)/i, reason: "source-review data" },
  { pattern: /promotion-report/i, reason: "promotion reports" },
  { pattern: /(?:^|\/)(?:readme)(?:\.|$)/i, reason: "internal data documentation" },
  {
    pattern: /(?:^|\/)[^/]*\.(?:csv|tsv)$/i,
    reason: "source or template tabular files"
  },
  {
    pattern: /(?:^|\/)[^/]*(?:demo|sample|fixture|template)[^/]*$/i,
    reason: "demo, sample, fixture, or template data"
  }
];

function normalizeDistPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isAllowedProductionDataPath(filePath) {
  const normalizedPath = normalizeDistPath(filePath);

  return (
    exactProductionDataPaths.has(normalizedPath) ||
    productionDataPathPatterns.some((pattern) => pattern.test(normalizedPath))
  );
}

function getForbiddenProductionDistReason(filePath) {
  const normalizedPath = normalizeDistPath(filePath);

  if (/^data\/tracts\/nj\/public-records\/.+\.csv$/i.test(normalizedPath)) {
    return undefined;
  }

  return forbiddenProductionDistPatterns.find(({ pattern }) =>
    pattern.test(normalizedPath)
  )?.reason;
}

export {
  exactProductionDataPaths,
  getForbiddenProductionDistReason,
  isAllowedProductionDataPath,
  normalizeDistPath
};
