import { useEffect, useMemo, useRef } from "react";
import type { LatLngBounds, Layer } from "leaflet";
import { svg } from "leaflet";
import { GeoJSON, useMap } from "react-leaflet";
import type { GeographyLevel } from "../../geographyLayers";
import type { useGeographyData } from "../../hooks/useGeographyData";
import type { SelectedGeography, SelectedTown } from "../../types";
import type { BoundaryHealthcareSummariesArtifact } from "../../utils/boundaryHealthcareSummary";
import {
  getGeographyBoundaryHoverStyle,
  getGeographyBoundaryStyle,
  getGeographyFeatureColorKey
} from "../../utils/geographyColors";
import { getStateFipsFromFeature } from "../../utils/stateFips";
import { getFeatureName, getTownName } from "./boundaryNames";
import {
  getDrillTargetZoom,
  getHealthcareAccessBoundaryHoverStyle,
  getHealthcareAccessBoundaryStyle,
  getHealthcareAccessSummaryForFeature,
  getRoadModeBoundaryStyle,
  getSelectedFeatureFallback,
  getSelectedGeographyLevelLabel,
  shouldDrillIntoFeature
} from "./boundaryStyle";
import type {
  BoundaryHealthcarePreview,
  BoundaryLayer,
  BoundaryLayerEntry,
  RoadMode
} from "./mapTypes";
import { getSelectedGeographyFromFeature } from "./searchTargets";

type GeographyBoundariesProps = {
  currentGeographyLevel: GeographyLevel;
  geographyData: NonNullable<ReturnType<typeof useGeographyData>["data"]>;
  healthcareAccessChoroplethEnabled: boolean;
  healthcareAccessSummaries: BoundaryHealthcareSummariesArtifact | null;
  isActive: boolean;
  loadedGeographyDataUrl: string | null;
  onActiveStateFipsChange: (stateFips: string | null) => void;
  onBoundaryHealthcarePreviewChange: (
    preview: BoundaryHealthcarePreview | null
  ) => void;
  onGeographySelect: (geography: SelectedGeography) => void;
  onSelectedFeatureColorKeyChange: (colorKey: string | null) => void;
  onTownSelect: (town: SelectedTown | null) => void;
  paneName: string;
  roadMode: RoadMode;
  selectedFeatureColorKey: string | null;
  drillOnSelect?: boolean;
};

export function GeographyBoundaries({
  currentGeographyLevel,
  geographyData,
  healthcareAccessChoroplethEnabled,
  healthcareAccessSummaries,
  isActive,
  loadedGeographyDataUrl,
  onActiveStateFipsChange,
  onBoundaryHealthcarePreviewChange,
  onGeographySelect,
  onSelectedFeatureColorKeyChange,
  paneName,
  roadMode,
  selectedFeatureColorKey,
  onTownSelect,
  drillOnSelect = true
}: GeographyBoundariesProps) {
  const map = useMap();
  const boundaryRenderer = useMemo(
    () => svg({ padding: 0.5, pane: paneName }),
    [paneName]
  );
  const boundaryLayersRef = useRef<BoundaryLayerEntry[]>([]);
  const healthcareAccessChoroplethEnabledRef = useRef(
    healthcareAccessChoroplethEnabled
  );
  const healthcareAccessSummariesRef = useRef(healthcareAccessSummaries);
  const roadModeRef = useRef(roadMode);
  const selectedFeatureColorKeyRef = useRef(selectedFeatureColorKey);
  const geoJsonLayerKey = `${currentGeographyLevel}-${
    loadedGeographyDataUrl ?? "pending"
  }`;
  const trackedGeoJsonLayerKeyRef = useRef<string | null>(null);

  if (trackedGeoJsonLayerKeyRef.current !== geoJsonLayerKey) {
    trackedGeoJsonLayerKeyRef.current = geoJsonLayerKey;
    boundaryLayersRef.current = [];
  }

  useEffect(() => {
    healthcareAccessChoroplethEnabledRef.current =
      healthcareAccessChoroplethEnabled;
    healthcareAccessSummariesRef.current = healthcareAccessSummaries;
    roadModeRef.current = roadMode;
    selectedFeatureColorKeyRef.current = selectedFeatureColorKey;

    boundaryLayersRef.current.forEach(({ feature, featureColorKey, layer }) => {
      const baseStyle = healthcareAccessChoroplethEnabled
        ? getHealthcareAccessBoundaryStyle(
            feature,
            currentGeographyLevel,
            selectedFeatureColorKey,
            healthcareAccessSummaries
          )
        : getGeographyBoundaryStyle(
            feature,
            currentGeographyLevel,
            selectedFeatureColorKey
          );

      layer.setStyle(
        getRoadModeBoundaryStyle(
          baseStyle,
          roadMode,
          featureColorKey === selectedFeatureColorKey,
          false
        )
      );

      if (featureColorKey === selectedFeatureColorKey) {
        layer.bringToFront();
      }
    });
  }, [
    currentGeographyLevel,
    healthcareAccessChoroplethEnabled,
    healthcareAccessSummaries,
    roadMode,
    selectedFeatureColorKey
  ]);

  useEffect(() => {
    if (!isActive) {
      boundaryLayersRef.current.forEach(({ layer }) => layer.closeTooltip());
    }
  }, [isActive]);

  function drillIntoBounds(bounds: LatLngBounds) {
    const targetZoom = getDrillTargetZoom(currentGeographyLevel);

    if (targetZoom === null) {
      map.fitBounds(bounds, {
        padding: [28, 28]
      });
      return;
    }

    map.fitBounds(bounds, {
      maxZoom: targetZoom,
      padding: [28, 28]
    });

    map.once("moveend", () => {
      if (map.getZoom() < targetZoom) {
        map.setZoom(targetZoom);
      }
    });
  }

  return (
    <GeoJSON
      data={geographyData}
      key={geoJsonLayerKey}
      pane={paneName}
      onEachFeature={(feature, layer: Layer) => {
        const boundaryLayer = layer as BoundaryLayer;
        const featureColorKey = getGeographyFeatureColorKey(
          feature,
          currentGeographyLevel
        );
        const featureName =
          currentGeographyLevel === "towns"
            ? getTownName(feature)
            : getFeatureName(
                feature,
                getSelectedFeatureFallback(currentGeographyLevel)
              );

        boundaryLayersRef.current.push({
          feature,
          featureColorKey,
          layer: boundaryLayer
        });
        boundaryLayer.bindTooltip(featureName, {
          direction: "top",
          opacity: 0.96,
          sticky: true
        });

        layer.on({
          click: () => {
            const bounds = boundaryLayer.getBounds();
            const center = bounds.getCenter();
            const stateFips = getStateFipsFromFeature(feature);

            onSelectedFeatureColorKeyChange(featureColorKey);
            onActiveStateFipsChange(stateFips);
            const selectedBaseStyle = healthcareAccessChoroplethEnabledRef.current
              ? getHealthcareAccessBoundaryStyle(
                  feature,
                  currentGeographyLevel,
                  featureColorKey,
                  healthcareAccessSummariesRef.current
                )
              : getGeographyBoundaryStyle(
                  feature,
                  currentGeographyLevel,
                  featureColorKey
                );

            boundaryLayer.setStyle(
              getRoadModeBoundaryStyle(
                selectedBaseStyle,
                roadModeRef.current,
                true,
                false
              )
            );
            boundaryLayer.bringToFront();

            onGeographySelect(
              getSelectedGeographyFromFeature(
                feature,
                currentGeographyLevel,
                featureName,
                center.lat,
                center.lng
              )
            );

            if (currentGeographyLevel === "towns") {
              onTownSelect({
                name: featureName,
                latitude: center.lat,
                longitude: center.lng
              });
            } else {
              onTownSelect(null);
            }

            if (
              drillOnSelect &&
              shouldDrillIntoFeature(feature, currentGeographyLevel)
            ) {
              drillIntoBounds(bounds);
            }
          },
          mouseout: () => {
            onBoundaryHealthcarePreviewChange(null);
            const baseStyle = healthcareAccessChoroplethEnabledRef.current
              ? getHealthcareAccessBoundaryStyle(
                  feature,
                  currentGeographyLevel,
                  selectedFeatureColorKeyRef.current,
                  healthcareAccessSummariesRef.current
                )
              : getGeographyBoundaryStyle(
                  feature,
                  currentGeographyLevel,
                  selectedFeatureColorKeyRef.current
                );

            boundaryLayer.setStyle(
              getRoadModeBoundaryStyle(
                baseStyle,
                roadModeRef.current,
                featureColorKey === selectedFeatureColorKeyRef.current,
                false
              )
            );
          },
          mouseover: () => {
            const summary = getHealthcareAccessSummaryForFeature(
              feature,
              currentGeographyLevel,
              healthcareAccessSummariesRef.current
            );

            onBoundaryHealthcarePreviewChange({
              boundaryName: featureName,
              coordinatesCount: summary?.facilitiesWithValidCoordinates ?? null,
              levelLabel: getSelectedGeographyLevelLabel(currentGeographyLevel),
              totalAssignedFacilities: summary?.totalAssignedFacilities ?? null
            });
            const hoverBaseStyle = healthcareAccessChoroplethEnabledRef.current
              ? getHealthcareAccessBoundaryHoverStyle(
                  feature,
                  currentGeographyLevel,
                  selectedFeatureColorKeyRef.current,
                  healthcareAccessSummariesRef.current
                )
              : getGeographyBoundaryHoverStyle(
                  feature,
                  currentGeographyLevel,
                  selectedFeatureColorKeyRef.current
                );

            boundaryLayer.setStyle(
              getRoadModeBoundaryStyle(
                hoverBaseStyle,
                roadModeRef.current,
                featureColorKey === selectedFeatureColorKeyRef.current,
                true
              )
            );
            boundaryLayer.bringToFront();
          }
        });
      }}
      style={(feature) =>
        feature
          ? {
              ...getRoadModeBoundaryStyle(
                healthcareAccessChoroplethEnabled
                  ? getHealthcareAccessBoundaryStyle(
                      feature,
                      currentGeographyLevel,
                      selectedFeatureColorKey,
                      healthcareAccessSummaries
                    )
                  : getGeographyBoundaryStyle(
                      feature,
                      currentGeographyLevel,
                      selectedFeatureColorKey
                    ),
                roadMode,
                getGeographyFeatureColorKey(feature, currentGeographyLevel) ===
                  selectedFeatureColorKey,
                false
              ),
              renderer: boundaryRenderer
            }
          : { renderer: boundaryRenderer }
      }
    />
  );
}
