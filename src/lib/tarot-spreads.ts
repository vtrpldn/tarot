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

export type SpreadRelationshipId =
  | "shapes-present"
  | "guides-future"
  | "arrives-now"
  | "reveals-hidden"
  | "meets-obstacle"
  | "draws-support"
  | "informs-counsel"
  | "guides-outcome"
  | "crowns-present"
  | "roots-present"
  | "releases-past"
  | "opens-future"
  | "future-meets-context"
  | "self-meets-context"
  | "context-shapes-hopes"
  | "hopes-guide-outcome"
  | "sets-scene"
  | "centers-matter"
  | "shows-turn"
  | "shows-outcome"
  | "guides-view"
  | "frames-past"
  | "grounds-reading";

export type SpreadConnection = {
  from: number;
  to: number;
  relationship?: SpreadRelationshipId;
  /** Selects which side of a crowded relationship line carries its label. */
  labelSide?: -1 | 1;
};

export type CardSpread = {
  id: CardSpreadId;
  label: string;
  shortLabel: string;
  slots: TarotSpreadSlot[];
  /** Sparse semantic relationships between zero-based spread slots. */
  connections: SpreadConnection[];
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
  relationships: SpreadRelationshipId[]
): SpreadConnection[] {
  return relationships.map((relationship, index) => ({
    from: index,
    to: index + 1,
    relationship,
    labelSide: index % 2 === 0 ? 1 : -1,
  }));
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
    connections: createPathConnections([
      "shapes-present",
      "guides-future",
    ]),
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
    connections: createPathConnections([
      "arrives-now",
      "reveals-hidden",
      "meets-obstacle",
      "draws-support",
      "informs-counsel",
      "guides-outcome",
    ]),
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
      { from: 0, to: 2, relationship: "crowns-present", labelSide: 1 },
      { from: 0, to: 3, relationship: "roots-present", labelSide: -1 },
      { from: 0, to: 4, relationship: "releases-past", labelSide: 1 },
      { from: 0, to: 5, relationship: "opens-future", labelSide: -1 },
      { from: 5, to: 7, relationship: "future-meets-context", labelSide: 1 },
      { from: 6, to: 7, relationship: "self-meets-context", labelSide: -1 },
      { from: 7, to: 8, relationship: "context-shapes-hopes", labelSide: 1 },
      { from: 8, to: 9, relationship: "hopes-guide-outcome", labelSide: -1 },
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
    connections: createPathConnections([
      "sets-scene",
      "shows-outcome",
    ]),
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
    connections: createPathConnections([
      "sets-scene",
      "centers-matter",
      "shows-turn",
      "shows-outcome",
    ]),
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
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 5 },
      { from: 5, to: 8 },
      { from: 8, to: 7 },
      { from: 7, to: 6 },
      { from: 6, to: 3 },
      { from: 3, to: 0 },
      { from: 4, to: 1, relationship: "guides-view", labelSide: 1 },
      { from: 4, to: 3, relationship: "frames-past", labelSide: -1 },
      { from: 4, to: 5, relationship: "opens-future", labelSide: 1 },
      { from: 4, to: 7, relationship: "grounds-reading", labelSide: -1 },
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
