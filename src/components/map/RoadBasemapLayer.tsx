import { TileLayer } from "react-leaflet";
import { mainlandUsBounds } from "../../mapBounds";
import { roadLayerConfigs } from "./mapConstants";
import type { RoadMode } from "./mapTypes";
import { OutsideFocusMaskLayer } from "./OutsideFocusMaskLayer";

type RoadBasemapLayerProps = {
  roadMode: RoadMode;
};

export function RoadBasemapLayer({ roadMode }: RoadBasemapLayerProps) {
  const roadLayerConfig = roadLayerConfigs[roadMode];

  if (!roadLayerConfig) {
    return null;
  }

  return (
    <>
      <TileLayer
        attribution={roadLayerConfig.attribution}
        bounds={mainlandUsBounds}
        eventHandlers={{
          add: (event) => {
            event.target.setOpacity(roadLayerConfig.opacity);
          }
        }}
        key={roadMode}
        keepBuffer={1}
        noWrap={true}
        opacity={roadLayerConfig.opacity}
        pane="road-basemap"
        updateWhenIdle={true}
        updateWhenZooming={false}
        url={roadLayerConfig.url}
      />
      <OutsideFocusMaskLayer isVisible={true} />
    </>
  );
}
