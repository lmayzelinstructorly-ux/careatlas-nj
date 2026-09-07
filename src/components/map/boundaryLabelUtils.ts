import type { GeographyLevel } from "../../geographyLayers";
import { geographyLayerConfigs } from "../../geographyLayers";

export type BoundaryLabel = {
  area: number;
  fullText: string;
  key: string;
  latitude: number;
  longitude: number;
  text: string;
};

export type BoundaryLabelLayoutCandidate = BoundaryLabel & {
  pixelX: number;
  pixelY: number;
};

type BoundaryLabelBox = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type MapViewportSize = {
  height: number;
  width: number;
};

const labelViewportPadding = 12;
const labelHorizontalGap = 8;
const labelVerticalGap = 6;
let labelMeasureContext: CanvasRenderingContext2D | null | undefined;

function getLabelMeasureContext() {
  if (labelMeasureContext !== undefined) {
    return labelMeasureContext;
  }

  labelMeasureContext =
    typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d");

  return labelMeasureContext;
}

function getEstimatedLabelSize(level: GeographyLevel, text: string) {
  const isCounty = level === "counties";
  const isTown = level === "towns";
  const fontSize = isCounty ? 11.2 : isTown ? 10.4 : 12.48;
  const averageCharacterWidth = isCounty ? 0.64 : isTown ? 0.6 : 0.61;
  const letterSpacing = isCounty ? 0.39 : 0;
  const horizontalPadding = isTown || isCounty ? 15.5 : 16;
  const measuredText = isCounty ? text.toUpperCase() : text;
  const measureContext = getLabelMeasureContext();
  const fallbackTextWidth =
    measuredText.length * fontSize * averageCharacterWidth;

  if (measureContext) {
    measureContext.font = `850 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  }
  const textWidth = measureContext
    ? measureContext.measureText(measuredText).width
    : fallbackTextWidth;

  return {
    height: isTown || isCounty ? 20 : 22,
    width:
      textWidth +
      Math.max(0, measuredText.length - 1) * letterSpacing +
      horizontalPadding
  };
}

function getBoundaryLabelBox(
  candidate: BoundaryLabelLayoutCandidate,
  level: GeographyLevel
): BoundaryLabelBox {
  const size = getEstimatedLabelSize(level, candidate.text);

  return {
    bottom: candidate.pixelY + size.height / 2,
    left: candidate.pixelX - size.width / 2,
    right: candidate.pixelX + size.width / 2,
    top: candidate.pixelY - size.height / 2
  };
}

function isBoxInsideViewport(box: BoundaryLabelBox, viewport: MapViewportSize) {
  return (
    box.left >= labelViewportPadding &&
    box.right <= viewport.width - labelViewportPadding &&
    box.top >= labelViewportPadding &&
    box.bottom <= viewport.height - labelViewportPadding
  );
}

function doLabelBoxesOverlap(first: BoundaryLabelBox, second: BoundaryLabelBox) {
  return !(
    first.right + labelHorizontalGap <= second.left ||
    second.right + labelHorizontalGap <= first.left ||
    first.bottom + labelVerticalGap <= second.top ||
    second.bottom + labelVerticalGap <= first.top
  );
}

export function canDisplayAllBoundaryLabels(
  candidates: BoundaryLabelLayoutCandidate[],
  level: GeographyLevel,
  viewport: MapViewportSize
) {
  if (candidates.length === 0) {
    return false;
  }

  const boxes = candidates.map((candidate) =>
    getBoundaryLabelBox(candidate, level)
  );

  if (boxes.some((box) => !isBoxInsideViewport(box, viewport))) {
    return false;
  }

  for (let firstIndex = 0; firstIndex < boxes.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < boxes.length;
      secondIndex += 1
    ) {
      if (doLabelBoxesOverlap(boxes[firstIndex], boxes[secondIndex])) {
        return false;
      }
    }
  }

  return true;
}

export function shouldShowBoundaryLabels(level: GeographyLevel, zoom: number) {
  if (level === "states") {
    return zoom <= geographyLayerConfigs.states.maxZoom;
  }

  if (level === "counties") {
    return (
      zoom >= geographyLayerConfigs.counties.minZoom &&
      zoom <= geographyLayerConfigs.counties.maxZoom
    );
  }

  return zoom >= geographyLayerConfigs.towns.minZoom;
}

export function getBoundaryLabelOpacity(level: GeographyLevel, zoom: number) {
  if (level === "states") {
    return 1;
  }

  if (level === "counties") {
    return zoom <= 6 ? 0.88 : 0.94;
  }

  if (zoom <= 8) {
    return 0.88;
  }

  if (zoom <= 9) {
    return 0.91;
  }

  if (zoom <= 11) {
    return 0.94;
  }

  return 0.97;
}
