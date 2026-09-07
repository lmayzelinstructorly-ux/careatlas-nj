import { Fragment, useEffect, useMemo, useRef } from "react";
import { divIcon, svg } from "leaflet";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import type { LatLngBounds, Layer, Path } from "leaflet";
import { GeoJSON, Marker, Popup, Tooltip } from "react-leaflet";
import type { GeographyData } from "../../hooks/useGeographyData";
import type { SelectedGeography } from "../../types";
import type { TractAccessGapClassification } from "../../types/tractEvidence";
import {
  getTractClassificationStyle,
  getTractClassificationVisual
} from "../../utils/tractClassification";
import { getFeatureInteriorPoint, isPointInFeature } from "./geometry";

type TractPath = Path & {
  getBounds: () => LatLngBounds;
  getElement: () => HTMLElement | undefined;
  bringToFront: () => void;
};

type Props = {
  classifications: TractAccessGapClassification[];
  geography: GeographyData;
  onGeographySelect: (geography: SelectedGeography) => void;
  selectedTractGeoid: string | null;
};

const missingDataFlagIcon = divIcon({
  className: "hb-tract-missing-flag-icon",
  html: `<svg aria-hidden="true" viewBox="0 0 20 24">
    <circle class="hb-tract-missing-flag-icon__anchor" cx="5" cy="21" r="3.8" />
    <path class="hb-tract-missing-flag-icon__pole" d="M5 21V3" />
    <path class="hb-tract-missing-flag-icon__pennant" d="M6 4h11l-3 4L17 12H6Z" />
    <circle class="hb-tract-missing-flag-icon__base" cx="5" cy="21" r="1.7" />
  </svg>`,
  iconAnchor: [5, 21],
  iconSize: [20, 24],
  popupAnchor: [5, -21]
});

function getTractName(
  feature: Feature<Geometry, GeoJsonProperties>,
  classification: TractAccessGapClassification
) {
  return String(
    feature.properties?.NAMELSAD ??
      feature.properties?.NAME ??
      `Census tract ${classification.geography.tractCode}`
  );
}

export function TractClassificationLayer({
  classifications,
  geography,
  onGeographySelect,
  selectedTractGeoid
}: Props) {
  const renderer = useMemo(
    () => svg({ padding: 0.5, pane: "tract-classifications" }),
    []
  );
  const classificationByGeoid = useMemo(
    () => new Map(classifications.map((record) => [record.geography.geoid, record])),
    [classifications]
  );
  const layerByGeoidRef = useRef(new Map<string, TractPath>());
  const insufficientTracts = useMemo(
    () =>
      geography.features.flatMap((feature) => {
        const geoid = String(feature.properties?.GEOID ?? "");
        const classification = classificationByGeoid.get(geoid);
        const point = getFeatureInteriorPoint(feature);
        return classification?.state === "insufficient_evidence" && point
          ? [{
              classification,
              feature,
              point,
              tractName: getTractName(feature, classification)
            }]
          : [];
      }),
    [classificationByGeoid, geography.features]
  );

  useEffect(() => {
    for (const [geoid, layer] of layerByGeoidRef.current) {
      const classification = classificationByGeoid.get(geoid);
      if (!classification) continue;
      layer.setStyle(
        getTractClassificationStyle(
          classification.state,
          geoid === selectedTractGeoid
        )
      );
      if (geoid === selectedTractGeoid) layer.bringToFront();
    }
  }, [classificationByGeoid, selectedTractGeoid]);

  function selectTract(
    feature: Feature<Geometry, GeoJsonProperties>,
    layer: TractPath,
    classification: TractAccessGapClassification
  ) {
    const properties = feature.properties ?? {};
    const fallbackCenter = layer.getBounds().getCenter();
    const latitude = Number(properties.INTPTLAT);
    const longitude = Number(properties.INTPTLON);
    const internalPointIsVisible =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      isPointInFeature(latitude, longitude, feature);
    onGeographySelect({
      countyFips: classification.geography.countyFips,
      feature,
      geoid: classification.geography.geoid,
      latitude: internalPointIsVisible ? latitude : fallbackCenter.lat,
      level: "tracts",
      longitude: internalPointIsVisible ? longitude : fallbackCenter.lng,
      name: getTractName(feature, classification),
      stateAbbr: "NJ",
      stateFips: "34"
    });
  }

  return (
    <Fragment>
      <GeoJSON
      data={geography}
      key={`tract-classifications-${classifications[0]?.geography.countyFips ?? "none"}`}
      pane="tract-classifications"
      onEachFeature={(feature, rawLayer: Layer) => {
        const geoid = String(feature.properties?.GEOID ?? "");
        const classification = classificationByGeoid.get(geoid);
        if (!classification) return;
        const layer = rawLayer as TractPath;
        layerByGeoidRef.current.set(geoid, layer);
        const visual = getTractClassificationVisual(classification.state);
        const label = `${feature.properties?.NAMELSAD ?? feature.properties?.NAME ?? "Census tract"}: ${visual.label}. Select to open the evidence record.`;
        const handleSelect = () => selectTract(feature, layer, classification);
        layer.bindTooltip(label, { direction: "top", opacity: 0.97, sticky: true });
        layer.on({
          click: handleSelect,
          mouseout: () =>
            layer.setStyle(
              getTractClassificationStyle(
                classification.state,
                geoid === selectedTractGeoid
              )
            ),
          mouseover: () => {
            layer.setStyle(
              getTractClassificationStyle(
                classification.state,
                geoid === selectedTractGeoid,
                true
              )
            );
            layer.bringToFront();
          }
        });
        layer.once("add", () => {
          const element = layer.getElement() as HTMLElement | undefined;
          if (!element) return;
          element.setAttribute("tabindex", "0");
          element.setAttribute("role", "button");
          element.setAttribute("aria-label", label);
          element.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleSelect();
            }
          });
        });
      }}
      style={(feature) => {
        const geoid = String(feature?.properties?.GEOID ?? "");
        const classification = classificationByGeoid.get(geoid);
        return classification
          ? {
              ...getTractClassificationStyle(
                classification.state,
                geoid === selectedTractGeoid
              ),
              renderer
            }
          : { fillOpacity: 0, opacity: 0, renderer };
      }}
      />
      {insufficientTracts.map(({ classification, feature, point, tractName }) => (
        <Marker
          eventHandlers={{
            click: () => {
              const layer = layerByGeoidRef.current.get(classification.geography.geoid);
              if (layer) selectTract(feature, layer, classification);
            },
            mouseout: () => {
              const layer = layerByGeoidRef.current.get(classification.geography.geoid);
              layer?.setStyle(
                getTractClassificationStyle(
                  classification.state,
                  classification.geography.geoid === selectedTractGeoid
                )
              );
            },
            mouseover: () => {
              const layer = layerByGeoidRef.current.get(classification.geography.geoid);
              layer?.setStyle(
                getTractClassificationStyle(
                  classification.state,
                  classification.geography.geoid === selectedTractGeoid,
                  true
                )
              );
              layer?.bringToFront();
            }
          }}
          icon={missingDataFlagIcon}
          key={`missing-${classification.geography.geoid}`}
          pane="tract-flags"
          position={[point.latitude, point.longitude]}
          title={`${tractName}: missing required data`}
        >
          <Tooltip direction="top" offset={[5, -18]} opacity={0.97}>
            <strong>{tractName}</strong>
            <br />
            Missing required data in this tract
          </Tooltip>
          <Popup>
            <div className="max-w-[15rem] text-sm leading-5 text-slate-700">
              <p className="font-bold text-hb-deepNavy">{tractName}</p>
              <p className="mt-1 font-semibold text-amber-900">Not enough information</p>
              <p className="mt-1">
                {classification.findings.missingRequiredMeasureIds.length} required value{classification.findings.missingRequiredMeasureIds.length === 1 ? " is" : "s are"} missing here. CareAtlas keeps missing data unknown instead of guessing.
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </Fragment>
  );
}

export function BoundaryOutlineLayer({ geography }: { geography: GeographyData }) {
  return (
    <GeoJSON
      data={geography}
      interactive={false}
      pane="boundary-outlines"
      style={{
        color: "#143B53",
        fillOpacity: 0,
        opacity: 0.92,
        weight: 2.3
      }}
    />
  );
}
