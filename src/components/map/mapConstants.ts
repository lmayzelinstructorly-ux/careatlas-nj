import type { LatLngBoundsExpression, PathOptions } from "leaflet";
import type { RoadMode } from "./mapTypes";

type RoadLayerConfig = {
  attribution: string;
  opacity: number;
  url: string;
};

// Clean mode reduces label clutter. Labeled mode shows road names, though
// raster tile place labels can also appear because they are baked into tiles.
// Vector roads were removed for now because they were not reliable enough.
export const roadLayerConfigs: Record<RoadMode, RoadLayerConfig | null> = {
  off: null,
  clean: {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    opacity: 0.9,
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
  },
  labeled: {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    opacity: 0.78,
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  }
};

export const mainlandUsInitialZoom = 4;
export const mainlandUsMinZoom = 4;
export const customWheelZoomInStep = 0.85;
export const customWheelZoomOutStep = 1.1;
export const mainlandUsMaxBounds: LatLngBoundsExpression = [
  [22.75, -128.2],
  [51.2, -64.2]
];
export const newJerseyCenter: [number, number] = [40.15, -74.6];
export const newJerseyInitialZoom = 7;
export const newJerseyMinZoom = 7;
export const newJerseyMaxBounds: LatLngBoundsExpression = [
  [38.78, -75.72],
  [41.48, -73.78]
];
export const outsideFocusMaskBounds: Record<string, LatLngBoundsExpression> = {
  east: [
    [24.396308, -66.93457],
    [85, 180]
  ],
  north: [
    [49.384358, -180],
    [85, 180]
  ],
  south: [
    [-85, -180],
    [24.396308, 180]
  ],
  west: [
    [24.396308, -180],
    [49.384358, -125.0]
  ]
};

export const stateContextBoundaryStyle: PathOptions = {
  color: "#3C8992",
  fillColor: "#EAF8F8",
  fillOpacity: 0.18,
  opacity: 0.34,
  weight: 1.1
};
export const roadModeStateContextBoundaryStyle: PathOptions = {
  ...stateContextBoundaryStyle,
  fillOpacity: 0.08,
  opacity: 0.46,
  weight: 1.25
};
