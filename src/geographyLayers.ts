export type GeographyLevel = "states" | "counties" | "towns" | "tracts";

export type GeographyLayerConfig = {
  label: string;
  boundaryLabel: string;
  minZoom: number;
  maxZoom: number;
  dataUrl: string | null;
};

export const geographyLayerConfigs: Record<GeographyLevel, GeographyLayerConfig> = {
  states: {
    label: "States",
    boundaryLabel: "State legal boundary layer",
    minZoom: Number.NEGATIVE_INFINITY,
    maxZoom: 6.25,
    dataUrl: "/data/us-states.geojson"
  },
  counties: {
    label: "Counties",
    boundaryLabel: "County administrative boundary layer",
    minZoom: 6.5,
    maxZoom: 9.25,
    dataUrl: null
  },
  towns: {
    label: "Towns and townships",
    boundaryLabel: "Town and township administrative boundary layer",
    minZoom: 9.5,
    maxZoom: Number.POSITIVE_INFINITY,
    dataUrl: null
  },
  tracts: {
    label: "Census tracts",
    boundaryLabel: "Census tract statistical boundary layer",
    minZoom: 9,
    maxZoom: Number.POSITIVE_INFINITY,
    dataUrl: null
  }
};

export const requiredBoundaryFiles = Object.values(geographyLayerConfigs)
  .map((config) => config.dataUrl)
  .filter((dataUrl): dataUrl is string => Boolean(dataUrl));

export function getPublicDataPath(url: string) {
  return url.startsWith("/data/") ? `public${url}` : url;
}

export function getGeographyLevelForZoom(zoom: number): GeographyLevel {
  if (zoom <= geographyLayerConfigs.states.maxZoom) {
    return "states";
  }

  if (zoom <= geographyLayerConfigs.counties.maxZoom) {
    return "counties";
  }

  return "towns";
}
