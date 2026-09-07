import { memo, useEffect, useMemo, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import type { PathOptions } from "leaflet";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { GeoJSON, Marker, useMap, useMapEvents } from "react-leaflet";
import type { GeographyData } from "../hooks/useGeographyData";
import { careAtlasMapResetEvent } from "./map/mapReset";
import type {
  HealthcareFacility,
  HealthcareFacilityType
} from "../types/healthcare";
import { hasValidHealthcareFacilityCoordinates } from "../utils/healthcareFacilityFilters";
import { getHealthcareFacilityPresentation } from "../utils/healthcareFacilityPresentation";
import { HealthcareFacilityContactLinks } from "./HealthcareFacilityContactLinks";
import { getFeatureLabelPoint, isPointInFeature } from "./map/geometry";

type HealthcareFacilityMarkersProps = {
  countyData: GeographyData;
  countyMode: boolean;
  facilities: HealthcareFacility[];
  onPanelOpenChange: (open: boolean) => void;
};

type MarkerFacility = HealthcareFacility & {
  latitude: number;
  longitude: number;
};

type FacilityGroup = {
  boundaryFeature?: Feature<Geometry, GeoJsonProperties>;
  facilities: MarkerFacility[];
  id: string;
  label: string | null;
  latitude: number;
  longitude: number;
};

const markerIconCache = new Map<string, ReturnType<typeof divIcon>>();
const clusterIconCache = new Map<string, ReturnType<typeof divIcon>>();
const numberedMarkerIconCache = new Map<string, ReturnType<typeof divIcon>>();
const dimmedCountyStyle: PathOptions = {
  color: "#94A3B8",
  fillColor: "#E2E8F0",
  fillOpacity: 0.56,
  opacity: 0.34,
  weight: 1
};
const focusedCountyStyle: PathOptions = {
  color: "#007F86",
  fillColor: "#18C7C0",
  fillOpacity: 0.14,
  lineCap: "round",
  lineJoin: "round",
  opacity: 1,
  weight: 4
};

function getMarkerIcon(
  facilityType: HealthcareFacilityType,
  isHighlighted: boolean,
  isDimmed: boolean
) {
  const presentation = getHealthcareFacilityPresentation(facilityType);
  const cacheKey = `${facilityType}:${isHighlighted}:${isDimmed}`;
  const cached = markerIconCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const icon = divIcon({
    className: [
      "hb-healthcare-marker-icon",
      presentation.markerClassName,
      isHighlighted ? "hb-healthcare-marker-icon--highlighted" : "",
      isDimmed ? "hb-healthcare-marker-icon--dimmed" : ""
    ].filter(Boolean).join(" "),
    html: `<svg class="hb-healthcare-marker-pin" aria-hidden="true" viewBox="0 0 32 40">
      <path class="hb-healthcare-marker-pin__body" d="M16 2.5C8.8 2.5 3 8.3 3 15.5c0 9 13 21.8 13 21.8s13-12.8 13-21.8C29 8.3 23.2 2.5 16 2.5Z" />
      ${presentation.symbolMarkup}
    </svg>`,
    iconAnchor: [16, 38],
    iconSize: [32, 40]
  });

  markerIconCache.set(cacheKey, icon);
  return icon;
}

function getNumberedMarkerIcon(
  facilityType: HealthcareFacilityType,
  number: number,
  isHighlighted: boolean
) {
  const presentation = getHealthcareFacilityPresentation(facilityType);
  const cacheKey = `${facilityType}:${number}:${isHighlighted}`;
  const cached = numberedMarkerIconCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const icon = divIcon({
    className: [
      "hb-healthcare-marker-icon",
      "hb-healthcare-marker-icon--numbered",
      presentation.markerClassName,
      isHighlighted ? "hb-healthcare-marker-icon--highlighted" : ""
    ].filter(Boolean).join(" "),
    html: `<svg class="hb-healthcare-marker-pin" aria-hidden="true" viewBox="0 0 32 40">
      <path class="hb-healthcare-marker-pin__body" d="M16 2.5C8.8 2.5 3 8.3 3 15.5c0 9 13 21.8 13 21.8s13-12.8 13-21.8C29 8.3 23.2 2.5 16 2.5Z" />
      <text class="hb-healthcare-marker-number" x="16" y="16">${number}</text>
    </svg>`,
    iconAnchor: [16, 38],
    iconSize: [32, 40]
  });

  numberedMarkerIconCache.set(cacheKey, icon);
  return icon;
}

function getClusterIcon(
  count: number,
  isHighlighted: boolean,
  isDimmed: boolean
) {
  const key = `${count}:${isHighlighted}:${isDimmed}`;
  const cached = clusterIconCache.get(key);

  if (cached) {
    return cached;
  }

  const size = count >= 100 ? 46 : count >= 25 ? 40 : 34;
  const icon = divIcon({
    className: [
      "hb-healthcare-cluster-icon",
      isHighlighted ? "hb-healthcare-cluster-icon--highlighted" : "",
      isDimmed ? "hb-healthcare-cluster-icon--dimmed" : ""
    ].filter(Boolean).join(" "),
    html: `<span class="hb-healthcare-cluster-count">${count}</span>`,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size],
    popupAnchor: [0, -(size / 2)]
  });

  clusterIconCache.set(key, icon);
  return icon;
}

function getCountyGroups(
  facilities: MarkerFacility[],
  countyData: GeographyData
) {
  const countyEntries = countyData.features.flatMap((feature) => {
    const id = String(feature.properties?.GEOID ?? "").trim();
    const labelPoint = getFeatureLabelPoint(feature);

    if (!id || !labelPoint) {
      return [];
    }

    return [{
      feature,
      id,
      label: String(
        feature.properties?.NAMELSAD ??
        `${feature.properties?.NAME ?? "County"} County`
      ),
      latitude: labelPoint.latitude,
      longitude: labelPoint.longitude
    }];
  });
  const facilitiesByCounty = new Map<string, MarkerFacility[]>();

  for (const facility of facilities) {
    const county = countyEntries.find(({ feature }) =>
      isPointInFeature(facility.latitude, facility.longitude, feature)
    );

    if (!county) {
      continue;
    }

    const countyFacilities = facilitiesByCounty.get(county.id) ?? [];
    countyFacilities.push(facility);
    facilitiesByCounty.set(county.id, countyFacilities);
  }

  return countyEntries.flatMap<FacilityGroup>((county) => {
    const countyFacilities = facilitiesByCounty.get(county.id);

    return countyFacilities?.length
      ? [{
          boundaryFeature: county.feature,
          facilities: countyFacilities,
          id: `county-${county.id}`,
          label: county.label,
          latitude: county.latitude,
          longitude: county.longitude
        }]
      : [];
  });
}

function getLocalGroups(
  facilities: MarkerFacility[],
  map: ReturnType<typeof useMap>,
  zoom: number
) {
  const groupingRadius = zoom < 11 ? 48 : zoom < 12.5 ? 34 : 22;
  const projectedFacilities = facilities.map((facility) => ({
    facility,
    point: map.project([facility.latitude, facility.longitude], zoom)
  }));
  const visited = new Set<number>();
  const localGroups: MarkerFacility[][] = [];

  for (let index = 0; index < projectedFacilities.length; index += 1) {
    if (visited.has(index)) continue;
    const memberIndexes = [index];
    const group: MarkerFacility[] = [];
    visited.add(index);

    while (memberIndexes.length > 0) {
      const currentIndex = memberIndexes.pop();
      if (currentIndex === undefined) continue;
      const current = projectedFacilities[currentIndex];
      group.push(current.facility);

      for (
        let candidateIndex = 0;
        candidateIndex < projectedFacilities.length;
        candidateIndex += 1
      ) {
        if (
          visited.has(candidateIndex) ||
          current.point.distanceTo(projectedFacilities[candidateIndex].point) >
            groupingRadius
        ) {
          continue;
        }
        visited.add(candidateIndex);
        memberIndexes.push(candidateIndex);
      }
    }

    localGroups.push(group);
  }

  return localGroups.map<FacilityGroup>((group) => ({
    facilities: group,
    id: `local-${group.map((facility) => facility.id).sort().join("-")}`,
    label: null,
    latitude: group.reduce((sum, facility) => sum + facility.latitude, 0) / group.length,
    longitude: group.reduce((sum, facility) => sum + facility.longitude, 0) / group.length
  }));
}

function FacilityGroupPopup({
  focusedFacilityId,
  group,
  isMapFocusActive,
  onShowFacility,
  onShowAllOnMap
}: {
  focusedFacilityId: string | null;
  group: FacilityGroup;
  isMapFocusActive: boolean;
  onShowFacility: (facility: MarkerFacility) => void;
  onShowAllOnMap: (() => void) | null;
}) {
  const sortedFacilities = useMemo(
    () => [...group.facilities].sort((first, second) =>
      first.name.localeCompare(second.name)
    ),
    [group.facilities]
  );

  return (
    <div className="w-72 max-w-[74vw] text-hb-text">
      <p className="text-[11px] font-black uppercase tracking-[0.13em] text-hb-teal">
        Facility map
      </p>
      <h3 className="mt-1 text-sm font-black leading-tight text-hb-deepNavy">
        {group.label && group.facilities.length > 1
          ? `${group.label}: ${group.facilities.length} facilities`
          : group.facilities.length === 1
          ? group.facilities[0].name
          : `${group.facilities.length} healthcare facilities`}
      </h3>
      <p className="mt-1 text-[11px] leading-4 text-hb-muted">
        {isMapFocusActive
          ? `Pins 1-${group.facilities.length} match the numbered facility list below.`
          : "Pins show source-backed hospitals and community health centers, not every physician office or provider."}
      </p>
      {isMapFocusActive && group.label && (
        <p className="mt-2 rounded-md border border-hb-aqua/30 bg-hb-background px-2.5 py-2 text-xs font-semibold leading-4 text-hb-navy" role="status">
          {group.label} is outlined on the map. Other facility markers are faded.
        </p>
      )}
      <ul className="mt-3 max-h-72 divide-y divide-hb-border overflow-y-auto pr-1">
        {sortedFacilities.map((facility, index) => {
          const presentation = getHealthcareFacilityPresentation(
            facility.facilityType
          );
          const facilityNumber = index + 1;
          const isFocusedFacility = focusedFacilityId === facility.id;

          return (
            <li
              className={`py-3 first:pt-1 last:pb-1 ${isFocusedFacility ? "rounded-md bg-hb-background px-2" : ""}`}
              key={facility.id}
            >
              <div className="flex items-start gap-2.5">
                {isMapFocusActive && (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-hb-teal text-xs font-black text-white shadow-sm"
                  >
                    {facilityNumber}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold leading-[1.4] tracking-[-0.01em] text-hb-deepNavy">
                    {facility.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold leading-4 text-slate-600">
                      {presentation.label}
                    </span>
                    <button
                      aria-label={`Show the exact map pin for ${facility.name}`}
                      className="text-xs font-bold leading-5 text-hb-teal underline decoration-hb-aqua/60 underline-offset-2 hover:text-hb-navy"
                      onClick={() => onShowFacility(facility)}
                      type="button"
                    >
                      Show exact pin{isMapFocusActive ? ` ${facilityNumber}` : ""}
                    </button>
                  </div>
                  <HealthcareFacilityContactLinks compact facility={facility} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {onShowAllOnMap && (
        <button
          className="mt-3 w-full rounded-lg border border-hb-aqua/25 bg-hb-background px-3 py-2 text-xs font-black text-hb-navy"
          onClick={onShowAllOnMap}
          type="button"
        >
          {isMapFocusActive ? "Fit" : "Show"} all {group.facilities.length} on map
        </button>
      )}
    </div>
  );
}

function HealthcareFacilityMarkers({
  countyData,
  countyMode,
  facilities,
  onPanelOpenChange
}: HealthcareFacilityMarkersProps) {
  const map = useMap();
  const [viewport, setViewport] = useState(() => ({
    bounds: map.getBounds(),
    zoom: map.getZoom()
  }));
  const [highlightedFacilityIds, setHighlightedFacilityIds] = useState<string[]>([]);
  const [focusedFacilityId, setFocusedFacilityId] = useState<string | null>(null);
  const [isMapFocusActive, setIsMapFocusActive] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<FacilityGroup | null>(null);

  useMapEvents({
    moveend: () => setViewport({ bounds: map.getBounds(), zoom: map.getZoom() })
  });

  const mappableFacilities = useMemo<MarkerFacility[]>(() =>
    facilities.flatMap((facility) =>
      hasValidHealthcareFacilityCoordinates(facility) ? [facility] : []
    ), [facilities]);
  const mapFocusGroup = isMapFocusActive ? selectedGroup : null;
  const mapFocusFacilityIdSet = useMemo(
    () => new Set(mapFocusGroup?.facilities.map((facility) => facility.id) ?? []),
    [mapFocusGroup]
  );
  const mapFocusFacilityNumberById = useMemo(
    () => new Map(
      [...(mapFocusGroup?.facilities ?? [])]
        .sort((first, second) => first.name.localeCompare(second.name))
        .map((facility, index) => [facility.id, index + 1])
    ),
    [mapFocusGroup]
  );
  const dimmedCountyData = useMemo<GeographyData | null>(() => {
    const focusedCountyGeoid = String(
      mapFocusGroup?.boundaryFeature?.properties?.GEOID ?? ""
    );

    if (!focusedCountyGeoid) return null;
    return {
      ...countyData,
      features: countyData.features.filter((feature) =>
        String(feature.properties?.GEOID ?? "") !== focusedCountyGeoid
      )
    };
  }, [countyData, mapFocusGroup]);
  const groups = useMemo(() => {
    const mapFocusFacilityGroups = mapFocusGroup
      ? mapFocusGroup.facilities.map<FacilityGroup>((facility) => ({
          facilities: [facility],
          id: `map-focus-${facility.id}`,
          label: null,
          latitude: facility.latitude,
          longitude: facility.longitude
        }))
      : [];
    const backgroundFacilities = mapFocusGroup
      ? mappableFacilities.filter((facility) =>
          !mapFocusFacilityIdSet.has(facility.id)
        )
      : mappableFacilities;

    if (countyMode) {
      return [
        ...mapFocusFacilityGroups,
        ...getCountyGroups(backgroundFacilities, countyData)
      ];
    }

    const visibleFacilities = backgroundFacilities.filter((facility) =>
      viewport.bounds.contains([facility.latitude, facility.longitude])
    );
    const focusedFacility = !mapFocusGroup && focusedFacilityId
      ? visibleFacilities.find((facility) => facility.id === focusedFacilityId)
      : null;
    const localGroups = getLocalGroups(
      focusedFacility
        ? visibleFacilities.filter((facility) => facility.id !== focusedFacility.id)
        : visibleFacilities,
      map,
      viewport.zoom
    );

    return [
      ...mapFocusFacilityGroups,
      ...(focusedFacility ? [{
          facilities: [focusedFacility],
          id: `focused-${focusedFacility.id}`,
          label: null,
          latitude: focusedFacility.latitude,
          longitude: focusedFacility.longitude
        }, ...localGroups]
      : localGroups)
    ];
  }, [countyData, countyMode, focusedFacilityId, map, mapFocusFacilityIdSet, mapFocusGroup, mappableFacilities, viewport]);
  const highlightedFacilityIdSet = useMemo(
    () => new Set(highlightedFacilityIds),
    [highlightedFacilityIds]
  );
  const panelOpen = Boolean(selectedGroup);

  useEffect(() => {
    const reset = () => {
      setHighlightedFacilityIds([]);
      setFocusedFacilityId(null);
      setIsMapFocusActive(false);
      setSelectedGroup(null);
    };
    window.addEventListener(careAtlasMapResetEvent, reset);
    return () => window.removeEventListener(careAtlasMapResetEvent, reset);
  }, []);

  useEffect(() => {
    onPanelOpenChange(panelOpen);

    return () => onPanelOpenChange(false);
  }, [onPanelOpenChange, panelOpen]);

  function showAllGroupFacilitiesOnMap(group: FacilityGroup) {
    const facilityBounds = latLngBounds(
      group.facilities.map((facility): [number, number] => [
        facility.latitude,
        facility.longitude
      ])
    );
    const mapWidth = map.getSize().x;

    setSelectedGroup(group);
    setIsMapFocusActive(true);
    setFocusedFacilityId(null);
    setHighlightedFacilityIds([]);
    map.stop();
    map.fitBounds(facilityBounds, {
      animate: false,
      maxZoom: Math.min(map.getMaxZoom(), 12),
      paddingBottomRight: [mapWidth >= 640 ? 390 : 24, 32],
      paddingTopLeft: [32, 32]
    });
  }

  function showExactFacilityPin(facility: MarkerFacility) {
    if (!mapFocusFacilityIdSet.has(facility.id)) {
      setSelectedGroup(null);
      setIsMapFocusActive(false);
    }
    setFocusedFacilityId(facility.id);
    setHighlightedFacilityIds([facility.id]);
    map.stop();
    map.setView(
      [facility.latitude, facility.longitude],
      map.getMaxZoom(),
      { animate: false }
    );
  }

  return <>
    {groups.map((group) => {
      const isCluster = group.facilities.length > 1;
      const isHighlighted = group.facilities.some((facility) =>
        highlightedFacilityIdSet.has(facility.id)
      );
      const numberedFacility = group.facilities.length === 1
        ? mapFocusFacilityNumberById.get(group.facilities[0].id) ?? null
        : null;
      const isDimmed = Boolean(mapFocusGroup) && numberedFacility === null;
      const markerTitle = isCluster
        ? `${group.facilities.length} healthcare facilities${group.label ? ` in ${group.label}` : ""}`
        : `${numberedFacility ? `${numberedFacility}. ` : ""}${group.facilities[0].name}`;

      return (
        <Marker
          eventHandlers={{
            click: () => {
              if (numberedFacility !== null) {
                setFocusedFacilityId(group.facilities[0].id);
                setHighlightedFacilityIds([group.facilities[0].id]);
                return;
              }

              setIsMapFocusActive(false);
              setFocusedFacilityId(null);
              setHighlightedFacilityIds([]);
              setSelectedGroup(group);
            }
          }}
          icon={numberedFacility !== null
            ? getNumberedMarkerIcon(
                group.facilities[0].facilityType,
                numberedFacility,
                isHighlighted
              )
            : isCluster
            ? getClusterIcon(group.facilities.length, isHighlighted, isDimmed)
            : getMarkerIcon(
                group.facilities[0].facilityType,
                isHighlighted,
                isDimmed
              )}
          key={group.id}
          pane="healthcare-markers"
          position={[group.latitude, group.longitude]}
          title={`${isHighlighted ? "Highlighted from selected cluster: " : ""}${markerTitle}`}
          zIndexOffset={numberedFacility !== null ? 750 : isHighlighted ? 700 : isCluster ? 450 : 500}
        />
      );
    })}
    {mapFocusGroup?.boundaryFeature && (
      <>
        {dimmedCountyData && (
          <GeoJSON
            data={dimmedCountyData}
            interactive={false}
            key={`healthcare-focus-dimming-${mapFocusGroup.id}`}
            pane="address-location"
            style={dimmedCountyStyle}
          />
        )}
        <GeoJSON
          data={mapFocusGroup.boundaryFeature}
          interactive={false}
          key={`healthcare-focus-${mapFocusGroup.id}`}
          pane="address-location"
          style={focusedCountyStyle}
        />
      </>
    )}
    {selectedGroup && (
      <div
        aria-label="Selected healthcare locations"
        className="hb-healthcare-facility-panel absolute left-3 right-3 top-[4.25rem] z-[1000] max-h-[calc(100%-5rem)] overflow-y-auto rounded-lg border border-slate-300 bg-white p-4 pr-10 shadow-[0_12px_28px_rgb(0_43_77_/_0.24)] sm:left-auto sm:w-[22rem]"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Close healthcare locations"
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-lg text-hb-muted hover:bg-slate-100 hover:text-hb-deepNavy focus:outline-none focus:ring-2 focus:ring-hb-aqua"
          onClick={() => {
            setSelectedGroup(null);
            setIsMapFocusActive(false);
            setFocusedFacilityId(null);
            setHighlightedFacilityIds([]);
          }}
          type="button"
        >
          ×
        </button>
        <FacilityGroupPopup
          focusedFacilityId={focusedFacilityId}
          group={selectedGroup}
          isMapFocusActive={isMapFocusActive}
          onShowFacility={showExactFacilityPin}
          onShowAllOnMap={
            selectedGroup.facilities.length > 1
              ? () => showAllGroupFacilitiesOnMap(selectedGroup)
              : null
          }
        />
      </div>
    )}
  </>;
}

export default memo(HealthcareFacilityMarkers);
