import { useEffect, useRef } from "react";
import { latLngBounds } from "leaflet";
import { useMap } from "react-leaflet";
import { geographyLayerConfigs } from "../../geographyLayers";
import type { GeographyLevel } from "../../geographyLayers";
import type { GeographyData } from "../../hooks/useGeographyData";
import type {
  BoundarySearchTarget,
  SelectedGeography,
  SelectedTown
} from "../../types";
import { getGeographyFeatureColorKey } from "../../utils/geographyColors";
import { getFeatureName, getTownName } from "./boundaryNames";
import { getSelectedFeatureFallback } from "./boundaryStyle";
import { getFeatureBounds } from "./geometry";
import {
  getSearchTargetGeographyLevel,
  getSearchTargetKey,
  getSelectedGeographyFromFeature,
  isSearchTargetFeature
} from "./searchTargets";

type BoundarySearchControllerProps = {
  currentGeographyLevel: GeographyLevel;
  geographyData: GeographyData | null;
  loadedGeographyDataUrl: string | null;
  onActiveStateFipsChange: (stateFips: string | null) => void;
  onGeographyLevelChange: (level: GeographyLevel) => void;
  onGeographySelect: (geography: SelectedGeography) => void;
  onSelectedFeatureColorKeyChange: (colorKey: string | null) => void;
  onTownSelect: (town: SelectedTown | null) => void;
  selectedSearchTarget: BoundarySearchTarget | null;
};

export function BoundarySearchController({
  currentGeographyLevel,
  geographyData,
  loadedGeographyDataUrl,
  onActiveStateFipsChange,
  onGeographyLevelChange,
  onGeographySelect,
  onSelectedFeatureColorKeyChange,
  onTownSelect,
  selectedSearchTarget
}: BoundarySearchControllerProps) {
  const map = useMap();
  const lastFitTargetKeyRef = useRef<string | null>(null);
  const lastAppliedFeatureKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedSearchTarget) {
      return;
    }

    const targetKey = getSearchTargetKey(selectedSearchTarget);

    if (lastFitTargetKeyRef.current === targetKey) {
      return;
    }

    lastFitTargetKeyRef.current = targetKey;
    lastAppliedFeatureKeyRef.current = null;
    onActiveStateFipsChange(selectedSearchTarget.stateFips);
    onGeographyLevelChange(getSearchTargetGeographyLevel(selectedSearchTarget));
    onSelectedFeatureColorKeyChange(null);

    const [minLongitude, minLatitude, maxLongitude, maxLatitude] =
      selectedSearchTarget.bbox;
    const bounds = latLngBounds(
      [minLatitude, minLongitude],
      [maxLatitude, maxLongitude]
    );
    const [longitude, latitude] = selectedSearchTarget.center;
    const targetGeographyLevel = getSearchTargetGeographyLevel(selectedSearchTarget);
    const targetName =
      selectedSearchTarget.fullLegalName ?? selectedSearchTarget.displayName;

    map.invalidateSize();
    map.fitBounds(bounds, {
      maxZoom:
        selectedSearchTarget.level === "state"
          ? geographyLayerConfigs.states.maxZoom
          : selectedSearchTarget.level === "county"
            ? geographyLayerConfigs.counties.maxZoom
            : 12,
      padding: [42, 42]
    });
    if (selectedSearchTarget.level === "tract") {
      map.once("moveend", () => {
        if (map.getZoom() < geographyLayerConfigs.tracts.minZoom) {
          map.setZoom(geographyLayerConfigs.tracts.minZoom);
        }
      });
    }

    onGeographySelect({
      countyFips: selectedSearchTarget.countyFips,
      geoid: selectedSearchTarget.geoid,
      level: selectedSearchTarget.level === "tract" ? "tracts" : targetGeographyLevel,
      name: targetName,
      latitude,
      longitude,
      stateAbbr: selectedSearchTarget.stateAbbr,
      stateFips: selectedSearchTarget.stateFips
    });

    if (selectedSearchTarget.level === "local") {
      onTownSelect({
        name: targetName,
        latitude,
        longitude
      });
    } else {
      onTownSelect(null);
    }
  }, [
    map,
    onActiveStateFipsChange,
    onGeographyLevelChange,
    onGeographySelect,
    onSelectedFeatureColorKeyChange,
    onTownSelect,
    selectedSearchTarget
  ]);

  useEffect(() => {
    const targetGeographyLevel = selectedSearchTarget
      ? getSearchTargetGeographyLevel(selectedSearchTarget)
      : null;

    if (
      !selectedSearchTarget ||
      !targetGeographyLevel ||
      currentGeographyLevel !== targetGeographyLevel ||
      !geographyData ||
      loadedGeographyDataUrl !== selectedSearchTarget.sourceDataPath
    ) {
      return;
    }

    const targetKey = getSearchTargetKey(selectedSearchTarget);

    if (lastAppliedFeatureKeyRef.current === targetKey) {
      return;
    }

    const matchingFeature = geographyData.features.find((feature) =>
      isSearchTargetFeature(feature, selectedSearchTarget)
    );

    if (!matchingFeature) {
      return;
    }

    const featureBounds = getFeatureBounds(matchingFeature);
    const center = featureBounds
      ? latLngBounds(
          [featureBounds.minLatitude, featureBounds.minLongitude],
          [featureBounds.maxLatitude, featureBounds.maxLongitude]
        ).getCenter()
      : {
          lat: selectedSearchTarget.center[1],
          lng: selectedSearchTarget.center[0]
        };
    const featureName =
      selectedSearchTarget.level === "local"
        ? getTownName(matchingFeature)
        : getFeatureName(matchingFeature, getSelectedFeatureFallback(targetGeographyLevel));

    lastAppliedFeatureKeyRef.current = targetKey;
    onSelectedFeatureColorKeyChange(
      getGeographyFeatureColorKey(matchingFeature, targetGeographyLevel)
    );
    onGeographySelect(
      getSelectedGeographyFromFeature(
        matchingFeature,
        targetGeographyLevel,
        featureName,
        center.lat,
        center.lng
      )
    );

    if (selectedSearchTarget.level === "local") {
      onTownSelect({
        name: featureName,
        latitude: center.lat,
        longitude: center.lng
      });
    } else {
      onTownSelect(null);
    }
  }, [
    currentGeographyLevel,
    geographyData,
    loadedGeographyDataUrl,
    onGeographySelect,
    onSelectedFeatureColorKeyChange,
    onTownSelect,
    selectedSearchTarget
  ]);

  return null;
}
