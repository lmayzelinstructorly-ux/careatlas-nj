import type { Feature, GeoJsonProperties, Geometry } from "geojson";

export const stateFipsByPostalCode: Record<string, string> = {
  AL: "01",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56"
};

export const stateFipsCodes = Object.values(stateFipsByPostalCode);

export const stateNameByFips: Record<string, string> = {
  "01": "Alabama",
  "04": "Arizona",
  "05": "Arkansas",
  "06": "California",
  "08": "Colorado",
  "09": "Connecticut",
  "10": "Delaware",
  "11": "Washington, D.C.",
  "12": "Florida",
  "13": "Georgia",
  "16": "Idaho",
  "17": "Illinois",
  "18": "Indiana",
  "19": "Iowa",
  "20": "Kansas",
  "21": "Kentucky",
  "22": "Louisiana",
  "23": "Maine",
  "24": "Maryland",
  "25": "Massachusetts",
  "26": "Michigan",
  "27": "Minnesota",
  "28": "Mississippi",
  "29": "Missouri",
  "30": "Montana",
  "31": "Nebraska",
  "32": "Nevada",
  "33": "New Hampshire",
  "34": "New Jersey",
  "35": "New Mexico",
  "36": "New York",
  "37": "North Carolina",
  "38": "North Dakota",
  "39": "Ohio",
  "40": "Oklahoma",
  "41": "Oregon",
  "42": "Pennsylvania",
  "44": "Rhode Island",
  "45": "South Carolina",
  "46": "South Dakota",
  "47": "Tennessee",
  "48": "Texas",
  "49": "Utah",
  "50": "Vermont",
  "51": "Virginia",
  "53": "Washington",
  "54": "West Virginia",
  "55": "Wisconsin",
  "56": "Wyoming"
};

export function getStateName(stateFips: string | null) {
  return stateFips ? stateNameByFips[stateFips] ?? "selected state" : null;
}

export function getCountyDataUrl(stateFips: string | null) {
  return stateFips ? `/data/counties/by-state/${stateFips}.geojson` : null;
}

export function getCountySubdivisionDataUrl(stateFips: string | null) {
  return stateFips ? `/data/cousubs/by-state/${stateFips}.geojson` : null;
}

function getPropertyValue(properties: GeoJsonProperties, propertyNames: string[]) {
  if (!properties) {
    return null;
  }

  for (const propertyName of propertyNames) {
    const value = properties[propertyName];

    if (
      (typeof value === "string" && value.trim().length > 0) ||
      typeof value === "number"
    ) {
      return String(value).trim();
    }
  }

  return null;
}

export function getStateFipsFromFeature(
  feature: Feature<Geometry, GeoJsonProperties>
) {
  const directStateFips = getPropertyValue(feature.properties, [
    "STATEFP",
    "STATEFP20",
    "statefp"
  ]);

  if (directStateFips) {
    return directStateFips.padStart(2, "0");
  }

  const postalCode = getPropertyValue(feature.properties, [
    "STUSPS",
    "stusps",
    "postal"
  ]);

  if (postalCode) {
    return stateFipsByPostalCode[postalCode.toUpperCase()] ?? null;
  }

  const geoid = getPropertyValue(feature.properties, ["GEOID", "GEOID20", "GEOID10"]);

  return geoid && geoid.length >= 2 ? geoid.slice(0, 2) : null;
}
