import type {
  SceneBounds,
  SceneTableLayout,
} from "@/components/tarot-studio/table-layout";
import {
  DECK_MAT_HEIGHT_PADDING,
  DECK_MAT_WIDTH_PADDING,
  MAX_VIEW_ZOOM,
  MIN_VIEW_ZOOM,
} from "@/components/tarot-studio/table-layout";
import type { TablePoint } from "@/types";

export type AutomaticCardPlacement = {
  position: TablePoint;
  rotation: number;
};

export type ArrangementPresentation = {
  deckPosition: TablePoint;
  zoom: number;
};

type ArrangementPresentationOptions = {
  includeDeck?: boolean;
  preferredDeckPosition?: TablePoint | null;
};

type ScoredDeckCandidate = ArrangementPresentation & {
  overlap: number;
};

const MEANINGFUL_ZOOM_GAIN = 0.04;
const OVERLAP_EPSILON = 0.0001;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const emptyBounds = (): SceneBounds => ({
  left: Number.POSITIVE_INFINITY,
  right: Number.NEGATIVE_INFINITY,
  top: Number.NEGATIVE_INFINITY,
  bottom: Number.POSITIVE_INFINITY,
});

const includeBounds = (bounds: SceneBounds, next: SceneBounds): SceneBounds => ({
  left: Math.min(bounds.left, next.left),
  right: Math.max(bounds.right, next.right),
  top: Math.max(bounds.top, next.top),
  bottom: Math.min(bounds.bottom, next.bottom),
});

const overlapArea = (first: SceneBounds, second: SceneBounds) =>
  Math.max(
    0,
    Math.min(first.right, second.right) - Math.max(first.left, second.left)
  ) *
  Math.max(
    0,
    Math.min(first.top, second.top) - Math.max(first.bottom, second.bottom)
  );

function getCenteredBounds(
  position: [number, number],
  width: number,
  height: number
): SceneBounds {
  return {
    left: position[0] - width / 2,
    right: position[0] + width / 2,
    top: position[1] + height / 2,
    bottom: position[1] - height / 2,
  };
}

/** Returns the world-space axis-aligned bounds of a rotated card. */
export function getRotatedCardBounds(
  position: [number, number],
  rotation: number,
  cardWidth: number,
  cardHeight: number
): SceneBounds {
  const radians = (rotation * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const halfWidth = (cosine * cardWidth + sine * cardHeight) / 2;
  const halfHeight = (sine * cardWidth + cosine * cardHeight) / 2;

  return {
    left: position[0] - halfWidth,
    right: position[0] + halfWidth,
    top: position[1] + halfHeight,
    bottom: position[1] - halfHeight,
  };
}

function getZoomForBounds(bounds: SceneBounds, layout: SceneTableLayout) {
  const horizontalPadding = layout.cardWidth * 0.16;
  // Keep the lowest card and deck mat clear of the auto-hiding dock even
  // while the controls are visible.
  const verticalPadding = layout.cardHeight * 0.46;
  const requiredHalfWidth =
    Math.max(Math.abs(bounds.left), Math.abs(bounds.right)) +
    horizontalPadding;
  const requiredHalfHeight =
    Math.max(Math.abs(bounds.top), Math.abs(bounds.bottom)) +
    verticalPadding;
  const viewportHalfWidth =
    (layout.viewportBounds.right - layout.viewportBounds.left) / 2;
  const viewportHalfHeight =
    (layout.viewportBounds.top - layout.viewportBounds.bottom) / 2;
  const fittingZoom = Math.min(
    viewportHalfWidth / Math.max(requiredHalfWidth, Number.EPSILON),
    viewportHalfHeight / Math.max(requiredHalfHeight, Number.EPSILON)
  );

  return clamp(Math.min(1, fittingZoom), MIN_VIEW_ZOOM, MAX_VIEW_ZOOM);
}

function getPerimeterCandidates(
  bounds: SceneBounds,
  deckWidth: number,
  deckHeight: number,
  layout: SceneTableLayout
): TablePoint[] {
  const halfDeckWidth = deckWidth / 2;
  const halfDeckHeight = deckHeight / 2;
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const leftX = bounds.left - halfDeckWidth;
  const rightX = bounds.right + halfDeckWidth;
  const topY = bounds.top + halfDeckHeight;
  const bottomY = bounds.bottom - halfDeckHeight;
  const leftAlignedX = bounds.left + halfDeckWidth;
  const rightAlignedX = bounds.right - halfDeckWidth;
  const topAlignedY = bounds.top - halfDeckHeight;
  const bottomAlignedY = bounds.bottom + halfDeckHeight;
  const worldPositions: [number, number][] = [
    [leftX, topAlignedY],
    [leftX, centerY],
    [leftX, bottomAlignedY],
    [rightX, topAlignedY],
    [rightX, centerY],
    [rightX, bottomAlignedY],
    [leftAlignedX, topY],
    [centerX, topY],
    [rightAlignedX, topY],
    [leftAlignedX, bottomY],
    [centerX, bottomY],
    [rightAlignedX, bottomY],
  ];

  return worldPositions.map(([x, y]) => layout.toDeckPoint(x, y));
}

function deduplicatePoints(points: TablePoint[]): TablePoint[] {
  const seen = new Set<string>();

  return points.filter((point) => {
    const key = `${point[0].toFixed(6)}:${point[1].toFixed(6)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * Plans a deck position from the final automatic card footprints. The padded
 * deck rectangle includes the whole mat and a visible gutter, so a zero-area
 * result also means the rendered deck cannot touch a placed card.
 */
export function getArrangementPresentation(
  placements: readonly AutomaticCardPlacement[],
  layout: SceneTableLayout,
  {
    includeDeck = true,
    preferredDeckPosition = null,
  }: ArrangementPresentationOptions = {}
): ArrangementPresentation {
  const cardBounds = placements.map((placement) =>
    getRotatedCardBounds(
      layout.toWorld(placement.position),
      placement.rotation,
      layout.cardWidth,
      layout.cardHeight
    )
  );
  const arrangementBounds = cardBounds.reduce(includeBounds, emptyBounds());

  if (cardBounds.length === 0) {
    return {
      deckPosition: [
        ...(preferredDeckPosition ?? layout.defaultDeckPosition),
      ] as TablePoint,
      zoom: 1,
    };
  }

  if (!includeDeck) {
    return {
      deckPosition: [
        ...(preferredDeckPosition ?? layout.defaultDeckPosition),
      ] as TablePoint,
      zoom: getZoomForBounds(arrangementBounds, layout),
    };
  }

  const deckGap = Math.max(
    0.12,
    Math.min(layout.cardWidth, layout.cardHeight) * 0.08
  );
  const paddedDeckWidth =
    layout.cardWidth + DECK_MAT_WIDTH_PADDING + deckGap * 2;
  const paddedDeckHeight =
    layout.cardHeight + DECK_MAT_HEIGHT_PADDING + deckGap * 2;
  const candidatePoints = deduplicatePoints([
    ...(preferredDeckPosition
      ? [[...preferredDeckPosition] as TablePoint]
      : []),
    ...layout.deckPositionCandidates.map(
      (candidate) => [...candidate.position] as TablePoint
    ),
    ...getPerimeterCandidates(
      arrangementBounds,
      paddedDeckWidth,
      paddedDeckHeight,
      layout
    ),
  ]);
  const candidates: ScoredDeckCandidate[] = candidatePoints.map((position) => {
    const deckBounds = getCenteredBounds(
      layout.toWorld(position),
      paddedDeckWidth,
      paddedDeckHeight
    );
    const combinedBounds = includeBounds(arrangementBounds, deckBounds);

    return {
      deckPosition: position,
      zoom: getZoomForBounds(combinedBounds, layout),
      overlap: cardBounds.reduce(
        (total, bounds) => total + overlapArea(bounds, deckBounds),
        0
      ),
    };
  });
  const clearCandidates = candidates.filter(
    (candidate) => candidate.overlap <= OVERLAP_EPSILON
  );
  const eligibleCandidates =
    clearCandidates.length > 0 ? clearCandidates : candidates;
  const bestCandidate = eligibleCandidates.reduce((best, candidate) =>
    candidate.zoom > best.zoom + MEANINGFUL_ZOOM_GAIN ? candidate : best
  );

  return {
    deckPosition: [...bestCandidate.deckPosition] as TablePoint,
    zoom: bestCandidate.zoom,
  };
}
