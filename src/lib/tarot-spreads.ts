import type {
  CardSetKind,
  CardSpreadId,
  LenormandSpreadId,
  TablePoint,
  TarotSpreadId,
} from "@/types";
import type { SceneTableLayout } from "@/components/tarot-studio/table-layout";
import {
  getArrangementPresentation,
  type ArrangementPresentation,
} from "@/lib/card-arrangement";

export type TarotSpreadSlot = {
  position: TablePoint;
  rotation: number;
};

export type CardSpread = {
  id: CardSpreadId;
  label: string;
  shortLabel: string;
  slots: TarotSpreadSlot[];
  /** Sparse semantic relationships between zero-based spread slots. */
  connections: Array<readonly [from: number, to: number]>;
};

/** A spread whose positions suit the taller tarot card format. */
export type TarotSpread = CardSpread & {
  id: TarotSpreadId;
};

/** A spread whose positions suit the compact, 36-card Lenormand tableau. */
export type LenormandSpread = CardSpread & {
  id: LenormandSpreadId;
};

/**
 * Chooses an edge position for the deck and the view zoom needed to show a
 * dealt spread. The shared planner measures the full deck mat and leaves a
 * visible gutter around every final rotated card.
 */
export function getSpreadPresentation(
  spread: CardSpread,
  layout: SceneTableLayout,
  options: {
    includeDeck?: boolean;
    preferredDeckPosition?: TablePoint | null;
  } = {}
): ArrangementPresentation {
  return getArrangementPresentation(spread.slots, layout, options);
}

function createPathConnections(
  length: number
): Array<readonly [number, number]> {
  return Array.from({ length: Math.max(0, length - 1) }, (_, index) => [
    index,
    index + 1,
  ]);
}

export const popularTarotSpreads: TarotSpread[] = [
  {
    id: "one-card",
    label: "One card",
    shortLabel: "1 card",
    slots: [{ position: [0, 0], rotation: 0 }],
    connections: [],
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
    connections: createPathConnections(3),
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
    connections: createPathConnections(7),
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
    connections: [
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [5, 7],
      [6, 7],
      [7, 8],
      [8, 9],
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
    connections: createPathConnections(3),
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
    connections: createPathConnections(5),
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
    connections: [
      [0, 1],
      [1, 2],
      [2, 5],
      [5, 8],
      [8, 7],
      [7, 6],
      [6, 3],
      [3, 0],
      [4, 1],
      [4, 3],
      [4, 5],
      [4, 7],
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
    connections: [],
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

export function getSpreadById(
  spreadId: CardSpreadId
): CardSpread | undefined {
  return [...popularTarotSpreads, ...popularLenormandSpreads].find(
    (spread) => spread.id === spreadId
  );
}
