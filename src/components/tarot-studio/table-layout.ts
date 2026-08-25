import type { TablePoint } from "@/types";
import { TABLE_POINT_LIMIT } from "@/types";

export const MIN_VIEW_ZOOM = 0.35;
export const MAX_VIEW_ZOOM = 1.35;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export type SceneTableLayout = {
  cardWidth: number;
  cardHeight: number;
  defaultDeckPosition: TablePoint;
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
    viewportWidth * (isMobile ? 0.66 : 0.36),
    isMobile ? 2.82 : 3.15,
    isMobile ? 3.66 : 4.38
  );
  const verticalUiReserve = isMobile ? 3.2 : 2.35;
  const widthAllowedByHeight = Math.max(
    1.2,
    Math.max(0, viewportHeight - verticalUiReserve) * cardAspectRatio
  );
  const cardWidth = Math.min(requestedCardWidth, widthAllowedByHeight);
  const cardHeight = cardWidth / cardAspectRatio;
  const horizontalPadding = isMobile ? 0.18 : 0.42;
  const tableLeft = -viewportWidth / 2 + horizontalPadding;
  const tableRight = viewportWidth / 2 - horizontalPadding;
  const tableTop = viewportHeight / 2 - (isMobile ? 0.7 : 0.75);
  const tableBottom = -viewportHeight / 2 + (isMobile ? 2.15 : 1.35);
  const centerX = (tableLeft + tableRight) / 2;
  const centerY = (tableBottom + tableTop) / 2;
  const halfWidth = Math.max((tableRight - tableLeft) / 2, cardWidth / 2);
  const halfHeight = Math.max((tableTop - tableBottom) / 2, cardHeight / 2);
  const defaultDeckWorldX = tableRight - cardWidth / 2 - 0.12;
  const defaultDeckWorldY = tableTop - cardHeight / 2 - 0.95;
  const defaultDeckPosition: TablePoint = isMobile
    ? [0, 0]
    : [
        clamp(
          (defaultDeckWorldX - centerX) / halfWidth,
          -TABLE_POINT_LIMIT,
          TABLE_POINT_LIMIT
        ),
        clamp(
          (defaultDeckWorldY - centerY) / halfHeight,
          -TABLE_POINT_LIMIT,
          TABLE_POINT_LIMIT
        ),
      ];

  return {
    cardWidth,
    cardHeight,
    defaultDeckPosition,
    toWorld: ([x, y]) => [centerX + x * halfWidth, centerY + y * halfHeight],
    toPoint: (x, y) => [
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
    ],
  };
}
