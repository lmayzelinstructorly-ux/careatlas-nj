import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectFieldSourceErrors,
  hasEnrichmentValue
} from "./lib/healthcareEnrichmentProvenance.mjs";
import {
  createDiscoveryReportItem,
  discoverOfficialSourcePages,
  summarizeDiscovery
} from "./lib/healthcareOfficialSourceDiscovery.mjs";
import {
  accessCategoryFields,
  dayKeys,
  facilitiesPath,
  projectRoot,
  readJson,
  sha256File,
  tmpDirectory,
  toProjectPath,
  writeJson
} from "./lib/healthcareAccessReporting.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worklistPath = path.join(tmpDirectory, "healthcare-enrichment-worklist.json");
const inputOutputPath = path.join(
  tmpDirectory,
  "healthcare-official-enrichment-input.json"
);
const reviewReportPath = path.join(
  tmpDirectory,
  "healthcare-official-enrichment-review-report.json"
);
const discoveryReportPath = path.join(
  tmpDirectory,
  "healthcare-official-source-discovery-report.json"
);
const cacheDirectory = path.join(
  tmpDirectory,
  "healthcare-official-enrichment-cache"
);
const summaryPath = path.join(
  tmpDirectory,
  "healthcare-official-enrichment-summary.json"
);
const planOutputPath = path.join(
  tmpDirectory,
  "healthcare-official-enrichment-plan.json"
);

const npmCliPath =
  process.env.npm_execpath ??
  path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js"
  );

const sourceTypes = new Set([
  "official_facility_page",
  "health_system_location_page",
  "federal_open_data",
  "state_open_data",
  "regulated_directory",
  "other_official"
]);

const bannedSourcePattern =
  /\b(google\s*(maps|places|reviews?)|maps\.google|google\.com\/maps|yelp|ratings?|reviews?|patient\s+comments?|tripadvisor|facebook|instagram|x\.com|twitter|nextdoor|zocdoc|healthgrades|vitals|webmd|sharecare|yellowpages|chamberofcommerce|mapquest|birdeye)\b/i;

const linkPattern =
  /\b(location|locations|hours|service|services|insurance|payment|pay|billing|sliding|discount|accessib|contact|patient|patients|clinic|center|appointment|visit|financial|charity|language|ada|tty)\b/i;

const serviceLabels = [
  {
    label: "primary care",
    pattern: /\b(primary care|family medicine|internal medicine|adult medicine)\b/i
  },
  { label: "dental", pattern: /\b(dental|dentistry|oral health)\b/i },
  {
    label: "behavioral health",
    pattern: /\b(behavioral health|mental health|counseling|psychiatry|substance use)\b/i
  },
  { label: "pediatrics", pattern: /\b(pediatric|pediatrics|children'?s health)\b/i },
  {
    label: "women's health",
    pattern: /\b(women'?s health|obstetrics|gynecology|ob\/gyn|prenatal)\b/i
  },
  { label: "pharmacy", pattern: /\b(pharmacy|pharmacist|prescriptions?)\b/i },
  { label: "urgent care", pattern: /\b(urgent care|walk-in care|same-day care)\b/i },
  {
    label: "vaccinations",
    pattern: /\b(vaccinations?|immunizations?|vaccines?)\b/i
  },
  { label: "lab services", pattern: /\b(lab services?|laboratory|blood work)\b/i }
];

const fieldValueKeys = {
  accessibility: ["accessibilityInfo"],
  cost: ["priceInfo"],
  hours: ["hours"],
  insurance: ["insuranceInfo"],
  services: ["services"]
};

const pendingFetches = new Map();

function parseArgs(argv) {
  const args = {
    dryRun: true,
    ids: null,
    limit: null,
    refreshCache: false,
    tier: "1"
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--refresh-cache") {
      args.refreshCache = true;
    } else if (arg.startsWith("--limit=")) {
      args.limit = Number.parseInt(arg.slice("--limit=".length), 10);
    } else if (arg.startsWith("--tier=")) {
      args.tier = arg.slice("--tier=".length).toLowerCase();
    } else if (arg.startsWith("--ids=")) {
      args.ids = arg
        .slice("--ids=".length)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }

  if (
    args.limit !== null &&
    (!Number.isInteger(args.limit) || args.limit < 1)
  ) {
    throw new Error("--limit must be a positive integer.");
  }

  if (!["1", "2", "3", "4", "all"].includes(args.tier)) {
    throw new Error("--tier must be one of 1, 2, 3, 4 or all.");
  }

  return args;
}

function printHelp() {
  console.log("Collect conservative official-source healthcare enrichment.");
  console.log("");
  console.log("Usage:");
  console.log("  npm run collect:healthcare-official-enrichment -- --limit=25");
  console.log("  node scripts/collectHealthcareOfficialSourceEnrichment.mjs --tier=3 --ids=id1,id2");
  console.log("");
  console.log("Default: dry run, Tier 1 only, cached fetches, reports only.");
  console.log("This script never mutates public/data/healthcare/facilities.json.");
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparable(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|and|of|at|in|llc|inc|corp|corporation|company|medical|center|centre|clinic|hospital|health|healthcare|system)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function tokenizeSignificant(value) {
  return normalizeComparable(value)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueItems(values) {
  return [...new Set(values.filter(hasText))];
}

function tryUrl(value) {
  if (!hasText(value)) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
}

function sameHostname(first, second) {
  const firstHost = first.hostname.replace(/^www\./, "");
  const secondHost = second.hostname.replace(/^www\./, "");
  return firstHost === secondHost || firstHost.endsWith(`.${secondHost}`);
}

function isBannedSourceUrl(url) {
  return bannedSourcePattern.test(url.href);
}

function cachePathForUrl(url) {
  const hash = createHash("sha256").update(url.href).digest("hex");
  return path.join(cacheDirectory, `${hash}.json`);
}

async function readCache(url) {
  const filePath = cachePathForUrl(url);
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeCache(url, payload) {
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(
    cachePathForUrl(url),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8"
  );
}

async function fetchFresh(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        "user-agent":
          "CareAtlas official-source enrichment collector (+https://github.com/methmoussa/careatlas-nj)"
      },
      redirect: "follow",
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    return {
      body: text,
      contentType,
      fetchedAt: new Date().toISOString(),
      finalUrl: response.url,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: url.href
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithCache(url, options) {
  const cacheKey = url.href;

  if (pendingFetches.has(cacheKey)) {
    return pendingFetches.get(cacheKey);
  }

  const promise = (async () => {
    if (!options.refreshCache) {
      const cached = await readCache(url);

      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    try {
      const fresh = await fetchFresh(url);
      await writeCache(url, fresh);
      return { ...fresh, fromCache: false };
    } catch (error) {
      const failed = {
        body: "",
        contentType: "",
        error: error.message,
        fetchedAt: new Date().toISOString(),
        finalUrl: url.href,
        ok: false,
        status: 0,
        statusText: "fetch_failed",
        url: url.href
      };
      await writeCache(url, failed);
      return { ...failed, fromCache: false };
    }
  })();

  pendingFetches.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    pendingFetches.delete(cacheKey);
  }
}

function stripHtml(html) {
  return normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|td|th|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? normalizeText(stripHtml(titleMatch[1])) : "";
}

function extractLinks(html, baseUrl) {
  const links = [];
  const linkMatches = html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);

  for (const match of linkMatches) {
    try {
      const url = new URL(match[1], baseUrl);
      const label = normalizeText(stripHtml(match[2]));

      if (
        ["http:", "https:"].includes(url.protocol) &&
        sameHostname(url, baseUrl) &&
        !isBannedSourceUrl(url) &&
        (linkPattern.test(url.pathname) || linkPattern.test(label))
      ) {
        links.push({
          label,
          url: url.href.split("#")[0]
        });
      }
    } catch {
      // Ignore malformed hrefs.
    }
  }

  return [...new Map(links.map((link) => [link.url, link])).values()].slice(0, 8);
}

function inferSourceType(sourceUrl, sourceKind, facility) {
  const host = sourceUrl.hostname.toLowerCase();
  const sourceName = facility.sourceInfo?.sourceName ?? "";

  if (/data\.cms\.gov|cms\.gov|hrsa\.gov|hhs\.gov|cdc\.gov|medicare\.gov|data\.hrsa\.gov/.test(host)) {
    return "federal_open_data";
  }

  if (/\.(gov|us)$/.test(host) && /\b(state|department|health|data)\b/i.test(sourceName)) {
    return "state_open_data";
  }

  if (/cms|hrsa|hhs|medicare/i.test(sourceName)) {
    return "federal_open_data";
  }

  if (sourceKind === "facility_website") {
    return sourceUrl.pathname === "/" || sourceUrl.pathname === ""
      ? "official_facility_page"
      : "health_system_location_page";
  }

  return sourceTypes.has(facility.sourceInfo?.sourceType)
    ? facility.sourceInfo.sourceType
    : "other_official";
}

function isOfficialSource(sourceUrl, sourceKind, facility) {
  if (isBannedSourceUrl(sourceUrl)) {
    return false;
  }

  const host = sourceUrl.hostname.toLowerCase();
  const sourceName = facility.sourceInfo?.sourceName ?? "";

  if (sourceKind === "facility_website") {
    return !/\b(directory|review|rating|maps?|search|yellow|facebook|instagram)\b/i.test(host);
  }

  return (
    /\.(gov|us)$/.test(host) ||
    /data\.cms\.gov|cms\.gov|hrsa\.gov|hhs\.gov|medicare\.gov|data\.hrsa\.gov/.test(host) ||
    /\b(CMS|HRSA|HHS|Medicare|official|department of health|open data)\b/i.test(sourceName)
  );
}

function getSourceUrls(facility) {
  const sources = [];
  const website = tryUrl(facility.website);
  const sourceUrl = tryUrl(facility.sourceInfo?.sourceUrl);

  if (website) {
    sources.push({ kind: "facility_website", url: website });
  }

  if (sourceUrl && !sources.some((source) => source.url.href === sourceUrl.href)) {
    sources.push({ kind: "source_info", url: sourceUrl });
  }

  return sources;
}

function sourceIdSignal(facility, pageText, pageUrl) {
  const sourceId = facility.sourceInfo?.sourceId;

  if (!hasText(sourceId)) {
    return false;
  }

  const comparable = `${pageText} ${pageUrl.href}`;
  return comparable.includes(sourceId);
}

function getLocationSignals(facility, pageText, pageUrl) {
  const signals = [];
  const comparableText = normalizeComparable(pageText);
  const comparableUrl = normalizeComparable(pageUrl.href);
  const nameTokens = tokenizeSignificant(facility.name);
  const matchedNameTokens = nameTokens.filter((token) =>
    comparableText.includes(token) || comparableUrl.includes(token)
  );

  if (
    normalizeComparable(facility.name).length > 0 &&
    (comparableText.includes(normalizeComparable(facility.name)) ||
      matchedNameTokens.length >= Math.min(3, Math.max(2, nameTokens.length)))
  ) {
    signals.push("facility name or close variant");
  }

  const address = normalizeComparable(facility.address);
  const addressTokens = tokenizeSignificant(facility.address);
  const streetNumber = String(facility.address ?? "").match(/\b\d{2,}\b/)?.[0];

  if (
    hasText(address) &&
    streetNumber &&
    comparableText.includes(streetNumber) &&
    addressTokens.some((token) => comparableText.includes(token))
  ) {
    signals.push("street address");
  }

  const city = normalizeComparable(facility.city);
  const state = normalizeComparable(facility.state);

  if (
    hasText(city) &&
    hasText(state) &&
    comparableText.includes(city) &&
    (comparableText.includes(` ${state} `) ||
      comparableUrl.includes(city) ||
      comparableUrl.includes(state))
  ) {
    signals.push("city/state");
  }

  const phone = normalizePhone(facility.phone);
  const pagePhone = normalizePhone(pageText);

  if (phone.length >= 10 && pagePhone.includes(phone.slice(-10))) {
    signals.push("phone number");
  }

  if (
    /\b(location|locations|clinic|hospital|facility|center)\b/i.test(pageUrl.pathname) &&
    (matchedNameTokens.length >= 1 || (hasText(city) && comparableUrl.includes(city)))
  ) {
    signals.push("site/location page URL");
  }

  if (sourceIdSignal(facility, pageText, pageUrl)) {
    signals.push("facility/sourceId or known health system location page");
  }

  return uniqueItems(signals);
}

function isLocationSpecific(facility, pageText, pageUrl) {
  const signals = getLocationSignals(facility, pageText, pageUrl);
  return {
    locationSpecific: signals.length >= 2,
    signals
  };
}

function getMissingFields(item) {
  return uniqueItems([
    ...(item.missingRawFields ?? []).map((field) => field.field),
    ...(item.rawValuePresentButFieldSourcesMissingOrInvalid ?? []).map((field) =>
      typeof field === "string" ? field : field.field
    )
  ]).filter((field) => accessCategoryFields.includes(field));
}

function emptyEnrichmentRecord(item) {
  return {
    enrichment: {},
    fieldSources: {},
    id: item.id,
    missingAccessCategories: item.missingAccessCategories ?? [],
    missingRawFields: (item.missingRawFields ?? []).map(({ field, rawField }) => ({
      field,
      rawField
    })),
    name: item.name,
    priorityTier: item.priorityTier,
    rawValuePresentButFieldSourcesMissingOrInvalid: (
      item.rawValuePresentButFieldSourcesMissingOrInvalid ?? []
    ).map((field) => (typeof field === "string" ? field : field.field))
  };
}

function sourceEvidence(pageText, pattern) {
  const match = pageText.match(pattern);

  if (!match) {
    return "";
  }

  const start = Math.max(0, match.index - 90);
  const end = Math.min(pageText.length, match.index + match[0].length + 140);
  return normalizeText(pageText.slice(start, end));
}

function extractServices(pageText) {
  const services = serviceLabels
    .filter((service) => service.pattern.test(pageText))
    .map((service) => service.label);

  if (services.length === 0) {
    return null;
  }

  return {
    evidence: sourceEvidence(pageText, serviceLabels.find((service) => service.pattern.test(pageText)).pattern),
    value: uniqueItems(services)
  };
}

function normalizeHourText(value) {
  return normalizeText(value)
    .replace(/\bnoon\b/gi, "12:00 PM")
    .replace(/\bmidnight\b/gi, "12:00 AM");
}

function expandDayRange(startDay, endDay) {
  const start = dayKeys.indexOf(startDay);
  const end = dayKeys.indexOf(endDay);

  if (start === -1 || end === -1 || start > end) {
    return [startDay];
  }

  return dayKeys.slice(start, end + 1);
}

function dayFromLabel(label) {
  const normalized = label.toLowerCase().slice(0, 3);
  return dayKeys.find((day) => day.startsWith(normalized)) ?? null;
}

function extractHours(pageText) {
  const hours = {};
  const evidence = [];
  const dayPattern =
    /\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:\s*(?:-|to|through| thru )\s*(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))?[:\s,-]{1,8}((?:closed|open 24 hours|24 hours|by appointment|[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm)?\s*(?:-|to|–)\s*[0-9]{1,2}(?::[0-9]{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm)))/gi;

  for (const match of pageText.matchAll(dayPattern)) {
    const startDay = dayFromLabel(match[1]);
    const endDay = match[2] ? dayFromLabel(match[2]) : startDay;
    const value = normalizeHourText(match[3]);

    if (!startDay || !hasText(value)) {
      continue;
    }

    for (const day of expandDayRange(startDay, endDay)) {
      hours[day] = value;
    }

    evidence.push(normalizeText(match[0]));
  }

  if (Object.keys(hours).length === 0) {
    return null;
  }

  return {
    evidence: evidence.slice(0, 3).join(" | "),
    value: {
      notes: "",
      ...Object.fromEntries(dayKeys.map((day) => [day, hours[day] ?? ""]))
    }
  };
}

function extractInsurance(pageText) {
  const value = {};
  const notes = [];

  if (/\b(accepts?|takes?|participates? in|covered by)\s+(?:most\s+)?(?:insurance[^.]{0,80})?medicaid\b/i.test(pageText)) {
    value.acceptsMedicaid = true;
    notes.push("Medicaid acceptance listed.");
  }

  if (/\b(accepts?|takes?|participates? in|covered by)\s+(?:most\s+)?(?:insurance[^.]{0,80})?medicare\b/i.test(pageText)) {
    value.acceptsMedicare = true;
    notes.push("Medicare acceptance listed.");
  }

  if (/\b(uninsured|no insurance|without insurance|self-pay)\b/i.test(pageText)) {
    value.acceptsUninsured = true;
    notes.push("Uninsured or self-pay support listed.");
  }

  const payerEvidence = sourceEvidence(
    pageText,
    /\b(insurance|medicaid|medicare|uninsured|self-pay|sliding fee|financial assistance)\b/i
  );

  if (
    Object.keys(value).length === 0 &&
    /\b(insurance plans?|payers?|accepted insurance)\b/i.test(pageText)
  ) {
    value.insuranceNotes = payerEvidence;
  } else if (notes.length > 0) {
    value.insuranceNotes = notes.join(" ");
  }

  if (Object.keys(value).length === 0) {
    return null;
  }

  return {
    evidence: payerEvidence,
    value
  };
}

function extractCost(pageText) {
  const value = {};
  let evidencePattern = null;

  if (/\b(sliding fee|sliding scale|sliding-fee|discount program|fee discount|discounted fee)\b/i.test(pageText)) {
    value.acceptsSlidingScale = true;
    value.priceLevel = "low_cost";
    value.priceNotes = "Official source lists a sliding fee, sliding scale or discount program.";
    evidencePattern = /\b(sliding fee|sliding scale|sliding-fee|discount program|fee discount|discounted fee)\b/i;
  } else if (/\b(free clinic|free care|services are free|provided free)\b/i.test(pageText)) {
    value.priceLevel = "free";
    value.priceNotes = "Official source lists free care or services.";
    evidencePattern = /\b(free clinic|free care|services are free|provided free)\b/i;
  } else if (/\b(standard charges|chargemaster|price transparency)\b/i.test(pageText)) {
    value.priceLevel = "standard";
    value.priceNotes = "Official source lists standard charges or price transparency information.";
    evidencePattern = /\b(standard charges|chargemaster|price transparency)\b/i;
  }

  if (Object.keys(value).length === 0) {
    return null;
  }

  return {
    evidence: sourceEvidence(pageText, evidencePattern),
    value
  };
}

function extractAccessibility(pageText) {
  const pattern =
    /\b(wheelchair accessible|ADA accessible|accessible entrance|accessible parking|TTY|TDD|language assistance|interpreter services|disability accommodations?|auxiliary aids)\b/i;
  const evidence = sourceEvidence(pageText, pattern);

  if (!hasText(evidence)) {
    return null;
  }

  return {
    evidence,
    value: evidence.length > 220 ? `${evidence.slice(0, 217)}...` : evidence
  };
}

function extractField(field, pageText) {
  if (field === "services") {
    return extractServices(pageText);
  }

  if (field === "hours") {
    return extractHours(pageText);
  }

  if (field === "insurance") {
    return extractInsurance(pageText);
  }

  if (field === "cost") {
    return extractCost(pageText);
  }

  if (field === "accessibility") {
    return extractAccessibility(pageText);
  }

  return null;
}

function setEnrichmentValue(record, field, value) {
  if (field === "insurance") {
    record.enrichment.insuranceInfo = value;
  } else if (field === "cost") {
    record.enrichment.priceInfo = value;
  } else if (field === "accessibility") {
    record.enrichment.accessibilityInfo = value;
  } else {
    record.enrichment[field] = value;
  }
}

function buildSource(field, source, page, sourceType, evidence, match) {
  const sourceUrl = page.finalUrl || source.url.href;
  const sourceTitle = hasText(page.title)
    ? page.title
    : source.kind === "facility_website"
      ? "Official facility website"
      : "Official source";

  return {
    checkedDate: new Date().toISOString().slice(0, 10),
    field,
    locationSpecific: true,
    reviewerNote: `Matched ${match.signals.join(", ")}. Evidence: ${evidence}`,
    sourceLocationScope: "facility_location",
    sourceTitle,
    sourceType,
    sourceUrl,
    status: "source_backed"
  };
}

function sourceTypeFromCandidate(candidate, facility) {
  const sourceUrl = tryUrl(candidate.finalUrl || candidate.url);
  const websiteCandidateKinds = new Set([
    "facility_website",
    "generated_slug",
    "homepage_provider_link",
    "same_domain_link",
    "sitemap"
  ]);

  if (!sourceUrl) {
    return "other_official";
  }

  if (websiteCandidateKinds.has(candidate.candidateKind)) {
    return sourceUrl.pathname === "/" || sourceUrl.pathname === ""
      ? "official_facility_page"
      : "health_system_location_page";
  }

  return inferSourceType(
    sourceUrl,
    "source_info",
    facility
  );
}

function sourceFromCandidate(candidate) {
  const websiteCandidateKinds = new Set([
    "facility_website",
    "generated_slug",
    "homepage_provider_link",
    "same_domain_link",
    "sitemap"
  ]);

  return {
    kind: websiteCandidateKinds.has(candidate.candidateKind)
      ? "facility_website"
      : "source_info",
    url: new URL(candidate.finalUrl || candidate.url)
  };
}

function validateProposedSource(field, source) {
  return collectFieldSourceErrors(field, source, {
    requireSourceBacked: true
  });
}

function reviewItem(facility, sourceUrl, field, reason, evidence, suggestedManualAction) {
  return {
    evidenceSummary: evidence || "",
    facilityId: facility.id,
    facilityName: facility.name,
    fieldAttempted: field,
    reasonBlocked: reason,
    sourceUrl,
    suggestedManualAction
  };
}

function selectedItems(worklist, args) {
  let items = Array.isArray(worklist.items) ? worklist.items : [];

  if (args.ids) {
    const requestedIds = new Set(args.ids);
    items = items.filter((item) => requestedIds.has(item.id));
  } else if (args.tier !== "all") {
    items = items.filter((item) => item.priorityTier === `Tier ${args.tier}`);
  }

  if (args.limit !== null) {
    items = items.slice(0, args.limit);
  }

  return items;
}

async function inspectPage(source, url, args) {
  const fetched = await fetchWithCache(url, args);
  const body = fetched.body ?? "";

  return {
    ...fetched,
    links: fetched.ok ? extractLinks(body, new URL(fetched.finalUrl || url.href)) : [],
    text: stripHtml(body),
    title: extractTitle(body)
  };
}

async function collectForFacility(item, args) {
  const facility = item;
  const missingFields = getMissingFields(item);
  const proposed = emptyEnrichmentRecord(item);
  const reviewItems = [];
  const discovery = await discoverOfficialSourcePages(facility, args, {
    cacheDirectory,
    maxCandidates: 18
  });
  const inspectedSources = discovery.candidatePagesInspected.map(
    (candidate) => candidate.finalUrl || candidate.url
  );
  const locationPages = discovery.selectedLocationSpecificPages;

  if (discovery.candidatePagesInspected.length === 0) {
    for (const field of missingFields) {
      reviewItems.push(
        reviewItem(
          facility,
          "",
          field,
          "network/fetch failed",
          "No facility website or official source URL is available in the worklist item.",
          "Add a source-backed official facility or provider page before enrichment."
        )
      );
    }

    return {
      discovery,
      proposed: null,
      reviewItems,
      inspectedSources
    };
  }

  for (const page of locationPages) {
    const pageUrl = new URL(page.finalUrl || page.url);
    const source = sourceFromCandidate(page);
    const sourceType = sourceTypeFromCandidate(page, facility);
    const match = {
      locationSpecific: true,
      signals: page.locationMatchSignals
    };

    for (const field of missingFields) {
      if (proposed.fieldSources[field]) {
        continue;
      }

      const extracted = extractField(field, page.text);

      if (!extracted) {
        continue;
      }

      const fieldSource = buildSource(
        field,
        source,
        page,
        sourceType,
        extracted.evidence,
        match
      );
      const sourceErrors = validateProposedSource(field, fieldSource);

      if (sourceErrors.length > 0) {
        reviewItems.push(
          reviewItem(
            facility,
            pageUrl.href,
            field,
            "blocked/banned source",
            sourceErrors.join(" "),
            "Fix source provenance before including this enrichment field."
          )
        );
        continue;
      }

      setEnrichmentValue(proposed, field, extracted.value);
      proposed.fieldSources[field] = fieldSource;
    }
  }

  for (const field of missingFields) {
    if (proposed.fieldSources[field]) {
      continue;
    }

    const blockedCandidate =
      locationPages[0] ??
      discovery.candidatePagesInspected.find(
        (candidate) => candidate.classification === "dataset_wide_source"
      ) ??
      discovery.candidatePagesInspected.find(
        (candidate) => candidate.classification === "banned_or_unusable"
      ) ??
      discovery.candidatePagesInspected.find(
        (candidate) => candidate.classification === "fetch_failed"
      ) ??
      discovery.candidatePagesInspected[0];
    const sourceUrl = blockedCandidate?.finalUrl || blockedCandidate?.url || "";
    const reason =
      locationPages.length > 0
        ? field === "hours"
          ? "no daily hours found"
          : field === "services"
            ? "services unclear"
            : field === "insurance"
              ? "insurance unclear"
              : field === "accessibility"
                ? "accessibility not stated"
                : "cost unclear"
        : blockedCandidate?.rejectedReason ||
          (blockedCandidate?.classification === "fetch_failed"
            ? "network/fetch failed"
            : "source did not match location");
    const evidence =
      locationPages.length > 0
        ? `Matched location signals: ${locationPages[0].locationMatchSignals.join(", ")}.`
        : `Candidate classification: ${blockedCandidate?.classification ?? "none"}. Location signals found: ${(blockedCandidate?.locationMatchSignals ?? []).join(", ") || "none"}.`;

    reviewItems.push(
      reviewItem(
        facility,
        sourceUrl,
        field,
        reason,
        evidence,
        locationPages.length > 0
          ? `Review the official location page manually for source-backed ${field}.`
          : "Find a page that matches at least two facility/location identifiers before applying this field."
      )
    );
  }

  const enrichedFields = accessCategoryFields.filter((field) => {
    const facilityLike = {};
    const enrichment = proposed.enrichment;

    for (const key of fieldValueKeys[field] ?? []) {
      if (Object.prototype.hasOwnProperty.call(enrichment, key)) {
        facilityLike[key] = enrichment[key];
      }
    }

    return hasEnrichmentValue(facilityLike, field);
  });

  return {
    discovery,
    proposed: enrichedFields.length > 0 ? proposed : null,
    reviewItems,
    inspectedSources
  };
}

async function mapWithConcurrency(items, limit, callback) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

function countFields(inputs) {
  const counts = Object.fromEntries(accessCategoryFields.map((field) => [field, 0]));

  for (const input of inputs) {
    for (const field of Object.keys(input.fieldSources ?? {})) {
      if (Object.prototype.hasOwnProperty.call(counts, field)) {
        counts[field] += 1;
      }
    }
  }

  return counts;
}

function countSourceAvailability(items, results, args) {
  return {
    processedTier: args.tier,
    countWithFacilityWebsite: items.filter((item) => hasText(item.website)).length,
    countWithUsableOfficialWebsite: results.filter(
      (result) => result.discovery.hasUsableOfficialWebsite
    ).length,
    countWithOnlyCmsHrsaDatasetSource: results.filter(
      (result) =>
        result.discovery.sourceInfoDatasetWide &&
        !result.discovery.hasUsableOfficialWebsite &&
        result.discovery.selectedLocationSpecificPages.length === 0
    ).length,
    countWithNoUsableFacilityPage: results.filter(
      (result) => result.discovery.selectedLocationSpecificPages.length === 0
    ).length,
    countWithLocationSpecificPageFound: results.filter(
      (result) => result.discovery.selectedLocationSpecificPages.length > 0
    ).length,
    countWithLocationSpecificPageNotFound: results.filter(
      (result) => result.discovery.selectedLocationSpecificPages.length === 0
    ).length
  };
}

async function assertFileNonEmpty(filePath) {
  const info = await stat(filePath);
  if (info.size <= 0) {
    throw new Error(`${toProjectPath(filePath)} should not be empty.`);
  }
}

function runPlan() {
  const result = spawnSync(
    process.execPath,
    [
      npmCliPath,
      "run",
      "plan:healthcare-enrichment",
      "--",
      `--input=${toProjectPath(inputOutputPath)}`,
      `--output=${toProjectPath(planOutputPath)}`
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: "pipe"
    }
  );

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error("Generated enrichment input could not be read by the plan script.");
  }

  return result.stdout;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const beforeProductionHash = await sha256File(facilitiesPath);
  const worklist = await readJson(worklistPath);
  const items = selectedItems(worklist, args);
  const results = await mapWithConcurrency(items, 3, (item) =>
    collectForFacility(item, args)
  );
  const enrichmentInput = results
    .map((result) => result.proposed)
    .filter((record) => record !== null);
  const reviewItems = results.flatMap((result) => result.reviewItems);
  const fieldGainCounts = countFields(enrichmentInput);
  const discoveryItems = results.map((result, index) =>
    createDiscoveryReportItem(items[index], result.discovery)
  );
  const discoverySummary = summarizeDiscovery(discoveryItems);
  const sourceAvailability = countSourceAvailability(items, results, args);

  await writeJson(inputOutputPath, enrichmentInput);

  const planOutput = runPlan();
  const discoveryReport = {
    generatedAt: new Date().toISOString(),
    inputWorklist: toProjectPath(worklistPath),
    processedRecordCount: items.length,
    summary: discoverySummary,
    items: discoveryItems,
    note:
      "Discovery classifies official candidate pages before extraction. Dataset-wide source metadata is recorded but not used as field evidence unless the page strongly matches the individual facility."
  };
  const reviewReport = {
    generatedAt: new Date().toISOString(),
    inputWorklist: toProjectPath(worklistPath),
    processedRecordCount: items.length,
    blockedItemCount: reviewItems.length,
    recordsWithProposedEnrichment: enrichmentInput.length,
    items: reviewItems,
    note:
      "Ambiguous, organization-wide, banned, failed or non-location-specific evidence is blocked here instead of added to enrichment input."
  };
  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    inputWorklist: toProjectPath(worklistPath),
    selectedTier: args.tier,
    selectedIds: args.ids ?? [],
    limit: args.limit,
    processedRecordCount: items.length,
    recordsWithProposedEnrichment: enrichmentInput.length,
    blockedReviewItemCount: reviewItems.length,
    outputPaths: {
      cacheDirectory: toProjectPath(cacheDirectory),
      discoveryReport: toProjectPath(discoveryReportPath),
      enrichmentInput: toProjectPath(inputOutputPath),
      plan: toProjectPath(planOutputPath),
      reviewReport: toProjectPath(reviewReportPath),
      summary: toProjectPath(summaryPath)
    },
    sourceAvailability,
    recordsGainingFields: fieldGainCounts,
    note:
      "No production healthcare data was mutated. Proposed enrichment remains dry-run input for plan/apply review."
  };

  await writeJson(discoveryReportPath, discoveryReport);
  await writeJson(reviewReportPath, reviewReport);
  await writeJson(summaryPath, summary);
  await assertFileNonEmpty(inputOutputPath);
  await assertFileNonEmpty(discoveryReportPath);
  await assertFileNonEmpty(reviewReportPath);
  await assertFileNonEmpty(summaryPath);

  const afterProductionHash = await sha256File(facilitiesPath);

  if (afterProductionHash !== beforeProductionHash) {
    throw new Error("public/data/healthcare/facilities.json was mutated.");
  }

  console.log("Healthcare official-source enrichment collection complete.");
  console.log("Default mode is dry run. No production data was written.");
  console.log(`Processed records: ${items.length}`);
  console.log(`Records with proposed enrichment: ${enrichmentInput.length}`);
  console.log(`Blocked review items: ${reviewItems.length}`);
  console.log("Records gaining fields:");
  for (const field of accessCategoryFields) {
    console.log(`- ${field}: ${fieldGainCounts[field]}`);
  }
  console.log(`Input: ${toProjectPath(inputOutputPath)}`);
  console.log(`Discovery report: ${toProjectPath(discoveryReportPath)}`);
  console.log(`Review report: ${toProjectPath(reviewReportPath)}`);
  console.log(`Summary: ${toProjectPath(summaryPath)}`);
  console.log(`Plan: ${toProjectPath(planOutputPath)}`);

  if (planOutput.trim()) {
    console.log("");
    console.log(planOutput.trim());
  }
}

main().catch((error) => {
  console.error("Healthcare official-source enrichment collection failed.");
  console.error(error.message);
  process.exit(1);
});
