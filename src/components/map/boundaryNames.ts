import type { Feature, GeoJsonProperties, Geometry } from "geojson";

export function getTownName(feature: Feature<Geometry, GeoJsonProperties>) {
  return getBoundaryLegalName(feature, "Unnamed town");
}

export function getSupportedPropertyText(
  properties: GeoJsonProperties,
  propertyName: string
) {
  const value = properties?.[propertyName];

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

export function isNumericOnlyName(value: string) {
  return /^\d+$/.test(value.trim());
}

export const numericNameLsadPrefixes: Record<string, string> = {
  "21": "Borough",
  "25": "City",
  "43": "Town",
  "44": "Township",
  "47": "Village"
};

const legalTypeByLsad: Record<string, string> = {
  "21": "Borough",
  "25": "City",
  "43": "Town",
  "44": "Township",
  "47": "Village"
};

const legalTypeCapitalization: Record<string, string> = {
  borough: "Borough",
  city: "City",
  county: "County",
  town: "Town",
  township: "Township",
  village: "Village"
};

function capitalizeLegalTypeSuffix(value: string) {
  return value.replace(
    /\s+(borough|city|county|town|township|village)$/i,
    (suffix) => ` ${legalTypeCapitalization[suffix.trim().toLowerCase()]}`
  );
}

export function getBoundaryLegalType(
  feature: Feature<Geometry, GeoJsonProperties>
) {
  const lsadCode = getSupportedPropertyText(feature.properties, "LSAD");

  return lsadCode ? legalTypeByLsad[lsadCode] ?? null : null;
}

export function getBoundaryLegalName(
  feature: Feature<Geometry, GeoJsonProperties>,
  fallback: string
) {
  const properties = feature.properties ?? {};
  const baseName = getSupportedPropertyText(properties, "NAME");
  const legalType = getBoundaryLegalType(feature);

  if (baseName && isNumericOnlyName(baseName)) {
    return getSupportedNumericLegalName(properties) ?? fallback;
  }

  if (baseName && legalType) {
    if (baseName.toLowerCase().endsWith(` ${legalType.toLowerCase()}`)) {
      return capitalizeLegalTypeSuffix(baseName);
    }
    return `${baseName} ${legalType}`;
  }

  const legalName = getSupportedPropertyText(properties, "NAMELSAD");

  if (legalName && !isNumericOnlyName(legalName)) {
    return capitalizeLegalTypeSuffix(legalName);
  }

  return baseName && !isNumericOnlyName(baseName) ? baseName : fallback;
}

export function getSupportedNumericLegalName(properties: GeoJsonProperties) {
  const numericName = getSupportedPropertyText(properties, "NAME");

  if (!numericName || !isNumericOnlyName(numericName)) {
    return null;
  }

  const lsadCode = getSupportedPropertyText(properties, "LSAD");
  const legalPrefix = lsadCode ? numericNameLsadPrefixes[lsadCode] : null;

  return legalPrefix ? `${legalPrefix} ${numericName}` : null;
}

export function getBestSupportedName(
  feature: Feature<Geometry, GeoJsonProperties>,
  propertyPriority: string[],
  fallback: string | null
) {
  const properties = feature.properties ?? {};
  const nameValue = getSupportedPropertyText(properties, "NAME");
  const namelsadValue = getSupportedPropertyText(properties, "NAMELSAD");

  if (nameValue && isNumericOnlyName(nameValue)) {
    return namelsadValue && !isNumericOnlyName(namelsadValue)
      ? namelsadValue
      : getSupportedNumericLegalName(properties) ?? fallback;
  }

  for (const propertyName of propertyPriority) {
    const value = getSupportedPropertyText(properties, propertyName);

    if (value && !isNumericOnlyName(value)) {
      return value;
    }
  }

  return fallback;
}

export function getFullBoundaryLabelText(feature: Feature<Geometry, GeoJsonProperties>) {
  const legalName = getBoundaryLegalName(feature, "");

  if (legalName) {
    return legalName;
  }

  return getBestSupportedName(
    feature,
    ["NAME20", "COUNTY", "MUNICIPALITY", "GEOID"],
    null
  );
}

export function getBoundaryLabelText(feature: Feature<Geometry, GeoJsonProperties>) {
  const fullText = getFullBoundaryLabelText(feature);

  if (!fullText) {
    return null;
  }

  return {
    fullText,
    text: fullText
  };
}

export function getFeatureName(
  feature: Feature<Geometry, GeoJsonProperties>,
  fallback: string
) {
  return (
    getBestSupportedName(
      feature,
      [
        "name",
        "NAME",
        "NAMELSAD",
        "town",
        "TOWN",
        "townName",
        "TOWN_NAME",
        "municipality",
        "MUNICIPALITY",
        "MUN_LABEL",
        "GEOID",
        "geoid",
        "GEOID20",
        "GEOID10"
      ],
      fallback
    ) ?? fallback
  );
}

export function hasPropertyValue(
  properties: GeoJsonProperties,
  propertyNames: string[],
  expectedValue: string
) {
  if (!properties) {
    return false;
  }

  return propertyNames.some((propertyName) => {
    const value = properties[propertyName];

    return (
      (typeof value === "string" || typeof value === "number") &&
      String(value).trim().toLowerCase() === expectedValue.toLowerCase()
    );
  });
}

export function isNewJerseyState(feature: Feature<Geometry, GeoJsonProperties>) {
  const properties = feature.properties;
  const featureName = getFeatureName(feature, "");

  return (
    featureName.toLowerCase() === "new jersey" ||
    hasPropertyValue(properties, ["STUSPS", "stusps", "postal", "STATE"], "NJ") ||
    hasPropertyValue(properties, ["STATEFP", "STATEFP20", "statefp"], "34")
  );
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getFeatureLabelKey(
  feature: Feature<Geometry, GeoJsonProperties>,
  label: string,
  index: number
) {
  if (typeof feature.id === "string" || typeof feature.id === "number") {
    return String(feature.id);
  }

  const geoid = feature.properties?.GEOID;

  if (typeof geoid === "string" || typeof geoid === "number") {
    return String(geoid);
  }

  return `${label}-${index}`;
}

export function getFeaturePropertyText(
  feature: Feature<Geometry, GeoJsonProperties>,
  propertyNames: string[]
) {
  for (const propertyName of propertyNames) {
    const value = feature.properties?.[propertyName];

    if (
      (typeof value === "string" && value.trim().length > 0) ||
      typeof value === "number"
    ) {
      return String(value).trim();
    }
  }

  return null;
}
