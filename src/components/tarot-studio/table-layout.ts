import type { TablePoint } from "@/types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export type SceneTableLayout = {
  cardWidth: number;
  cardHeight: number;
  deckPosition: [number, number];
  toPoint: (x: number, y: number) => TablePoint;
  toWorld: (point: TablePoint) => [number, number];
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
  const requestedCardWidth = clamp(
    viewportWidth * (isMobile ? 0.44 : 0.24),
    isMobile ? 1.88 : 2.1,
    isMobile ? 2.44 : 2.92
  );
  const verticalUiReserve = isMobile ? 2.75 : 2.15;
  const widthAllowedByHeight = Math.max(
    1.2,
    Math.max(0, viewportHeight - verticalUiReserve) * cardAspectRatio
  );
  const cardWidth = Math.min(requestedCardWidth, widthAllowedByHeight);
  const cardHeight = cardWidth / cardAspectRatio;
  const horizontalPadding = isMobile ? 0.18 : 0.42;
  const deckX = -viewportWidth / 2 + cardWidth / 2 + horizontalPadding;
  const deckY = isMobile
    ? viewportHeight * 0.08
    : -Math.min(viewportHeight * 0.16, 1.9);
  const tableLeft = deckX + cardWidth / 2 + (isMobile ? 0.34 : 0.54);
  const tableRight = viewportWidth / 2 - horizontalPadding - cardWidth / 2;
  const tableTop = viewportHeight / 2 - cardHeight / 2 - (isMobile ? 0.55 : 0.6);
  const tableBottom =
    -viewportHeight / 2 + cardHeight / 2 + (isMobile ? 1.72 : 1.08);
  const centerX = (tableLeft + tableRight) / 2;
  const centerY = (tableBottom + tableTop) / 2;
  const halfWidth = Math.max((tableRight - tableLeft) / 2, cardWidth / 2);
  const halfHeight = Math.max((tableTop - tableBottom) / 2, cardHeight / 2);

  return {
    cardWidth,
    cardHeight,
    deckPosition: [deckX, deckY],
    toWorld: ([x, y]) => [centerX + x * halfWidth, centerY + y * halfHeight],
    toPoint: (x, y) => [
      clamp((x - centerX) / halfWidth, -1, 1),
      clamp((y - centerY) / halfHeight, -1, 1),
    ],
  };
}
