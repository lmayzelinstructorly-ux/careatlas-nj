import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const bannedSourcePattern =
  /\b(google\s*(maps|places|reviews?)|maps\.google|google\.com\/maps|yelp|ratings?|reviews?|patient\s+comments?|tripadvisor|facebook|instagram|x\.com|twitter|nextdoor|zocdoc|healthgrades|vitals|webmd|sharecare|yellowpages|chamberofcommerce|mapquest|birdeye)\b/i;

const discoveryLinkPattern =
  /\b(location|locations|clinic|clinics|center|centers|health center|find care|care sites|services?|contact|hours|patient info|appointment|visit|financial|billing|insurance|accessib|ada|tty)\b/i;

const sitemapPriorityPattern =
  /\b(location|locations|clinic|clinics|center|centers|health-centers?|care-locations?|find-a-location|find-care|contact|hours|services?)\b/i;

const datasetWidePattern =
  /\b(data\.cms\.gov|provider-data\/dataset|cms\.gov\/provider-data|data\.hrsa\.gov|hrsa\.gov\/data|hhs\.gov\/data|catalog\.data\.gov|healthdata\.gov|download|downloads?|dataset|datasets?|csv|bulk|open[-\s]?data|data portal)\b/i;

const pendingFetches = new Map();

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeComparable(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|and|of|at|in|llc|inc|corp|corporation|company|medical|center|centre|clinic|hospital|health|healthcare|system)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function sameHostname(first, second) {
  const firstHost = normalizeHostname(first.hostname);
  const secondHost = normalizeHostname(second.hostname);
  return firstHost === secondHost || firstHost.endsWith(`.${secondHost}`);
}

function isBannedSourceUrl(url) {
  return bannedSourcePattern.test(url.href);
}

function cachePathForUrl(cacheDirectory, url) {
  const hash = createHash("sha256").update(url.href).digest("hex");
  return path.join(cacheDirectory, `${hash}.json`);
}

async function readCache(cacheDirectory, url) {
  try {
    return JSON.parse(await readFile(cachePathForUrl(cacheDirectory, url), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeCache(cacheDirectory, url, payload) {
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(
    cachePathForUrl(cacheDirectory, url),
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
        accept: "text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.5",
        "user-agent":
          "CareAtlas official-source enrichment collector (+https://github.com/lmayzelinstructorly-ux/careatlas)"
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

export async function fetchWithCache(url, options) {
  const cacheDirectory = options.cacheDirectory;
  const cacheKey = url.href;

  if (pendingFetches.has(cacheKey)) {
    return pendingFetches.get(cacheKey);
  }

  const promise = (async () => {
    if (!options.refreshCache) {
      const cached = await readCache(cacheDirectory, url);

      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    try {
      const fresh = await fetchFresh(url);
      await writeCache(cacheDirectory, url, fresh);
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
      await writeCache(cacheDirectory, url, failed);
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

export function stripHtml(html) {
  return normalizeText(
    String(html ?? "")
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
  const titleMatch = String(html ?? "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? normalizeText(stripHtml(titleMatch[1])) : "";
}

function tokenizeSignificant(value) {
  return normalizeComparable(value)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function sourceIdSignal(facility, pageText, pageUrl) {
  const sourceId = facility.sourceInfo?.sourceId;

  if (!hasText(sourceId)) {
    return false;
  }

  return `${pageText} ${pageUrl.href}`.toLowerCase().includes(String(sourceId).toLowerCase());
}

export function getLocationSignals(facility, pageText, pageUrl) {
  const signals = [];
  const comparableText = normalizeComparable(pageText);
  const comparableUrl = normalizeComparable(pageUrl.href);
  const nameTokens = tokenizeSignificant(facility.name);
  const matchedNameTokens = nameTokens.filter((token) =>
    comparableText.includes(token) || comparableUrl.includes(token)
  );
  const normalizedName = normalizeComparable(facility.name);

  if (
    normalizedName.length > 0 &&
    (comparableText.includes(normalizedName) ||
      matchedNameTokens.length >= Math.min(3, Math.max(2, nameTokens.length)))
  ) {
    signals.push("facility name or close variant");
  }

  const addressTokens = tokenizeSignificant(facility.address);
  const streetNumber = String(facility.address ?? "").match(/\b\d+\b/)?.[0];

  if (
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
    /\b(location|locations|clinic|hospital|facility|center|care)\b/i.test(pageUrl.pathname) &&
    (matchedNameTokens.length >= 1 || (hasText(city) && comparableUrl.includes(city)))
  ) {
    signals.push("site/location page URL");
  }

  if (sourceIdSignal(facility, pageText, pageUrl)) {
    signals.push("facility/sourceId or known health system location page");
  }

  return uniqueItems(signals);
}

function facilityNameLooksLikeAddress(facility) {
  return /^\s*\d+\b/.test(String(facility.name ?? ""));
}

function pageIdentityMatchesAddressNamedFacility(facility, pageUrl, title) {
  if (!facilityNameLooksLikeAddress(facility)) {
    return true;
  }

  const identityText = normalizeComparable(`${pageUrl.pathname} ${title}`);
  const addressTokens = tokenizeSignificant(facility.name).filter(
    (token) =>
      !/^(street|st|road|rd|avenue|ave|drive|dr|lane|ln|square|suite|main|old|county)$/.test(
        token
      )
  );

  return addressTokens.some((token) => identityText.includes(token));
}

function hasStrongLocationEvidence(signals, facility, pageUrl, title) {
  const addressNamedFacilityNeedsAddressSignal =
    facilityNameLooksLikeAddress(facility) && !signals.includes("street address");

  if (addressNamedFacilityNeedsAddressSignal) {
    return false;
  }

  if (!pageIdentityMatchesAddressNamedFacility(facility, pageUrl, title)) {
    return false;
  }

  return (
    (signals.includes("street address") &&
      (signals.includes("facility name or close variant") ||
        signals.includes("city/state") ||
        signals.includes("phone number") ||
        signals.includes("site/location page URL"))) ||
    (signals.includes("phone number") &&
      signals.includes("facility name or close variant") &&
      (signals.includes("city/state") ||
        signals.includes("site/location page URL") ||
        signals.includes("street address"))) ||
    (signals.includes("facility name or close variant") &&
      signals.includes("city/state") &&
      signals.includes("site/location page URL")) ||
    (signals.includes("facility/sourceId or known health system location page") &&
      signals.includes("facility name or close variant") &&
      (signals.includes("street address") || signals.includes("city/state")))
  );
}

function isSourceIndexPage(pageUrl, title) {
  const normalizedPath = pageUrl.pathname.toLowerCase().replace(/\/+$/, "");
  const segments = normalizedPath.split("/").filter(Boolean);
  const normalizedTitle = normalizeComparable(title);

  return (
    /\b(sitemap|search|directory|find-a-location|location-search|location-type)\b/i.test(
      normalizedPath
    ) ||
    normalizedPath === "/locations" ||
    normalizedPath === "/location" ||
    normalizedPath.endsWith("/our-locations") ||
    (/^locations?\b/.test(normalizedTitle) && segments.length <= 2)
  );
}

function isBulkDatasetSource(candidate, fetched) {
  const sourceText = `${candidate.url.href} ${fetched.finalUrl ?? ""} ${fetched.contentType ?? ""}`;

  return /\b(DataDownload|bulk|download|downloads?)\b/i.test(sourceText) ||
    /\.csv(?:$|[?#])/i.test(sourceText) ||
    /\b(text\/csv|application\/csv|application\/octet-stream)\b/i.test(sourceText);
}

function classifySourceCandidate(candidate, fetched, facility) {
  if (candidate.banned || isBannedSourceUrl(candidate.url)) {
    return {
      classification: "banned_or_unusable",
      locationMatchSignals: [],
      rejectedReason: "banned or non-official source"
    };
  }

  if (!fetched.ok) {
    return {
      classification: "fetch_failed",
      locationMatchSignals: [],
      rejectedReason: fetched.error || `${fetched.status} ${fetched.statusText}`
    };
  }

  const pageUrl = new URL(fetched.finalUrl || candidate.url.href);
  const text = stripHtml(fetched.body);
  const title = extractTitle(fetched.body);
  const signals = getLocationSignals(facility, text, pageUrl);
  const sourceText = [
    candidate.url.href,
    fetched.finalUrl,
    fetched.contentType,
    candidate.kind === "source_info" ? facility.sourceInfo?.sourceName : "",
    candidate.kind === "source_info" ? facility.sourceInfo?.sourceDataset : "",
    candidate.kind === "source_info" ? facility.sourceInfo?.notes : ""
  ]
    .filter(Boolean)
    .join(" ");
  const datasetWide = datasetWidePattern.test(sourceText);
  const strongLocationEvidence = hasStrongLocationEvidence(
    signals,
    facility,
    pageUrl,
    title
  );

  if (datasetWide && (isBulkDatasetSource(candidate, fetched) || !strongLocationEvidence)) {
    return {
      classification: "dataset_wide_source",
      locationMatchSignals: signals,
      rejectedReason: "dataset-wide source, not location-specific evidence"
    };
  }

  if (
    candidate.kind === "sitemap" ||
    isSourceIndexPage(pageUrl, title)
  ) {
    return {
      classification: "source_index_page",
      locationMatchSignals: signals,
      rejectedReason:
        signals.length > 0
          ? "source index page did not strongly match this location"
          : "source index page, not location-specific evidence"
    };
  }

  if (strongLocationEvidence) {
    return {
      classification: "facility_location_page",
      locationMatchSignals: signals,
      rejectedReason: ""
    };
  }

  return {
    classification: "organization_page",
    locationMatchSignals: signals,
    rejectedReason:
      signals.length > 0
        ? "organization-wide page did not strongly match this location"
        : "source did not match location"
  };
}

function extractLinks(html, baseUrl, includeAllSameDomain = false) {
  const links = [];
  const linkMatches = String(html ?? "").matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  );

  for (const match of linkMatches) {
    try {
      const url = new URL(match[1], baseUrl);
      const label = normalizeText(stripHtml(match[2]));

      if (!["http:", "https:"].includes(url.protocol) || isBannedSourceUrl(url)) {
        continue;
      }

      if (
        sameHostname(url, baseUrl) &&
        (includeAllSameDomain ||
          discoveryLinkPattern.test(url.pathname) ||
          discoveryLinkPattern.test(label))
      ) {
        links.push({
          label,
          score: scoreLink(url, label),
          url: url.href.split("#")[0]
        });
      }
    } catch {
      // Ignore malformed hrefs.
    }
  }

  return [...new Map(links.map((link) => [link.url, link])).values()].sort(
    (a, b) => b.score - a.score
  );
}

function scoreLink(url, label = "") {
  const text = `${url.pathname} ${label}`.toLowerCase();
  let score = 0;

  for (const term of [
    "location",
    "locations",
    "clinic",
    "clinics",
    "center",
    "centers",
    "health center",
    "find care",
    "care sites",
    "services",
    "contact",
    "hours",
    "patient info"
  ]) {
    if (text.includes(term)) {
      score += 3;
    }
  }

  if (/\b(about|news|blog|careers|privacy|terms|donate)\b/i.test(text)) {
    score -= 2;
  }

  return score;
}

function slugify(value) {
  return normalizeComparable(value)
    .replace(/\b(campus|main|location|site)\b/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generatedLocationUrls(baseUrl, facility) {
  const nameSlug = slugify(facility.name);
  const citySlug = slugify(facility.city);

  if (!nameSlug) {
    return [];
  }

  const paths = [
    `/locations/${nameSlug}`,
    `/location/${nameSlug}`,
    citySlug ? `/locations/${citySlug}/${nameSlug}` : "",
    `/find-a-location/${nameSlug}`,
    `/care-locations/${nameSlug}`,
    `/clinics/${nameSlug}`,
    `/health-centers/${nameSlug}`
  ].filter(Boolean);

  return paths.map((urlPath) => new URL(urlPath, baseUrl).href);
}

function extractSitemapUrls(xml) {
  return [...String(xml ?? "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => normalizeText(match[1]))
    .filter(hasText);
}

function scoreSitemapUrl(url, facility) {
  const comparableUrl = normalizeComparable(url.href);
  const facilityTokens = [
    ...tokenizeSignificant(facility.name),
    ...tokenizeSignificant(facility.city),
    String(facility.address ?? "").match(/\b\d{2,}\b/)?.[0] ?? ""
  ].filter(Boolean);
  let score = sitemapPriorityPattern.test(url.pathname) ? 4 : 0;

  for (const token of facilityTokens) {
    if (comparableUrl.includes(token)) {
      score += 4;
    }
  }

  return score;
}

function addCandidate(candidates, candidate) {
  const key = candidate.url.href.split("#")[0].replace(/\/$/, "");

  if (!candidates.has(key)) {
    candidates.set(key, {
      ...candidate,
      url: new URL(key)
    });
  }
}

async function inspectCandidate(candidate, facility, options) {
  const fetched = await fetchWithCache(candidate.url, options);
  const text = stripHtml(fetched.body);
  const finalUrl = new URL(fetched.finalUrl || candidate.url.href);
  const classification = classifySourceCandidate(candidate, fetched, facility);

  return {
    ...fetched,
    candidateKind: candidate.kind,
    candidateLabel: candidate.label ?? "",
    candidateReason: candidate.reason ?? "",
    classification: classification.classification,
    locationMatchSignals: classification.locationMatchSignals,
    rejectedReason: classification.rejectedReason,
    text,
    title: extractTitle(fetched.body),
    url: candidate.url.href,
    finalUrl: finalUrl.href
  };
}

async function discoverSitemapCandidates(baseUrl, facility, options) {
  const sitemapCandidates = [];
  const sitemapUrls = [new URL("/sitemap.xml", baseUrl)];

  for (const sitemapUrl of sitemapUrls) {
    const fetched = await fetchWithCache(sitemapUrl, options);

    if (!fetched.ok) {
      continue;
    }

    const locs = extractSitemapUrls(fetched.body);
    const nestedSitemaps = locs
      .map((url) => tryUrl(url))
      .filter((url) => url && sameHostname(url, baseUrl) && /sitemap/i.test(url.href))
      .slice(0, 4);

    for (const nested of nestedSitemaps) {
      const nestedFetched = await fetchWithCache(nested, options);

      if (nestedFetched.ok) {
        locs.push(...extractSitemapUrls(nestedFetched.body));
      }
    }

    for (const loc of locs) {
      const url = tryUrl(loc);

      if (!url || !sameHostname(url, baseUrl) || isBannedSourceUrl(url)) {
        continue;
      }

      const score = scoreSitemapUrl(url, facility);

      if (score > 0) {
        sitemapCandidates.push({
          kind: "sitemap",
          label: "Sitemap URL",
          reason: "prioritized sitemap URL",
          score,
          url
        });
      }
    }
  }

  return sitemapCandidates.sort((a, b) => b.score - a.score);
}

export async function discoverOfficialSourcePages(facility, args, options) {
  const cacheDirectory = options.cacheDirectory;
  const maxCandidates = options.maxCandidates ?? 16;
  const fetchOptions = {
    cacheDirectory,
    refreshCache: args.refreshCache
  };
  const candidates = new Map();
  const websiteUrl = tryUrl(facility.website);
  const sourceInfoUrl = tryUrl(facility.sourceInfo?.sourceUrl);
  let homepage = null;

  if (websiteUrl && ["http:", "https:"].includes(websiteUrl.protocol)) {
    addCandidate(candidates, {
      kind: "facility_website",
      label: "Facility website",
      reason: "facility.website",
      score: 100,
      url: websiteUrl
    });

    homepage = await fetchWithCache(websiteUrl, fetchOptions);

    if (homepage.ok && !isBannedSourceUrl(websiteUrl)) {
      const baseUrl = new URL(homepage.finalUrl || websiteUrl.href);

      for (const link of extractLinks(homepage.body, baseUrl).slice(0, 8)) {
        addCandidate(candidates, {
          kind: "same_domain_link",
          label: link.label,
          reason: "same-domain homepage link",
          score: 90 + link.score,
          url: new URL(link.url)
        });
      }

      for (const candidate of await discoverSitemapCandidates(baseUrl, facility, fetchOptions)) {
        addCandidate(candidates, {
          ...candidate,
          score: 70 + candidate.score
        });
      }

      for (const href of generatedLocationUrls(baseUrl, facility)) {
        addCandidate(candidates, {
          kind: "generated_slug",
          label: "Generated location URL",
          reason: "likely location slug",
          score: 60,
          url: new URL(href)
        });
      }

      for (const link of extractLinks(homepage.body, baseUrl, true).slice(0, 16)) {
        addCandidate(candidates, {
          kind: "homepage_provider_link",
          label: link.label,
          reason: "official provider/health-system page linked from homepage",
          score: 50 + link.score,
          url: new URL(link.url)
        });
      }
    }
  }

  if (sourceInfoUrl && ["http:", "https:"].includes(sourceInfoUrl.protocol)) {
    addCandidate(candidates, {
      kind: "source_info",
      label: facility.sourceInfo?.sourceName ?? "Source metadata URL",
      reason: "sourceInfo.sourceUrl",
      score: datasetWidePattern.test(sourceInfoUrl.href) ? 10 : 40,
      url: sourceInfoUrl
    });
  }

  const orderedCandidates = [...candidates.values()]
    .filter((candidate) => ["http:", "https:"].includes(candidate.url.protocol))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates);
  const inspectedCandidates = [];

  for (const candidate of orderedCandidates) {
    inspectedCandidates.push(await inspectCandidate(candidate, facility, fetchOptions));
  }

  const selectedLocationPages = [
    ...new Map(
      inspectedCandidates
        .filter((candidate) => candidate.classification === "facility_location_page")
        .map((candidate) => [candidate.finalUrl || candidate.url, candidate])
    ).values()
  ];

  return {
    candidatePagesInspected: inspectedCandidates,
    extractionAttempted: selectedLocationPages.length > 0,
    hasLocationSpecificPage: selectedLocationPages.length > 0,
    hasUsableOfficialWebsite: inspectedCandidates.some(
      (candidate) =>
        candidate.candidateKind === "facility_website" &&
        !["banned_or_unusable", "fetch_failed", "dataset_wide_source"].includes(
          candidate.classification
        )
    ),
    selectedLocationSpecificPages: selectedLocationPages,
    sourceInfoDatasetWide: inspectedCandidates.some(
      (candidate) =>
        candidate.candidateKind === "source_info" &&
        candidate.classification === "dataset_wide_source"
    ),
    websitePresent: Boolean(websiteUrl)
  };
}

export function summarizeDiscovery(items) {
  const hostCounts = {};

  for (const item of items) {
    for (const candidate of item.candidatePagesInspected) {
      try {
        const host = normalizeHostname(new URL(candidate.finalUrl || candidate.url).hostname);
        hostCounts[host] = (hostCounts[host] ?? 0) + 1;
      } catch {
        // Ignore malformed report URLs.
      }
    }
  }

  return {
    facilitiesWithNoWebsite: items.filter((item) => !item.website).length,
    facilitiesWithOnlyDatasetWideSource: items.filter(
      (item) =>
        item.candidatePagesInspected.length > 0 &&
        item.candidatePagesInspected.every(
          (candidate) => candidate.classification === "dataset_wide_source"
        )
    ).length,
    facilitiesWhereLocationPageFound: items.filter(
      (item) => item.selectedLocationSpecificPages.length > 0
    ).length,
    facilitiesWhereNoLocationPageFound: items.filter(
      (item) => item.selectedLocationSpecificPages.length === 0
    ).length,
    facilitiesBlockedBecauseOfficialSourceDidNotMatchLocation: items.filter(
      (item) =>
        item.selectedLocationSpecificPages.length === 0 &&
        item.candidatePagesInspected.some((candidate) =>
          ["organization_page", "source_index_page"].includes(candidate.classification)
        )
    ).length,
    topSourceHosts: Object.entries(hostCounts)
      .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
      .slice(0, 12)
      .map(([host, count]) => ({ count, host }))
  };
}

export function createDiscoveryReportItem(facility, discovery) {
  return {
    id: facility.id,
    name: facility.name,
    sourceInfoSourceUrl: facility.sourceInfo?.sourceUrl ?? null,
    website: facility.website ?? null,
    candidatePagesInspected: discovery.candidatePagesInspected.map((candidate) => ({
      candidateKind: candidate.candidateKind,
      candidateLabel: candidate.candidateLabel,
      candidateReason: candidate.candidateReason,
      classification: candidate.classification,
      contentType: candidate.contentType,
      finalUrl: candidate.finalUrl,
      fromCache: candidate.fromCache,
      locationMatchSignals: candidate.locationMatchSignals,
      rejectedReason: candidate.rejectedReason,
      status: candidate.status,
      statusText: candidate.statusText,
      title: candidate.title,
      url: candidate.url
    })),
    extractionAttempted: discovery.extractionAttempted,
    rejectedCandidates: discovery.candidatePagesInspected
      .filter((candidate) => candidate.classification !== "facility_location_page")
      .map((candidate) => ({
        classification: candidate.classification,
        reason: candidate.rejectedReason,
        url: candidate.finalUrl || candidate.url
      })),
    selectedLocationSpecificPages: discovery.selectedLocationSpecificPages.map(
      (candidate) => ({
        locationMatchSignals: candidate.locationMatchSignals,
        title: candidate.title,
        url: candidate.finalUrl || candidate.url
      })
    )
  };
}
