import type { GeographyLevel } from "./geographyLayers";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";

export type MapMode = "healthcare" | "doctor_offices" | "gaps";

export type SelectedGeography = {
  countyFips?: string | null;
  feature?: Feature<Geometry, GeoJsonProperties> | null;
  geoid?: string | null;
  level: GeographyLevel;
  name: string;
  latitude: number;
  longitude: number;
  stateAbbr?: string | null;
  stateFips?: string | null;
};

export type SelectedTown = {
  name: string;
  latitude: number;
  longitude: number;
};

export type BoundarySearchLevel = "state" | "county" | "local" | "tract";

export type BoundarySearchTarget = {
  bbox: [number, number, number, number];
  center: [number, number];
  countyFips: string | null;
  countyName: string | null;
  displayName: string;
  fullLegalName: string | null;
  geoid: string | null;
  id: string;
  level: BoundarySearchLevel;
  normalizedName: string;
  sourceDataPath: string;
  stateAbbr: string | null;
  stateFips: string;
  stateName: string | null;
};

export type LocalJurisdictionSearchTarget = BoundarySearchTarget;
