import type { TablePoint } from "@/types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export type SceneTableLayout = {
  cardWidth: number;
  cardHeight: number;
  deckPosition: [number, number];
  drawPoint: TablePoint;
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
  const cardWidth = clamp(
    viewportWidth * (isMobile ? 0.22 : 0.12),
    isMobile ? 0.94 : 1.05,
    isMobile ? 1.22 : 1.46
  );
  const cardHeight = cardWidth / cardAspectRatio;
  const horizontalPadding = isMobile ? 0.3 : 0.6;
  const deckX = -viewportWidth / 2 + cardWidth / 2 + horizontalPadding;
  const deckY = isMobile
    ? viewportHeight / 2 - cardHeight / 2 - 0.75
    : 0;
  const tableLeft = deckX + cardWidth / 2 + (isMobile ? 0.32 : 0.72);
  const tableRight = viewportWidth / 2 - horizontalPadding - cardWidth / 2;
  const tableTop = viewportHeight / 2 - cardHeight / 2 - (isMobile ? 1.08 : 1.25);
  const tableBottom =
    -viewportHeight / 2 + cardHeight / 2 + (isMobile ? 1.58 : 1.25);
  const centerX = (tableLeft + tableRight) / 2;
  const centerY = (tableBottom + tableTop) / 2;
  const halfWidth = Math.max((tableRight - tableLeft) / 2, cardWidth / 2);
  const halfHeight = Math.max((tableTop - tableBottom) / 2, cardHeight / 2);

  return {
    cardWidth,
    cardHeight,
    deckPosition: [deckX, deckY],
    drawPoint: isMobile ? [0.14, 0.03] : [-0.3, 0],
    toWorld: ([x, y]) => [centerX + x * halfWidth, centerY + y * halfHeight],
    toPoint: (x, y) => [
      clamp((x - centerX) / halfWidth, -1, 1),
      clamp((y - centerY) / halfHeight, -1, 1),
    ],
  };
}
