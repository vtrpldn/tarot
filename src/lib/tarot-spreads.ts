import type { CardSetKind, TablePoint } from "@/types";
import {
  MAX_VIEW_ZOOM,
  MIN_VIEW_ZOOM,
  type SceneBounds,
  type SceneTableLayout,
} from "@/components/tarot-studio/table-layout";

export type TarotSpreadSlot = {
  position: TablePoint;
  rotation: number;
};

export type TarotSpreadId =
  | "one-card"
  | "three-card"
  | "horseshoe"
  | "celtic-cross";

export type LenormandSpreadId =
  | "lenormand-three-card"
  | "lenormand-five-card"
  | "lenormand-portrait"
  | "lenormand-grand-tableau";

export type CardSpreadId = TarotSpreadId | LenormandSpreadId;

export type CardSpread = {
  id: CardSpreadId;
  label: string;
  shortLabel: string;
  slots: TarotSpreadSlot[];
};

/** A spread whose positions suit the taller tarot card format. */
export type TarotSpread = CardSpread & {
  id: TarotSpreadId;
};

/** A spread whose positions suit the compact, 36-card Lenormand tableau. */
export type LenormandSpread = CardSpread & {
  id: LenormandSpreadId;
};

export type SpreadPresentation = {
  deckPosition: TablePoint;
  zoom: number;
};

type SpreadCandidate = SpreadPresentation & {
  overlap: number;
};

const MEANINGFUL_ZOOM_GAIN = 0.04;

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

/**
 * Returns the world-space axis-aligned bounds of a card after its table
 * rotation. It intentionally uses the final footprint, not an unrotated
 * approximation, so a fanned spread cannot be clipped at its corners.
 */
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

function getSpreadCardBounds(
  spread: CardSpread,
  layout: SceneTableLayout
) {
  return spread.slots.map((slot) => {
    const worldPosition = layout.toWorld(slot.position);

    return getRotatedCardBounds(
      worldPosition,
      slot.rotation,
      layout.cardWidth,
      layout.cardHeight
    );
  });
}

function getSpreadBounds(cardBounds: SceneBounds[]) {
  return cardBounds.reduce(includeBounds, emptyBounds());
}

function getZoomForBounds(bounds: SceneBounds, layout: SceneTableLayout) {
  const horizontalPadding = layout.cardWidth * 0.16;
  const verticalPadding = layout.cardHeight * 0.3;
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

/**
 * Chooses an edge position for the deck and the view zoom needed to show a
 * dealt spread. Overlap is weighted first; among clear placements, the one
 * requiring the least zoom-out wins. It is pure so the session can apply the
 * returned deck position and the UI can animate to the returned zoom.
 */
export function getSpreadPresentation(
  spread: CardSpread,
  layout: SceneTableLayout
): SpreadPresentation {
  if (spread.slots.length === 0) {
    return {
      deckPosition: [...layout.defaultDeckPosition] as TablePoint,
      zoom: clamp(1, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM),
    };
  }

  const spreadCardBounds = getSpreadCardBounds(spread, layout);
  const spreadBounds = getSpreadBounds(spreadCardBounds);
  const spreadCenterX = (spreadBounds.left + spreadBounds.right) / 2;
  const spreadCenterY = (spreadBounds.top + spreadBounds.bottom) / 2;
  const spreadGap = Math.min(layout.cardWidth, layout.cardHeight) * 0.18;
  const spreadEdgePositions: TablePoint[] = [
    layout.toPoint(
      spreadCenterX,
      spreadBounds.top + layout.cardHeight / 2 + spreadGap
    ),
    layout.toPoint(
      spreadBounds.left - layout.cardWidth / 2 - spreadGap,
      spreadCenterY
    ),
    layout.toPoint(
      spreadBounds.right + layout.cardWidth / 2 + spreadGap,
      spreadCenterY
    ),
    layout.toPoint(
      spreadCenterX,
      spreadBounds.bottom - layout.cardHeight / 2 - spreadGap
    ),
  ];
  const deckCandidates = [
    ...spreadEdgePositions.map((position) => ({
      position,
      worldPosition: layout.toWorld(position),
    })),
    ...layout.deckPositionCandidates,
  ];
  const candidates: SpreadCandidate[] = deckCandidates.map(
    (candidate) => {
      const deckBounds = getRotatedCardBounds(
        candidate.worldPosition,
        0,
        layout.cardWidth,
        layout.cardHeight
      );
      const bounds = includeBounds(spreadBounds, deckBounds);

      return {
        deckPosition: candidate.position,
        zoom: getZoomForBounds(bounds, layout),
        overlap: spreadCardBounds.reduce(
          (total, cardBounds) => total + overlapArea(cardBounds, deckBounds),
          0
        ),
      };
    }
  );
  const bestCandidate = candidates.reduce((best, candidate) => {
    const overlapDifference = candidate.overlap - best.overlap;

    if (Math.abs(overlapDifference) > 0.0001) {
      return overlapDifference < 0 ? candidate : best;
    }

    return candidate.zoom > best.zoom + MEANINGFUL_ZOOM_GAIN
      ? candidate
      : best;
  });

  return {
    deckPosition: [...bestCandidate.deckPosition] as TablePoint,
    zoom: bestCandidate.zoom,
  };
}

export const popularTarotSpreads: TarotSpread[] = [
  {
    id: "one-card",
    label: "One card",
    shortLabel: "1 card",
    slots: [{ position: [0, 0], rotation: 0 }],
  },
  {
    id: "three-card",
    label: "Past · Present · Future",
    shortLabel: "3 cards",
    slots: [
      { position: [-0.52, -0.04], rotation: -5 },
      { position: [0, 0.03], rotation: 0 },
      { position: [0.52, -0.04], rotation: 5 },
    ],
  },
  {
    id: "horseshoe",
    label: "Horseshoe",
    shortLabel: "7 cards",
    slots: [
      { position: [-1.08, -0.85], rotation: -14 },
      { position: [-0.98, 0.32], rotation: -10 },
      { position: [-0.5, 1.15], rotation: -5 },
      { position: [0, 1.47], rotation: 0 },
      { position: [0.5, 1.15], rotation: 5 },
      { position: [0.98, 0.32], rotation: 10 },
      { position: [1.08, -0.85], rotation: 14 },
    ],
  },
  {
    id: "celtic-cross",
    label: "Celtic Cross",
    shortLabel: "10 cards",
    slots: [
      { position: [-0.58, 0], rotation: 0 },
      { position: [-0.58, 0], rotation: 90 },
      { position: [-0.58, 1.28], rotation: 0 },
      { position: [-0.58, -1.28], rotation: 0 },
      { position: [-1.14, 0], rotation: 0 },
      { position: [-0.02, 0], rotation: 0 },
      { position: [0.98, -1.84], rotation: 0 },
      { position: [0.98, -0.61], rotation: 0 },
      { position: [0.98, 0.61], rotation: 0 },
      { position: [0.98, 1.84], rotation: 0 },
    ],
  },
];

export const popularLenormandSpreads: LenormandSpread[] = [
  {
    id: "lenormand-three-card",
    label: "Three-card line",
    shortLabel: "3 cards",
    slots: [
      { position: [-0.5, 0], rotation: 0 },
      { position: [0, 0], rotation: 0 },
      { position: [0.5, 0], rotation: 0 },
    ],
  },
  {
    id: "lenormand-five-card",
    label: "Five-card line",
    shortLabel: "5 cards",
    slots: [
      { position: [-1, 0], rotation: 0 },
      { position: [-0.5, 0], rotation: 0 },
      { position: [0, 0], rotation: 0 },
      { position: [0.5, 0], rotation: 0 },
      { position: [1, 0], rotation: 0 },
    ],
  },
  {
    id: "lenormand-portrait",
    label: "Portrait",
    shortLabel: "9 cards",
    slots: [
      { position: [-0.55, 0.94], rotation: 0 },
      { position: [0, 0.94], rotation: 0 },
      { position: [0.55, 0.94], rotation: 0 },
      { position: [-0.55, 0], rotation: 0 },
      { position: [0, 0], rotation: 0 },
      { position: [0.55, 0], rotation: 0 },
      { position: [-0.55, -0.94], rotation: 0 },
      { position: [0, -0.94], rotation: 0 },
      { position: [0.55, -0.94], rotation: 0 },
    ],
  },
  {
    id: "lenormand-grand-tableau",
    label: "Grand Tableau",
    shortLabel: "36 cards",
    slots: [1.41, 0.47, -0.47, -1.41].flatMap((y) =>
      [-2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0].map((x) => ({
        position: [x, y] as TablePoint,
        rotation: 0,
      }))
    ),
  },
];

/**
 * Returns spread choices appropriate to the active card system. Keeping the
 * selection here means future card sets can opt into their own vocabulary and
 * geometry without changing the presentation code.
 */
export function getPopularSpreads(cardSetKind: CardSetKind): CardSpread[] {
  return cardSetKind === "lenormand"
    ? popularLenormandSpreads
    : popularTarotSpreads;
}
