const geocoderBaseUrl =
  "https://geo.nj.gov/arcgis/rest/services/Tasks/NJ_Geocode/GeocodeServer";
const newJerseyBounds = Object.freeze({
  maxLatitude: 41.36,
  maxLongitude: -73.88,
  minLatitude: 38.92,
  minLongitude: -75.57
});

export class AddressLookupError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "AddressLookupError";
    this.status = status;
  }
}

function normalizeText(value, maximumLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, maximumLength);
}

function isNewJerseySuggestion(text) {
  return /,\s*(?:NJ|New Jersey)(?=\s*(?:,|\d{5}\b|$))/iu.test(text);
}

function isInNewJerseyBounds(latitude, longitude) {
  return (
    latitude >= newJerseyBounds.minLatitude &&
    latitude <= newJerseyBounds.maxLatitude &&
    longitude >= newJerseyBounds.minLongitude &&
    longitude <= newJerseyBounds.maxLongitude
  );
}

async function postForm(operation, parameters, fetchImplementation) {
  let response;

  try {
    response = await fetchImplementation(`${geocoderBaseUrl}/${operation}`, {
      body: new URLSearchParams(parameters),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      method: "POST",
      signal: AbortSignal.timeout(6000)
    });
  } catch {
    throw new AddressLookupError(
      "The New Jersey address service is temporarily unavailable."
    );
  }

  if (!response.ok) {
    throw new AddressLookupError(
      "The New Jersey address service did not complete the request."
    );
  }

  const payload = await response.json();
  if (payload?.error) {
    throw new AddressLookupError(
      "The New Jersey address service could not process the request."
    );
  }
  return payload;
}

export async function getNjAddressSuggestions(
  input,
  fetchImplementation = fetch
) {
  const query = normalizeText(input, 120);
  if (query.length < 2) {
    throw new AddressLookupError(
      "Type at least two characters to search for a New Jersey address.",
      400
    );
  }

  let payload = await postForm(
    "suggest",
    {
      f: "json",
      maxSuggestions: "12",
      text: query
    },
    fetchImplementation
  );
  // The suggest endpoint is strict about misspellings. Ask the same official
  // locator for possible corrections, then retrieve selectable suggestion keys.
  // Never invent an address or use a fuzzy candidate as the selected location.
  if (!(payload.suggestions ?? []).some(item => item.isCollection !== true && isNewJerseySuggestion(item.text ?? "")) && /\d/u.test(query)) {
    const candidates = await postForm("findAddressCandidates", {
      f: "json", SingleLine: query, maxLocations: "3",
      outFields: "Match_addr,Addr_type,Region", outSR: "4326"
    }, fetchImplementation);
    const corrections = [...new Set((candidates.candidates ?? [])
      .filter(item => item.score >= 75 && /^(PointAddress|Subaddress|StreetAddress)$/u.test(item.attributes?.Addr_type ?? ""))
      .map(item => normalizeText(item.attributes?.Match_addr ?? item.address, 180))
      .filter(isNewJerseySuggestion))].slice(0, 3);
    const corrected = await Promise.all(corrections.map(text => postForm("suggest", {
      f: "json", maxSuggestions: "6", text
    }, fetchImplementation)));
    payload = { suggestions: corrected.flatMap(result => result.suggestions ?? []) };
  }
  const seen = new Set();

  return (Array.isArray(payload?.suggestions) ? payload.suggestions : [])
    .flatMap((suggestion) => {
      const text = normalizeText(suggestion?.text, 180);
      const magicKey = normalizeText(suggestion?.magicKey, 700);
      if (
        !text ||
        !magicKey ||
        suggestion?.isCollection === true ||
        !isNewJerseySuggestion(text) ||
        seen.has(text.toLowerCase())
      ) {
        return [];
      }
      seen.add(text.toLowerCase());
      return [{ magicKey, text }];
    })
    .slice(0, 6);
}

export async function geocodeNjAddressSuggestion(
  input,
  fetchImplementation = fetch
) {
  const text = normalizeText(input?.text, 180);
  const magicKey = normalizeText(input?.magicKey, 700);
  if (!text || !magicKey || !isNewJerseySuggestion(text)) {
    throw new AddressLookupError(
      "Choose a New Jersey address from the suggestion list.",
      400
    );
  }

  const payload = await postForm(
    "findAddressCandidates",
    {
      SingleLine: text,
      f: "json",
      magicKey,
      maxLocations: "3",
      outFields: "Match_addr,Addr_type,City,Subregion,Region,Postal",
      outSR: "4326"
    },
    fetchImplementation
  );
  const candidate = (Array.isArray(payload?.candidates) ? payload.candidates : [])
    .map((entry) => ({
      address: normalizeText(entry?.attributes?.Match_addr ?? entry?.address, 180),
      addressType: normalizeText(entry?.attributes?.Addr_type, 40),
      county: normalizeText(entry?.attributes?.Subregion, 80),
      latitude: Number(entry?.location?.y),
      longitude: Number(entry?.location?.x),
      region: normalizeText(entry?.attributes?.Region, 40),
      score: Number(entry?.score)
    }))
    .find(
      (entry) =>
        entry.address &&
        Number.isFinite(entry.latitude) &&
        Number.isFinite(entry.longitude) &&
        Number.isFinite(entry.score) &&
        /^(?:NJ|New Jersey)$/iu.test(entry.region) &&
        /^(PointAddress|Subaddress|StreetAddress)$/u.test(entry.addressType) &&
        entry.score >= 85 &&
        isInNewJerseyBounds(entry.latitude, entry.longitude)
    );

  if (!candidate) {
    throw new AddressLookupError(
      "That suggestion could not be matched to a New Jersey address.",
      404
    );
  }

  const { region: _region, ...match } = candidate;
  return match;
}
