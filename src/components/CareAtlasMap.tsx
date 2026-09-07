import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, Pane } from "react-leaflet";
import type { GeographyLevel } from "../geographyLayers";
import {
  useGeographyData,
  type GeographyData
} from "../hooks/useGeographyData";
import { useHealthcareFacilities } from "../hooks/useHealthcareFacilities";
import { useTownGapContext } from "../hooks/useTownGapContext";
import { useTractClassificationShard } from "../hooks/useTractClassificationShard";
import type { MapMode, SelectedGeography } from "../types";
import {
  clipGeographyToBoundary,
  clipGeographyToCountyBoundaries
} from "../utils/clipGeography";
import { getGeographyFeatureColorKey } from "../utils/geographyColors";
import { HealthcareFacilityKey } from "./HealthcareFacilityKey";
import HealthcareFacilityMarkers from "./HealthcareFacilityMarkers";
import { DoctorOfficeMode } from "./DoctorOfficeMode";
import {
  AddressTractFinder,
  type AddressLocationMatch,
  type AddressResolutionState
} from "./map/AddressTractFinder";
import {
  AddressTractLocation,
  type AddressTractNavigationRequest
} from "./map/AddressTractLocation";
import {
  BoundaryAutocomplete,
  type BoundaryAutocompleteCandidate
} from "./map/BoundaryAutocomplete";
import {
  BoundaryAutocompleteController,
  type BoundaryAutocompleteRequest
} from "./map/BoundaryAutocompleteController";
import {
  BoundaryLayerVisibilityController,
  countyPaneName,
  townPaneName
} from "./map/BoundaryLayerVisibilityController";
import { BoundaryLabels } from "./map/BoundaryLabels";
import { CountyOutlineLayer } from "./map/CountyOutlineLayer";
import { CountyTractOutlineLayer } from "./map/CountyTractOutlineLayer";
import {
  getBoundaryLegalName,
  getBoundaryLegalType,
  getFeaturePropertyText
} from "./map/boundaryNames";
import { GeographyBoundaries } from "./map/GeographyBoundaries";
import { GapSidebar } from "./map/GapSidebar";
import { MapSizeObserver } from "./map/MapSizeObserver";
import { InitialMapFitter } from "./map/InitialMapFitter";
import { SelectedAreaCard } from "./map/SelectedAreaCard";
import { SelectedBoundaryLabel } from "./map/SelectedBoundaryLabel";
import { TractClassificationLayer } from "./map/TractClassificationLayer";
import { TractContextBoundaryLayer } from "./map/TractContextBoundaryLayer";
import { TractMapKey } from "./map/TractMapKey";
import { TractModeController } from "./map/TractModeController";
import { TownTractOutlineLayer } from "./map/TownTractOutlineLayer";
import { ZoomLevelWatcher } from "./map/ZoomLevelWatcher";
import { getFeatureBounds, isPointInFeature } from "./map/geometry";
import {
  getMapPermalinkTarget,
  parseMapPermalink,
  replaceMapPermalink
} from "./map/mapPermalink";
import { getSelectedGeographyFromFeature } from "./map/searchTargets";
import {
  newJerseyCenter,
  newJerseyInitialZoom,
  newJerseyMaxBounds,
  newJerseyMinZoom
} from "./map/mapConstants";

const newJerseyCountyDataUrl = "/data/counties/by-state/34.geojson";
const newJerseyTownDataUrl = "/data/cousubs/by-state/34.geojson";
const keepNewJerseyActive = () => undefined;
const ignoreBoundaryPreview = () => undefined;
const ignoreTownSelection = () => undefined;
function getFeatureByGeoid(data: GeographyData | null, geoid: string) {
  return data?.features.find(
    (feature) =>
      getFeaturePropertyText(feature, ["GEOID", "GEOID20", "GEOID10"]) ===
      geoid
  );
}
function getSelectedFeature(
  feature: NonNullable<ReturnType<typeof getFeatureByGeoid>>,
  level: GeographyLevel,
  name: string
) {
  const bounds = getFeatureBounds(feature);
  if (!bounds) return null;

  return getSelectedGeographyFromFeature(
    feature,
    level,
    name,
    (bounds.minLatitude + bounds.maxLatitude) / 2,
    (bounds.minLongitude + bounds.maxLongitude) / 2
  );
}

function getBoundaryCandidate(
  feature: NonNullable<ReturnType<typeof getFeatureByGeoid>>,
  level: Extract<GeographyLevel, "counties" | "towns">
): BoundaryAutocompleteCandidate {
  const displayName = getBoundaryLegalName(
    feature,
    level === "counties" ? "Selected county" : "Selected municipality"
  );

  return {
    displayName,
    feature,
    key: getGeographyFeatureColorKey(feature, level),
    level,
    normalizedName: displayName.toLowerCase(),
    typeLabel: level === "counties" ? "County" : getBoundaryLegalType(feature) ?? "Municipality"
  };
}

type CareAtlasMapProps = { mapMode: MapMode };

function CareAtlasMap({ mapMode }: CareAtlasMapProps) {
  const addressRequestIdRef = useRef(0);
  const [initialPermalink] = useState(() =>
    parseMapPermalink(window.location.search)
  );
  const [permalinkHydrated, setPermalinkHydrated] = useState(
    initialPermalink === null
  );
  const [currentGeographyLevel, setCurrentGeographyLevel] =
    useState<GeographyLevel>("counties");
  const [selectedFeatureColorKey, setSelectedFeatureColorKey] =
    useState<string | null>(null);
  const [selectedGeography, setSelectedGeography] =
    useState<SelectedGeography | null>(null);
  const [activeTractCounty, setActiveTractCounty] =
    useState<SelectedGeography | null>(null);
  const [activeTractTown, setActiveTractTown] =
    useState<SelectedGeography | null>(null);
  const [autocompleteRequest, setAutocompleteRequest] =
    useState<BoundaryAutocompleteRequest | null>(null);
  const [isAutocompleteNavigating, setIsAutocompleteNavigating] =
    useState(false);
  const [facilityPanelOpen, setFacilityPanelOpen] = useState(false);
  const [mapResetVersion, setMapResetVersion] = useState(0);
  const [pendingTownTractGeoid, setPendingTownTractGeoid] =
    useState<string | null>(null);
  const [pendingAddressMatch, setPendingAddressMatch] =
    useState<AddressLocationMatch | null>(null);
  const [addressResolution, setAddressResolution] =
    useState<AddressResolutionState>({ message: null, status: "idle" });
  const [addressNavigationRequest, setAddressNavigationRequest] =
    useState<AddressTractNavigationRequest | null>(null);
  const counties = useGeographyData("counties", newJerseyCountyDataUrl);
  const towns = useGeographyData("towns", newJerseyTownDataUrl);
  const displayTowns = useMemo(
    () =>
      towns.data && counties.data
        ? clipGeographyToCountyBoundaries(towns.data, counties.data)
        : null,
    [counties.data, towns.data]
  );
  const healthcare = useHealthcareFacilities(mapMode !== "doctor_offices", "new-jersey");
  const newJerseyFacilities = useMemo(
    () => healthcare.facilities.filter((facility) =>
      facility.stateFips === "34" || facility.state.toUpperCase() === "NJ"
    ),
    [healthcare.facilities]
  );
  const showingTowns = currentGeographyLevel === "towns";
  const tractMode = mapMode === "gaps" && currentGeographyLevel === "tracts";
  const tractShard = useTractClassificationShard(
    activeTractCounty?.countyFips ?? null,
    tractMode
  );
  const townTractContext = useTownGapContext(
    activeTractTown?.countyFips ?? null,
    activeTractTown?.geoid ?? null
  );
  const clippedCountyTracts = useMemo(() => {
    if (!tractShard.geography || !activeTractCounty?.feature) return null;

    return clipGeographyToBoundary(
      tractShard.geography,
      activeTractCounty.feature,
      { excludeWaterOnly: true }
    );
  }, [activeTractCounty?.feature, tractShard.geography]);
  const clippedTownTracts = useMemo(() => {
    if (!clippedCountyTracts || !activeTractTown?.feature) return null;

    return clipGeographyToBoundary(
      clippedCountyTracts,
      activeTractTown.feature
    );
  }, [activeTractTown?.feature, clippedCountyTracts]);
  const tractGeography = useMemo(() => {
    if (!activeTractTown) return clippedCountyTracts;
    if (!clippedTownTracts || townTractContext.loadState !== "ready") {
      return null;
    }

    const visibleGeoids = new Set(townTractContext.tractGeoids);
    return {
      ...clippedTownTracts,
      features: clippedTownTracts.features.filter((feature) =>
        visibleGeoids.has(String(feature.properties?.GEOID ?? ""))
      )
    };
  }, [
    activeTractTown,
    clippedCountyTracts,
    clippedTownTracts,
    townTractContext.loadState,
    townTractContext.tractGeoids
  ]);
  const tractContextTowns = useMemo(() => {
    const countyFips = activeTractCounty?.countyFips;

    if (!countyFips || !displayTowns) return null;

    return {
      ...displayTowns,
      features: displayTowns.features.filter(
        (feature) =>
          String(feature.properties?.COUNTYFP ?? "") === countyFips &&
          (!activeTractTown ||
            String(feature.properties?.GEOID ?? "") === activeTractTown.geoid)
      )
    };
  }, [activeTractCounty?.countyFips, activeTractTown, displayTowns]);
  const activeBoundaryLevel: GeographyLevel = showingTowns ? "towns" : "counties";
  const activeBoundaries = showingTowns ? { ...towns, data: displayTowns } : counties;

  const handleMapReset = useCallback(() => {
    setAutocompleteRequest(null);
    setIsAutocompleteNavigating(false);
    setFacilityPanelOpen(false);
    setMapResetVersion((current) => current + 1);
    setPermalinkHydrated(true);
    handleZoomGeographyLevelChange("counties");
  }, []);
  useEffect(() => {
    if (mapMode === "gaps") return;

    setPendingAddressMatch(null);
    setAddressNavigationRequest(null);
    setAddressResolution({ message: null, status: "idle" });
    setActiveTractCounty(null);
    setActiveTractTown(null);
    setPendingTownTractGeoid(null);
    setCurrentGeographyLevel("counties");
    setSelectedFeatureColorKey(null);
    setSelectedGeography(null);
  }, [mapMode]);

  useEffect(() => {
    if (!pendingAddressMatch) return;

    if (tractShard.loadState === "error") {
      setPendingAddressMatch(null);
      setAddressResolution({
        message: "The tract map data could not be loaded for that address.",
        status: "error"
      });
      return;
    }
    if (
      tractShard.loadState !== "ready" ||
      !clippedCountyTracts ||
      !activeTractCounty
    ) {
      return;
    }

    const feature = clippedCountyTracts.features.find((candidate) =>
      isPointInFeature(
        pendingAddressMatch.latitude,
        pendingAddressMatch.longitude,
        candidate
      )
    );
    const selected = feature
      ? getSelectedFeature(
          feature,
          "tracts",
          getBoundaryLegalName(
            feature,
            `Census tract ${String(feature.properties?.GEOID ?? "").slice(-6)}`
          )
        )
      : null;

    setPendingAddressMatch(null);
    if (!feature || !selected) {
      setAddressNavigationRequest(null);
      setAddressResolution({
        message:
          "CareAtlas could not align that location with its official Census tract. Try another suggested address.",
        status: "error"
      });
      return;
    }

    addressRequestIdRef.current += 1;
    setSelectedGeography({
      ...selected,
      latitude: pendingAddressMatch.latitude,
      longitude: pendingAddressMatch.longitude
    });
    setAddressNavigationRequest({
      feature,
      latitude: pendingAddressMatch.latitude,
      longitude: pendingAddressMatch.longitude,
      requestId: addressRequestIdRef.current
    });
    setAddressResolution({
      message: `Located in ${selected.name} (official tract ID ${selected.geoid}).`,
      status: "ready"
    });
  }, [
    activeTractCounty,
    clippedCountyTracts,
    pendingAddressMatch,
    tractShard.loadState
  ]);

  useEffect(() => {
    if (
      !pendingTownTractGeoid ||
      !activeTractTown ||
      townTractContext.loadState !== "ready" ||
      tractShard.loadState !== "ready"
    ) {
      return;
    }

    const classification = tractShard.classifications.find(
      (record) => record.geography.geoid === pendingTownTractGeoid
    );
    const feature = getFeatureByGeoid(tractGeography, pendingTownTractGeoid);
    const isValidatedTownGapTract =
      townTractContext.tractGeoids.includes(pendingTownTractGeoid) &&
      classification?.state === "potential_access_gap";

    if (!feature || !isValidatedTownGapTract) {
      setPendingTownTractGeoid(null);
      return;
    }

    const selectedTract = getSelectedFeature(
      feature,
      "tracts",
      getBoundaryLegalName(
        feature,
        `Census tract ${pendingTownTractGeoid.slice(-6)}`
      )
    );

    if (selectedTract) setSelectedGeography(selectedTract);
    setPendingTownTractGeoid(null);
  }, [
    activeTractTown,
    pendingTownTractGeoid,
    townTractContext.loadState,
    townTractContext.tractGeoids,
    tractShard.classifications,
    tractShard.loadState,
    tractGeography
  ]);

  const navigateToBoundary = useCallback(
    (candidate: BoundaryAutocompleteCandidate) => {
      const selected = getSelectedFeature(
        candidate.feature,
        candidate.level,
        candidate.displayName
      );

      if (!selected) return false;

      setActiveTractCounty(null);
      setActiveTractTown(null);
      setPendingTownTractGeoid(null);
      setPendingAddressMatch(null);
      setAddressNavigationRequest(null);
      setAddressResolution({ message: null, status: "idle" });
      setCurrentGeographyLevel(candidate.level);
      setSelectedFeatureColorKey(
        getGeographyFeatureColorKey(candidate.feature, candidate.level)
      );
      setSelectedGeography(selected);
      setIsAutocompleteNavigating(true);
      setAutocompleteRequest((currentRequest) => ({
        candidate,
        requestId: (currentRequest?.requestId ?? 0) + 1
      }));
      return true;
    },
    []
  );

  useEffect(() => {
    if (!initialPermalink || permalinkHydrated) return;

    if (
      initialPermalink.kind === "county" ||
      initialPermalink.kind === "town"
    ) {
      const level =
        initialPermalink.kind === "county" ? "counties" : "towns";
      const data = level === "counties" ? counties.data : displayTowns;
      if (!data) return;

      const feature = getFeatureByGeoid(data, initialPermalink.geoid);
      if (feature) navigateToBoundary(getBoundaryCandidate(feature, level));
      setPermalinkHydrated(true);
      return;
    }

    const countyFips = initialPermalink.geoid.slice(2, 5);
    if (activeTractCounty?.countyFips !== countyFips) {
      if (!counties.data) return;
      const countyFeature = getFeatureByGeoid(
        counties.data,
        `34${countyFips}`
      );
      const county = countyFeature
        ? getSelectedFeature(
            countyFeature,
            "counties",
            getBoundaryLegalName(countyFeature, "Selected county")
          )
        : null;

      if (!county) {
        setPermalinkHydrated(true);
        return;
      }

      setActiveTractCounty(county);
      setActiveTractTown(null);
      setCurrentGeographyLevel("tracts");
      setSelectedFeatureColorKey(null);
      setSelectedGeography(county);
      return;
    }

    if (tractShard.loadState === "loading" || tractShard.loadState === "idle") {
      return;
    }

    const tractFeature = getFeatureByGeoid(
      clippedCountyTracts,
      initialPermalink.geoid
    );
    const tract = tractFeature
      ? getSelectedFeature(
          tractFeature,
          "tracts",
          getBoundaryLegalName(
            tractFeature,
            `Census tract ${initialPermalink.geoid.slice(-6)}`
          )
        )
      : null;

    if (tract) setSelectedGeography(tract);
    setPermalinkHydrated(true);
  }, [
    activeTractCounty?.countyFips,
    counties.data,
    clippedCountyTracts,
    displayTowns,
    initialPermalink,
    navigateToBoundary,
    permalinkHydrated,
    tractShard.loadState
  ]);

  useEffect(() => {
    if (!permalinkHydrated) return;
    replaceMapPermalink(
      mapMode === "gaps" && selectedGeography
        ? getMapPermalinkTarget(
            selectedGeography.level,
            selectedGeography.geoid
          )
        : null
    );
  }, [
    mapMode,
    permalinkHydrated,
    selectedGeography?.geoid,
    selectedGeography?.level
  ]);

  function handleZoomGeographyLevelChange(nextLevel: GeographyLevel) {
    setCurrentGeographyLevel(nextLevel);
    if (nextLevel !== "tracts") {
      setActiveTractCounty(null);
      setActiveTractTown(null);
      setPendingAddressMatch(null);
      setAddressNavigationRequest(null);
      setAddressResolution({ message: null, status: "idle" });
    }
    setPendingTownTractGeoid(null);
    setSelectedFeatureColorKey(null);
    setSelectedGeography(null);
  }

  function handleAutocompleteSelect(candidate: BoundaryAutocompleteCandidate) {
    navigateToBoundary(candidate);
  }

  const handleAutocompleteNavigationComplete = useCallback(() => {
    setIsAutocompleteNavigating(false);
  }, []);

  function openTractMode(area: SelectedGeography) {
    if (!area.feature || !area.countyFips) return;

    let county = area;
    if (area.level === "towns") {
      const countyFeature = counties.data?.features.find(
        (feature) =>
          String(feature.properties?.COUNTYFP ?? "") === area.countyFips
      );
      const countyBounds = countyFeature ? getFeatureBounds(countyFeature) : null;
      if (!countyFeature || !countyBounds) return;

      county = getSelectedGeographyFromFeature(
        countyFeature,
        "counties",
        getBoundaryLegalName(countyFeature, "Selected county"),
        (countyBounds.minLatitude + countyBounds.maxLatitude) / 2,
        (countyBounds.minLongitude + countyBounds.maxLongitude) / 2
      );
    }

    setActiveTractCounty(county);
    setActiveTractTown(area.level === "towns" ? area : null);
    setPendingTownTractGeoid(null);
    setPendingAddressMatch(null);
    setAddressNavigationRequest(null);
    setAddressResolution({ message: null, status: "idle" });
    setCurrentGeographyLevel("tracts");
    setSelectedFeatureColorKey(null);
    setSelectedGeography(area);
  }

  function openFlaggedTownTract(area: SelectedGeography, geoid: string) {
    if (!/^34\d{9}$/.test(geoid) || area.level !== "towns") return;
    openTractMode(area);
    setPendingTownTractGeoid(geoid);
  }

  function closeTractMode() {
    const area = activeTractTown ?? activeTractCounty;
    setActiveTractCounty(null);
    setActiveTractTown(null);
    setPendingTownTractGeoid(null);
    setPendingAddressMatch(null);
    setAddressNavigationRequest(null);
    setAddressResolution({ message: null, status: "idle" });
    setCurrentGeographyLevel(area?.level === "towns" ? "towns" : "counties");
    setSelectedGeography(area);
    setSelectedFeatureColorKey(
      area?.feature
        ? getGeographyFeatureColorKey(area.feature, area.level)
        : null
    );
  }

  function returnToAreaSummary() {
    setSelectedGeography(activeTractTown ?? activeTractCounty);
  }

  function handleAddressLocationMatch(match: AddressLocationMatch) {
    if (!counties.data) {
      setAddressResolution({
        message: "New Jersey county boundaries are still loading. Try again shortly.",
        status: "error"
      });
      return;
    }

    const countyFeature = counties.data.features.find((feature) =>
      isPointInFeature(match.latitude, match.longitude, feature)
    );
    const county = countyFeature
      ? getSelectedFeature(
          countyFeature,
          "counties",
          getBoundaryLegalName(countyFeature, "Selected county")
        )
      : null;

    if (!county?.countyFips) {
      setAddressResolution({
        message:
          "That result did not fall inside an official New Jersey county boundary.",
        status: "error"
      });
      return;
    }

    setActiveTractCounty(county);
    setActiveTractTown(null);
    setPendingTownTractGeoid(null);
    setPendingAddressMatch(match);
    setAddressNavigationRequest(null);
    setAddressResolution({ message: null, status: "loading" });
    setCurrentGeographyLevel("tracts");
    setSelectedFeatureColorKey(null);
    setSelectedGeography(county);
  }

  function clearAddressLocation() {
    const hadAddressContext = Boolean(
      pendingAddressMatch ||
        addressNavigationRequest ||
        addressResolution.status !== "idle"
    );
    if (hadAddressContext && tractMode) {
      closeTractMode();
      setSelectedGeography(null);
      setSelectedFeatureColorKey(null);
      return;
    }
    setPendingAddressMatch(null);
    setAddressNavigationRequest(null);
    setAddressResolution({
      message: "Address pin cleared. Continue exploring tracts or return to the normal map.",
      status: "ready"
    });
  }

  function handleTractGeographySelect(geography: SelectedGeography) {
    setPendingAddressMatch(null);
    setAddressNavigationRequest(null);
    setAddressResolution({ message: null, status: "idle" });
    setSelectedGeography(geography);
  }

  return (
    <div className={`hb-local-brief-print-surface relative h-full min-h-0 w-full overflow-hidden bg-hb-card ${mapMode === "gaps" ? "hb-gap-workspace" : ""}`}>
      <MapContainer
        center={newJerseyCenter}
        className="careatlas-clean-map h-full min-h-[32rem] w-full"
        fadeAnimation={false}
        inertia={true}
        inertiaDeceleration={3000}
        inertiaMaxSpeed={900}
        markerZoomAnimation={false}
        maxBounds={newJerseyMaxBounds}
        maxBoundsViscosity={1}
        maxZoom={13}
        minZoom={newJerseyMinZoom}
        preferCanvas={true}
        scrollWheelZoom={true}
        wheelDebounceTime={30}
        wheelPxPerZoomLevel={90}
        zoom={newJerseyInitialZoom}
        zoomAnimation={false}
        zoomDelta={0.5}
        zoomSnap={0.5}
      >
        <MapSizeObserver />
        <InitialMapFitter enabled={initialPermalink === null} onReset={handleMapReset} />
        <TractModeController
          activeArea={activeTractTown ?? activeTractCounty}
          navigationOverrideActive={Boolean(pendingAddressMatch || addressNavigationRequest)}
          tractMode={tractMode}
        />
        <ZoomLevelWatcher
          currentGeographyLevel={currentGeographyLevel}
          onGeographyLevelChange={handleZoomGeographyLevelChange}
          suppressGeographyLevelUpdates={
            isAutocompleteNavigating || !permalinkHydrated
          }
        />
        <BoundaryAutocompleteController
          onNavigationComplete={handleAutocompleteNavigationComplete}
          request={autocompleteRequest}
        />
        <Pane
          name={countyPaneName}
          style={{ display: showingTowns || tractMode ? "none" : "block", zIndex: 430 }}
        />
        <Pane
          name={townPaneName}
          style={{ display: showingTowns && !tractMode ? "block" : "none", zIndex: 430 }}
        />
        <Pane
          name="boundary-outlines"
          style={{ pointerEvents: "none", zIndex: 425 }}
        />
        <Pane
          name="boundary-labels"
          style={{ pointerEvents: "none", zIndex: 455 }}
        />
        <Pane
          name="tract-context-boundaries"
          style={{ pointerEvents: "none", zIndex: 430 }}
        />
        <Pane name="tract-classifications" style={{ zIndex: 440 }} />
        <Pane
          name="town-tract-outline"
          style={{ pointerEvents: "none", zIndex: 450 }}
        />
        <Pane name="tract-flags" style={{ zIndex: 460 }} />
        <Pane name="address-location" style={{ zIndex: 465 }} />
        <Pane name="healthcare-markers" style={{ zIndex: 470 }} />
        <Pane name="doctor-office-markers" style={{ zIndex: 475 }} />
        <BoundaryLayerVisibilityController
          showingTowns={showingTowns}
          tractMode={tractMode}
        />
        {counties.data && (
          <GeographyBoundaries
            currentGeographyLevel="counties"
            geographyData={counties.data}
            healthcareAccessChoroplethEnabled={false}
            healthcareAccessSummaries={null}
            isActive={!showingTowns && !tractMode}
            loadedGeographyDataUrl={counties.loadedUrl}
            onActiveStateFipsChange={keepNewJerseyActive}
            onBoundaryHealthcarePreviewChange={ignoreBoundaryPreview}
            onGeographySelect={setSelectedGeography}
            onSelectedFeatureColorKeyChange={setSelectedFeatureColorKey}
            onTownSelect={ignoreTownSelection}
            paneName={countyPaneName}
            roadMode="off"
            selectedFeatureColorKey={selectedFeatureColorKey}
            drillOnSelect={false}
          />
        )}
        {displayTowns && (
          <GeographyBoundaries
            currentGeographyLevel="towns"
            geographyData={displayTowns}
            healthcareAccessChoroplethEnabled={false}
            healthcareAccessSummaries={null}
            isActive={showingTowns && !tractMode}
            loadedGeographyDataUrl={towns.loadedUrl}
            onActiveStateFipsChange={keepNewJerseyActive}
            onBoundaryHealthcarePreviewChange={ignoreBoundaryPreview}
            onGeographySelect={setSelectedGeography}
            onSelectedFeatureColorKeyChange={setSelectedFeatureColorKey}
            onTownSelect={ignoreTownSelection}
            paneName={townPaneName}
            roadMode="off"
            selectedFeatureColorKey={selectedFeatureColorKey}
          />
        )}
        {!tractMode && activeBoundaries.data && (
          <>
            <BoundaryLabels
              currentGeographyLevel={activeBoundaryLevel}
              geographyData={activeBoundaries.data}
              key={`${activeBoundaryLevel}-${activeBoundaries.loadedUrl ?? "pending"}-labels`}
              selectedFeatureColorKey={selectedFeatureColorKey}
            />
            {selectedGeography?.level === activeBoundaryLevel && (
              <SelectedBoundaryLabel selectedGeography={selectedGeography} />
            )}
          </>
        )}
        {showingTowns && counties.data && (
          <CountyOutlineLayer geography={counties.data} townCoverageGeography={displayTowns} />
        )}
        {tractMode && counties.data && (
          <TractContextBoundaryLayer
            countyGeography={counties.data}
            key={`tract-context-${activeTractCounty?.countyFips ?? "none"}`}
            tractGeography={activeTractTown ? clippedTownTracts : null}
            townGeography={tractContextTowns}
          />
        )}
        {tractMode && tractGeography && tractShard.loadState === "ready" && (
          <TractClassificationLayer
            classifications={tractShard.classifications}
            geography={tractGeography}
            onGeographySelect={handleTractGeographySelect}
            selectedTractGeoid={
              selectedGeography?.level === "tracts"
                ? selectedGeography.geoid ?? null
                : null
            }
          />
        )}
        {tractMode && activeTractCounty?.feature && (
          <CountyTractOutlineLayer feature={activeTractCounty.feature} />
        )}
        {tractMode && activeTractTown?.feature && (
          <TownTractOutlineLayer feature={activeTractTown.feature} />
        )}
        {tractMode && (
          <SelectedBoundaryLabel
            selectedGeography={activeTractTown ?? activeTractCounty}
          />
        )}
        <AddressTractLocation
          request={mapMode === "gaps" ? addressNavigationRequest : null}
        />
        {mapMode === "healthcare" &&
          !tractMode &&
          counties.data &&
          healthcare.loadState === "ready" && (
          <HealthcareFacilityMarkers
            countyData={counties.data}
            countyMode={!showingTowns}
            facilities={newJerseyFacilities}
            key={`healthcare-markers-${mapResetVersion}`}
            onPanelOpenChange={setFacilityPanelOpen}
          />
        )}
        {mapMode === "doctor_offices" && counties.data && <DoctorOfficeMode countyData={counties.data} countyMode={!showingTowns} />}
      </MapContainer>

      {mapMode === "gaps" && <GapSidebar
        countyData={counties.data} townData={displayTowns} onSelect={handleAutocompleteSelect}
        selectionId={selectedGeography?.geoid ?? activeTractCounty?.geoid ?? null}
        addressSearch={<AddressTractFinder onClear={clearAddressLocation} onLocationMatch={handleAddressLocationMatch} resolution={addressResolution} />}
      >
      {!pendingAddressMatch && <SelectedAreaCard
        activeTractCounty={activeTractCounty}
        activeTractTown={activeTractTown}
        facilities={newJerseyFacilities}
        facilityLoadState={healthcare.loadState}
        onBackToSummary={returnToAreaSummary}
        onClear={() => {
          setPendingTownTractGeoid(null);
          setSelectedFeatureColorKey(null);
          setSelectedGeography(null);
        }}
        onCloseTractMode={closeTractMode}
        onOpenTractMode={openTractMode}
        onSelectFlaggedTract={openFlaggedTownTract}
        selectedGeography={selectedGeography}
        tractMode={tractMode}
      />}
        {tractMode && !pendingAddressMatch && <TractMapKey focusLevel={activeTractTown ? "town" : "county"} />}
      </GapSidebar>}
      {mapMode !== "gaps" && <BoundaryAutocomplete countyData={counties.data} onSelect={handleAutocompleteSelect} townData={displayTowns} />}
      {mapMode === "healthcare" && healthcare.loadState === "ready" && <HealthcareFacilityKey facilities={newJerseyFacilities} />}

      {(activeBoundaries.isLoading || activeBoundaries.error) && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2">
          <p className="rounded border border-slate-300 bg-white/95 px-3 py-2 text-xs font-semibold text-hb-deepNavy shadow-sm">
            {activeBoundaries.error ??
              (showingTowns
                ? "Loading New Jersey towns and townships..."
                : "Loading New Jersey counties...")}
          </p>
        </div>
      )}
      {mapMode === "healthcare" && healthcare.loadState === "error" && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-[1000] max-w-xs">
          <p className="rounded border border-rose-200 bg-white/95 px-3 py-2 text-xs font-semibold text-rose-800 shadow-sm">
            Healthcare facility locations could not be loaded. The boundary map remains available.
          </p>
        </div>
      )}
      {tractMode && !pendingAddressMatch && (
        tractShard.loadState === "loading" ||
        tractShard.error ||
        (activeTractTown && townTractContext.loadState === "loading") ||
        townTractContext.error
      ) && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2">
          <p className="rounded border border-slate-300 bg-white/95 px-3 py-2 text-xs font-semibold text-hb-deepNavy shadow-sm">
            {tractShard.error ??
              townTractContext.error ??
              `Loading this ${activeTractTown ? "town's" : "county's"} gap tracts...`}
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(CareAtlasMap);
