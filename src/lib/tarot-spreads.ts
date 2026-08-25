import type { CardSetKind, TablePoint } from "@/types";
import type { SceneTableLayout } from "@/components/tarot-studio/table-layout";
import {
  getArrangementPresentation,
  type ArrangementPresentation,
} from "@/lib/card-arrangement";

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
