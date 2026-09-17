import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { divIcon } from "leaflet";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import type { GeographyData } from "../hooks/useGeographyData";
import type {
  DoctorOfficeLocation,
  DoctorOfficeProvider,
  DoctorOfficeSpecialtyId
} from "../types/doctorOffice";
import {
  getFeatureLabelPoint,
  isPointInFeature
} from "./map/geometry";

type DoctorOfficeMarkersProps = {
  countyData: GeographyData;
  countyMode: boolean;
  listRequestId: number;
  offices: DoctorOfficeLocation[];
  onPanelOpenChange: (open: boolean) => void;
  specialtyId: DoctorOfficeSpecialtyId;
};

export type OfficeGroup = {
  boundaryFeature?: Feature<Geometry, GeoJsonProperties>;
  id: string;
  isSearchResult?: boolean;
  label: string | null;
  latitude: number;
  longitude: number;
  offices: DoctorOfficeLocation[];
};

const markerIcon = divIcon({
  className: "hb-doctor-office-marker-icon",
  html: `<span class="hb-doctor-office-marker-pin" aria-hidden="true">
    <svg viewBox="0 0 24 24"><path d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5c0 5.4 7.5 11.5 7.5 11.5S19.5 15.4 19.5 10A7.5 7.5 0 0 0 12 2.5Z"/><path d="M12 6.5v7M8.5 10h7"/></svg>
  </span>`,
  iconAnchor: [15, 34],
  iconSize: [30, 36]
});
const focusedMarkerIcon = divIcon({
  className: "hb-doctor-office-marker-icon hb-doctor-office-marker-icon--focused",
  html: `<span class="hb-doctor-office-marker-pin" aria-hidden="true">
    <svg viewBox="0 0 24 24"><path d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5c0 5.4 7.5 11.5 7.5 11.5S19.5 15.4 19.5 10A7.5 7.5 0 0 0 12 2.5Z"/><path d="M12 6.5v7M8.5 10h7"/></svg>
  </span>`,
  iconAnchor: [17, 40],
  iconSize: [34, 41]
});
const clusterIconCache = new Map<number, ReturnType<typeof divIcon>>();

function getClusterIcon(count: number) {
  const cached = clusterIconCache.get(count);
  if (cached) return cached;

  const size = count >= 100 ? 46 : count >= 25 ? 40 : 34;
  const icon = divIcon({
    className: "hb-doctor-office-cluster-icon",
    html: `<span>${count}</span>`,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size]
  });
  clusterIconCache.set(count, icon);
  return icon;
}

function getCountyGroups(
  offices: DoctorOfficeLocation[],
  countyData: GeographyData
) {
  const countyEntries = countyData.features.flatMap((feature) => {
    const id = String(feature.properties?.GEOID ?? "").trim();
    const labelPoint = getFeatureLabelPoint(feature);
    if (!id || !labelPoint) return [];

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
  const officesByCounty = new Map<string, DoctorOfficeLocation[]>();

  for (const office of offices) {
    const county = countyEntries.find(({ feature }) =>
      isPointInFeature(office.latitude, office.longitude, feature)
    );
    if (!county) continue;
    const countyOffices = officesByCounty.get(county.id) ?? [];
    countyOffices.push(office);
    officesByCounty.set(county.id, countyOffices);
  }

  return countyEntries.flatMap<OfficeGroup>((county) => {
    const countyOffices = officesByCounty.get(county.id);
    return countyOffices?.length
      ? [{
          boundaryFeature: county.feature,
          id: `doctor-county-${county.id}`,
          label: county.label,
          latitude: county.latitude,
          longitude: county.longitude,
          offices: countyOffices
        }]
      : [];
  });
}

function getLocalGroups(
  offices: DoctorOfficeLocation[],
  map: ReturnType<typeof useMap>,
  zoom: number
) {
  const groupingRadius = zoom < 11 ? 48 : zoom < 12.5 ? 34 : 22;
  const projected = offices.map((office) => ({
    office,
    point: map.project([office.latitude, office.longitude], zoom)
  }));
  const visited = new Set<number>();
  const groups: DoctorOfficeLocation[][] = [];

  for (let index = 0; index < projected.length; index += 1) {
    if (visited.has(index)) continue;
    const pending = [index];
    const group: DoctorOfficeLocation[] = [];
    visited.add(index);

    while (pending.length > 0) {
      const currentIndex = pending.pop();
      if (currentIndex === undefined) continue;
      const current = projected[currentIndex];
      group.push(current.office);

      for (let candidate = 0; candidate < projected.length; candidate += 1) {
        if (
          visited.has(candidate) ||
          current.point.distanceTo(projected[candidate].point) > groupingRadius
        ) {
          continue;
        }
        visited.add(candidate);
        pending.push(candidate);
      }
    }
    groups.push(group);
  }

  return groups.map<OfficeGroup>((group) => ({
    id: `doctor-local-${group.map(({ id }) => id).sort().join("-")}`,
    label: null,
    latitude: group.reduce((sum, office) => sum + office.latitude, 0) / group.length,
    longitude: group.reduce((sum, office) => sum + office.longitude, 0) / group.length,
    offices: group
  }));
}

function providerMatchesSpecialty(
  provider: DoctorOfficeProvider,
  specialtyId: DoctorOfficeSpecialtyId
) {
  return provider.normalizedSpecialtyIds.includes(specialtyId);
}

function formatAddress(office: DoctorOfficeLocation) {
  const postalCode = office.postalCode.replace(/^(\d{5})(\d{4})$/u, "$1-$2");
  return [
    formatListingName(office.addressLine1),
    office.addressLine2 && formatListingName(office.addressLine2),
    `${formatListingName(office.city)}, ${office.state} ${postalCode}`
  ].filter(Boolean).join(", ");
}

function getGoogleMapsUrl(office: DoctorOfficeLocation) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatAddress(office))}`;
}

function formatPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/gu, "");
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : phone;
}

function formatListingName(value: string) {
  if (value !== value.toLocaleUpperCase("en-US")) return value;

  return value
    .toLocaleLowerCase("en-US")
    .replace(/(^|[\s\-'/])\p{L}/gu, (match) => match.toLocaleUpperCase("en-US"))
    .replace(/\b(?:do|ii|iii|iv|llc|llp|md|nj|od|pa|pc|pllc|rwj)\b/giu,
      (match) => match.toLocaleUpperCase("en-US"));
}

const specialtyLabels: Record<DoctorOfficeSpecialtyId, string> = {
  dermatology: "dermatology",
  oncology: "oncology",
  pediatrics: "pediatric"
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "summary",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(","))).filter((element) => {
    const closedDetails = element.closest("details:not([open])");
    return !element.hasAttribute("hidden") &&
      (!closedDetails || element.tagName === "SUMMARY");
  });
}

export function DoctorOfficePanel({
  focusedOfficeId,
  group,
  onClose,
  onShowOffice,
  specialtyId
}: {
  focusedOfficeId: string | null;
  group: OfficeGroup;
  onClose: () => void;
  onShowOffice: (office: DoctorOfficeLocation) => void;
  specialtyId: DoctorOfficeSpecialtyId;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sortedOffices = useMemo(
    () => [...group.offices].sort((first, second) =>
      first.displayName.localeCompare(second.displayName)
    ),
    [group.offices]
  );
  const specialtyLabel = specialtyLabels[specialtyId];
  const locationLabel = group.offices.length === 1
    ? "office location"
    : "office locations";

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true });
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusableElements = getFocusableElements(dialogRef.current);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);
    if (!firstElement || !lastElement) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div
      aria-describedby="doctor-office-dialog-description"
      aria-labelledby="doctor-office-dialog-title"
      aria-modal="true"
      className="hb-doctor-office-panel absolute bottom-3 left-3 right-3 z-[1000] max-h-[55%] overflow-y-auto rounded-lg border border-slate-300 bg-white p-4 pr-10 shadow-[0_12px_28px_rgb(0_43_77_/_0.24)] sm:bottom-auto sm:left-auto sm:top-[4.25rem] sm:max-h-[calc(100%-5rem)] sm:w-[24rem]"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      ref={dialogRef}
      role="dialog"
    >
      <button
        aria-label="Close doctor office details"
        className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-lg text-hb-muted hover:bg-slate-100 hover:text-hb-deepNavy focus:outline-none focus:ring-2 focus:ring-hb-aqua"
        onClick={onClose}
        ref={closeButtonRef}
        type="button"
      >
        ×
      </button>
      <p className="text-[11px] font-black uppercase tracking-[0.13em] text-hb-teal">
        Find care
      </p>
      <h3 className="mt-1 text-sm font-black leading-tight text-hb-deepNavy" id="doctor-office-dialog-title">
        {group.isSearchResult
          ? `${group.offices.length} ${specialtyLabel} ${locationLabel} matching your search`
          : group.label && group.offices.length > 1
          ? `${group.offices.length} ${specialtyLabel} ${locationLabel} in ${group.label}`
          : group.offices.length === 1
            ? formatListingName(group.offices[0].displayName)
            : `${group.offices.length} ${specialtyLabel} ${locationLabel}`}
      </h3>
      <p className="mt-1 text-[11px] leading-4 text-hb-muted" id="doctor-office-dialog-description">
        Choose a location for directions or a phone number. Call ahead to
        confirm it meets your needs, takes your insurance and has appointments.
      </p>

      <ul className="mt-3 space-y-2.5">
        {sortedOffices.map((office) => {
          const providers = office.providers.filter((provider) =>
            providerMatchesSpecialty(provider, specialtyId)
          );
          const providerLabel = providers.length === 1
            ? "clinician"
            : "clinicians";
          const isFocused = focusedOfficeId === office.id;
          return (
            <li
              className={`rounded-lg border p-3 ${isFocused ? "border-hb-aqua bg-cyan-50/40" : "border-slate-200 bg-white"}`}
              key={office.id}
            >
              <p className="text-[13px] font-extrabold leading-[1.4] text-hb-deepNavy">
                {formatListingName(office.displayName)}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-hb-muted">
                {formatAddress(office)}
              </p>
              {providers.length > 0 && (
                <p className="mt-1.5 text-[11px] leading-4 text-hb-navy">
                  <span className="font-bold">Listed {providerLabel} for this specialty:</span>{" "}
                  {providers.slice(0, 2).map((provider) => formatListingName(provider.displayName)).join(", ")}
                  {providers.length > 2 && ` + ${providers.length - 2} more`}
                </p>
              )}
              {office.addressPrecision === "building" && (
                <p className="mt-1 text-[10px] font-semibold leading-4 text-amber-800">
                  Suite or floor details may be incomplete.
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <a
                  aria-label={`Get directions to ${formatListingName(office.displayName)}`}
                  className="inline-flex rounded-md bg-hb-teal px-2.5 py-1.5 text-xs font-bold text-white hover:bg-hb-navy focus:outline-none focus:ring-2 focus:ring-hb-aqua"
                  href={getGoogleMapsUrl(office)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Get directions
                </a>
                {office.phone && (
                  <a
                    aria-label={`Call ${formatListingName(office.displayName)} at ${formatPhoneNumber(office.phone)}`}
                    className="inline-flex rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-hb-navy hover:border-hb-aqua hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-hb-aqua"
                    href={`tel:${office.phone}`}
                  >
                    Call {formatPhoneNumber(office.phone)}
                  </a>
                )}
                <button
                  aria-pressed={isFocused}
                  className="px-1 py-1.5 text-xs font-bold text-hb-teal underline decoration-hb-aqua/60 underline-offset-2 hover:text-hb-navy"
                  onClick={() => onShowOffice(office)}
                  type="button"
                >
                  {isFocused ? "Shown on map" : "Show on map"}
                </button>
              </div>

              <details className="mt-2.5 border-t border-slate-200 pt-2 text-[10px] leading-4 text-hb-muted">
                <summary className="cursor-pointer text-xs font-bold text-hb-deepNavy">
                  See {providers.length} {providerLabel} listed for this specialty
                </summary>
                <ul className="mt-2 space-y-2">
                  {providers.map((provider) => (
                    <li className="rounded-md bg-slate-50 px-2.5 py-2" key={provider.npi}>
                      <p className="text-xs font-bold text-hb-deepNavy">
                        {formatListingName(provider.displayName)}
                        {provider.credentials.length > 0
                          ? `, ${provider.credentials.join("/")}`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-4 text-hb-muted">
                        Specialty listed by CMS: {[...provider.primarySpecialties, ...provider.secondarySpecialties].map(formatListingName).join(", ")}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-4 text-hb-muted">
                        NPI {provider.npi}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
              <details className="mt-2 text-[10px] leading-4 text-hb-muted">
                <summary className="cursor-pointer font-bold text-hb-deepNavy">
                  About this listing
                </summary>
                <p className="mt-1">
                  Listed in the CMS Doctors and Clinicians release from {office.provenance.cmsReleaseDate}.
                  The NPPES deactivation report was checked {office.provenance.nppesCheckedDate}.
                </p>
                <p className="mt-1">
                  The Census geocoder matched this address as {office.provenance.censusGeocoderMatchedAddress}
                  {` (${office.provenance.censusGeocoderMatchType})`} on {office.provenance.censusGeocoderCheckedDate}.
                </p>
                <p className="mt-1">
                  This CMS-based pilot is incomplete. The listing does not confirm
                  that the office is open or accepting appointments.
                </p>
                <a
                  className="mt-1 inline-block font-bold text-hb-teal underline decoration-hb-aqua/60 underline-offset-2"
                  href="https://data.cms.gov/provider-data/dataset/mj5m-pzi6"
                  rel="noreferrer"
                  target="_blank"
                >
                  Open official CMS dataset
                </a>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DoctorOfficeMarkers({
  countyData,
  countyMode,
  listRequestId,
  offices,
  onPanelOpenChange,
  specialtyId
}: DoctorOfficeMarkersProps) {
  const map = useMap();
  const [selectedGroup, setSelectedGroup] = useState<OfficeGroup | null>(null);
  const [focusedOffice, setFocusedOffice] =
    useState<DoctorOfficeLocation | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const lastListRequestId = useRef(0);
  const [viewport, setViewport] = useState(() => ({
    bounds: map.getBounds(),
    zoom: map.getZoom()
  }));

  useMapEvents({
    moveend: () => setViewport({ bounds: map.getBounds(), zoom: map.getZoom() })
  });

  const matchingOffices = useMemo(
    () => offices.filter((office) => office.specialtyIds.includes(specialtyId)),
    [offices, specialtyId]
  );
  const groups = useMemo(() => {
    if (countyMode) return getCountyGroups(matchingOffices, countyData);
    return getLocalGroups(
      matchingOffices.filter((office) =>
        viewport.bounds.contains([office.latitude, office.longitude])
      ),
      map,
      viewport.zoom
    );
  }, [countyData, countyMode, map, matchingOffices, viewport]);
  const panelOpen = Boolean(selectedGroup);

  useEffect(() => {
    setSelectedGroup(null);
    setFocusedOffice(null);
  }, [offices, specialtyId]);

  useEffect(() => {
    if (listRequestId === lastListRequestId.current) return;
    lastListRequestId.current = listRequestId;
    if (listRequestId === 0 || matchingOffices.length === 0) return;
    rememberMarkerFocus();
    setFocusedOffice(null);
    setSelectedGroup({
      id: `doctor-search-${listRequestId}`,
      isSearchResult: true,
      label: null,
      latitude: matchingOffices[0].latitude,
      longitude: matchingOffices[0].longitude,
      offices: matchingOffices
    });
  }, [listRequestId, matchingOffices]);

  useEffect(() => {
    onPanelOpenChange(panelOpen);
    return () => onPanelOpenChange(false);
  }, [onPanelOpenChange, panelOpen]);

  function rememberMarkerFocus(markerElement?: HTMLElement | null) {
    returnFocusRef.current = markerElement ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
  }

  function closePanel() {
    setSelectedGroup(null);
    onPanelOpenChange(false);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  function selectGroup(group: OfficeGroup, markerElement?: HTMLElement | null) {
    rememberMarkerFocus(markerElement);
    setFocusedOffice(null);
    setSelectedGroup(group);
  }

  return <>
    {groups.map((group) => {
      const isCluster = Boolean(group.boundaryFeature) || group.offices.length > 1;
      const title = isCluster
        ? `${group.offices.length} CMS-listed office locations${group.label ? ` in ${group.label}` : ""}`
        : formatListingName(group.offices[0].displayName);
      return (
        <Marker
          eventHandlers={{
            click: (event) => selectGroup(
              group,
              event.target.getElement?.() ?? null
            )
          }}
          icon={isCluster ? getClusterIcon(group.offices.length) : markerIcon}
          key={group.id}
          pane="doctor-office-markers"
          position={[group.latitude, group.longitude]}
          title={title}
          zIndexOffset={isCluster ? 450 : 500}
        />
      );
    })}
    {focusedOffice && (
      <Marker
        eventHandlers={{
          click: (event) => rememberMarkerFocus(
            event.target.getElement?.() ?? null
          )
        }}
        icon={focusedMarkerIcon}
        pane="doctor-office-markers"
        position={[focusedOffice.latitude, focusedOffice.longitude]}
        title={`Selected office location: ${formatListingName(focusedOffice.displayName)}`}
        zIndexOffset={1000}
      />
    )}
    {selectedGroup && (
      <DoctorOfficePanel
        focusedOfficeId={focusedOffice?.id ?? null}
        group={selectedGroup}
        onClose={closePanel}
        onShowOffice={(office) => {
          setFocusedOffice(office);
          map.stop();
          map.flyTo([office.latitude, office.longitude], Math.max(map.getZoom(), 13), { animate: false });
          const mobile = window.matchMedia("(max-width: 639px)").matches;
          map.panBy([
            mobile ? 0 : Math.min(map.getSize().x * 0.17, 190),
            mobile ? Math.min(map.getSize().y * 0.2, 180) : 0
          ], { animate: false });
        }}
        specialtyId={specialtyId}
      />
    )}
  </>;
}

export default memo(DoctorOfficeMarkers);
