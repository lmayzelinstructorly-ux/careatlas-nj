import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { LatLngBounds, Path } from "leaflet";

export type RoadMode = "off" | "clean" | "labeled";

export type HealthcareFacilityZoomRequest = {
  facilityId: string;
  requestId: number;
};

export type BoundaryHealthcarePreview = {
  boundaryName: string;
  coordinatesCount: number | null;
  levelLabel: string;
  totalAssignedFacilities: number | null;
};

export type BoundaryLayer = Path & {
  getBounds: () => LatLngBounds;
};

export type BoundaryLayerEntry = {
  feature: Feature<Geometry, GeoJsonProperties>;
  featureColorKey: string;
  layer: BoundaryLayer;
};
