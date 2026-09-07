import { Pane, Rectangle } from "react-leaflet";
import { outsideFocusMaskBounds } from "./mapConstants";

type OutsideFocusMaskLayerProps = {
  isVisible: boolean;
};

export function OutsideFocusMaskLayer({ isVisible }: OutsideFocusMaskLayerProps) {
  const maskStyle = {
    fillColor: "#F5FAFB",
    fillOpacity: isVisible ? 0.82 : 0,
    opacity: 0,
    stroke: false
  };

  return (
    <Pane name="outside-focus-mask" style={{ zIndex: 325 }}>
      {Object.entries(outsideFocusMaskBounds).map(([key, bounds]) => (
        <Rectangle
          bounds={bounds}
          interactive={false}
          key={key}
          pathOptions={maskStyle}
        />
      ))}
    </Pane>
  );
}
