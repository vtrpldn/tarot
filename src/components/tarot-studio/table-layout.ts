import type { TablePoint } from "@/types";
import { TABLE_POINT_LIMIT } from "@/types";

export const MIN_VIEW_ZOOM = 0.3;
export const MAX_VIEW_ZOOM = 1.35;
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
  const toPoint = (x: number, y: number): TablePoint => [
    clamp(
      (x - centerX) / halfWidth,
      -TABLE_POINT_LIMIT,
      TABLE_POINT_LIMIT
    ),
    clamp(
      (y - centerY) / halfHeight,
      -TABLE_POINT_LIMIT,
      TABLE_POINT_LIMIT
    ),
  ];
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
      tableLeft + cardWidth / 2 + deckSideInset,
      tableTop - cardHeight / 2 - deckVerticalInset
    ),
    createDeckCandidate(
      "top-right",
      tableRight - cardWidth / 2 - deckSideInset,
      tableTop - cardHeight / 2 - deckVerticalInset
    ),
    createDeckCandidate(
      "bottom-left",
      tableLeft + cardWidth / 2 + deckSideInset,
      tableBottom + cardHeight / 2 + deckSideInset
    ),
    createDeckCandidate(
      "bottom-right",
      tableRight - cardWidth / 2 - deckSideInset,
      tableBottom + cardHeight / 2 + deckSideInset
    ),
    createDeckCandidate(
      "left",
      tableLeft + cardWidth / 2 + deckSideInset,
      centerY
    ),
    createDeckCandidate(
      "right",
      tableRight - cardWidth / 2 - deckSideInset,
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
  };
}
