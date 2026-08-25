import type { TablePoint } from "@/types";
import { DECK_POINT_LIMIT, TABLE_POINT_LIMIT } from "@/types";

export const MIN_VIEW_ZOOM = 0.3;
export const MAX_VIEW_ZOOM = 1.35;
export const TABLE_SURFACE_OVERSCAN = 1.04;
export const DECK_MAT_WIDTH_PADDING = 0.58;
export const DECK_MAT_HEIGHT_PADDING = 0.64;
const CARD_SCALE_AT_100_PERCENT = 0.8;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export type SceneTableLayout = {
  cardWidth: number;
  cardHeight: number;
  /** The camera's unzoomed world-space bounds. */
  viewportBounds: SceneBounds;
  /** The world-space limits used when card and deck positions are clamped. */
  dragBounds: SceneBounds;
  defaultDeckPosition: TablePoint;
  /**
   * Stable deck locations used when a spread needs to keep the deck out of
   * the cards' way. The first candidate is also the resting position for a
   * new deck.
   */
  deckPositionCandidates: DeckPositionCandidate[];
  toPoint: (x: number, y: number) => TablePoint;
  /** Converts a planner position using the deck's wider parking range. */
  toDeckPoint: (x: number, y: number) => TablePoint;
  toWorld: (point: TablePoint) => [number, number];
};

export type SceneBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type DeckPositionCandidate = {
  id:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "left"
    | "right";
  position: TablePoint;
  worldPosition: [number, number];
};

export function getViewPanBounds(
  viewportBounds: SceneBounds,
  viewZoom: number
): SceneBounds {
  const zoom = clamp(
    Number.isFinite(viewZoom) ? viewZoom : 1,
    MIN_VIEW_ZOOM,
    MAX_VIEW_ZOOM
  );
  const viewportWidth = viewportBounds.right - viewportBounds.left;
  const viewportHeight = viewportBounds.top - viewportBounds.bottom;
  const surfaceHalfWidth =
    (viewportWidth / MIN_VIEW_ZOOM) * TABLE_SURFACE_OVERSCAN * 0.5;
  const surfaceHalfHeight =
    (viewportHeight / MIN_VIEW_ZOOM) * TABLE_SURFACE_OVERSCAN * 0.5;
  const visibleHalfWidth = viewportWidth / zoom / 2;
  const visibleHalfHeight = viewportHeight / zoom / 2;
  const maximumX = Math.max(0, surfaceHalfWidth - visibleHalfWidth);
  const maximumY = Math.max(0, surfaceHalfHeight - visibleHalfHeight);

  return {
    left: -maximumX,
    right: maximumX,
    top: maximumY,
    bottom: -maximumY,
  };
}

export function clampViewPan(
  pan: TablePoint,
  viewportBounds: SceneBounds,
  viewZoom: number
): TablePoint {
  const bounds = getViewPanBounds(viewportBounds, viewZoom);
  const x = Number.isFinite(pan[0]) ? pan[0] : 0;
  const y = Number.isFinite(pan[1]) ? pan[1] : 0;

  return [
    clamp(x, bounds.left, bounds.right),
    clamp(y, bounds.bottom, bounds.top),
  ];
}

export function createSceneTableLayout({
  viewportWidth,
  viewportHeight,
  pixelWidth,
  cardAspectRatio,
}: {
  viewportWidth: number;
  viewportHeight: number;
  pixelWidth: number;
  cardAspectRatio: number;
}): SceneTableLayout {
  const isMobile = pixelWidth < 720;
  const unscaledRequestedCardWidth = clamp(
    viewportWidth * (isMobile ? 0.66 : 0.36),
    isMobile ? 2.82 : 3.15,
    isMobile ? 3.66 : 4.38
  );
  const verticalUiReserve = isMobile ? 3.2 : 2.35;
  const unscaledWidthAllowedByHeight = Math.max(
    1.2,
    Math.max(0, viewportHeight - verticalUiReserve) * cardAspectRatio
  );
  const cardWidth =
    Math.min(
      unscaledRequestedCardWidth,
      unscaledWidthAllowedByHeight
    ) * CARD_SCALE_AT_100_PERCENT;
  const cardHeight = cardWidth / cardAspectRatio;
  const horizontalPadding = isMobile ? 0.18 : 0.42;
  const tableLeft = -viewportWidth / 2 + horizontalPadding;
  const tableRight = viewportWidth / 2 - horizontalPadding;
  const tableTop = viewportHeight / 2 - (isMobile ? 0.7 : 0.75);
  const tableBottom = -viewportHeight / 2 + (isMobile ? 2.15 : 1.35);
  const viewportBounds: SceneBounds = {
    left: -viewportWidth / 2,
    right: viewportWidth / 2,
    top: viewportHeight / 2,
    bottom: -viewportHeight / 2,
  };
  const centerX = (tableLeft + tableRight) / 2;
  const centerY = (tableBottom + tableTop) / 2;
  const halfWidth = Math.max((tableRight - tableLeft) / 2, cardWidth / 2);
  const halfHeight = Math.max((tableTop - tableBottom) / 2, cardHeight / 2);
  const deckSideInset = 0.12;
  const deckVerticalInset = isMobile ? 0.58 : 0.95;
  const deckWidth = cardWidth + DECK_MAT_WIDTH_PADDING;
  const deckHeight = cardHeight + DECK_MAT_HEIGHT_PADDING;
  const toLimitedPoint = (
    x: number,
    y: number,
    limit: number
  ): TablePoint => [
    clamp(
      (x - centerX) / halfWidth,
      -limit,
      limit
    ),
    clamp(
      (y - centerY) / halfHeight,
      -limit,
      limit
    ),
  ];
  const toPoint = (x: number, y: number): TablePoint =>
    toLimitedPoint(x, y, TABLE_POINT_LIMIT);
  const toDeckPoint = (x: number, y: number): TablePoint =>
    toLimitedPoint(x, y, DECK_POINT_LIMIT);
  const toWorld = ([x, y]: TablePoint): [number, number] => [
    centerX + x * halfWidth,
    centerY + y * halfHeight,
  ];
  const [dragLeft, dragBottom] = toWorld([
    -TABLE_POINT_LIMIT,
    -TABLE_POINT_LIMIT,
  ]);
  const [dragRight, dragTop] = toWorld([
    TABLE_POINT_LIMIT,
    TABLE_POINT_LIMIT,
  ]);
  const dragBounds: SceneBounds = {
    left: dragLeft,
    right: dragRight,
    top: dragTop,
    bottom: dragBottom,
  };
  const createDeckCandidate = (
    id: DeckPositionCandidate["id"],
    x: number,
    y: number
  ): DeckPositionCandidate => ({
    id,
    position: toPoint(x, y),
    worldPosition: [x, y],
  });
  const deckPositionCandidates: DeckPositionCandidate[] = [
    createDeckCandidate(
      "top-left",
      tableLeft + deckWidth / 2 + deckSideInset,
      tableTop - deckHeight / 2 - deckVerticalInset
    ),
    createDeckCandidate(
      "top-right",
      tableRight - deckWidth / 2 - deckSideInset,
      tableTop - deckHeight / 2 - deckVerticalInset
    ),
    createDeckCandidate(
      "bottom-left",
      tableLeft + deckWidth / 2 + deckSideInset,
      tableBottom + deckHeight / 2 + deckSideInset
    ),
    createDeckCandidate(
      "bottom-right",
      tableRight - deckWidth / 2 - deckSideInset,
      tableBottom + deckHeight / 2 + deckSideInset
    ),
    createDeckCandidate(
      "left",
      tableLeft + deckWidth / 2 + deckSideInset,
      centerY
    ),
    createDeckCandidate(
      "right",
      tableRight - deckWidth / 2 - deckSideInset,
      centerY
    ),
  ];
  const defaultDeckPosition = deckPositionCandidates[0].position;

  return {
    cardWidth,
    cardHeight,
    viewportBounds,
    dragBounds,
    defaultDeckPosition,
    deckPositionCandidates,
    toWorld,
    toPoint,
    toDeckPoint,
  };
}
