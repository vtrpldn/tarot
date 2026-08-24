import type {
  CardLayerDirection,
  CardSetDefinition,
  TableCard,
  TableLayout,
  TablePoint,
  TableSnapshot,
  TarotSession,
} from "@/types";
import type { TarotSpread } from "@/lib/tarot-spreads";

const HISTORY_LIMIT = 24;

const clampTablePoint = (value: number) => Math.min(1, Math.max(-1, value));

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function cloneCards(cards: TableCard[]): TableCard[] {
  return cards.map((card) => ({
    ...card,
    position: [...card.position] as TablePoint,
  }));
}

function snapshot(session: TarotSession): TableSnapshot {
  return {
    cards: cloneCards(session.cards),
    deckPosition: [...session.deckPosition] as TablePoint,
    selectedCardId: session.selectedCardId,
  };
}

function commit(
  session: TarotSession,
  cards: TableCard[],
  selectedCardId = session.selectedCardId,
  deckPosition = session.deckPosition
): TarotSession {
  return {
    ...session,
    cards,
    deckPosition: [...deckPosition] as TablePoint,
    selectedCardId,
    history: [...session.history, snapshot(session)].slice(-HISTORY_LIMIT),
  };
}

function nextZIndex(cards: TableCard[]): number {
  return Math.max(0, ...cards.map((card) => card.zIndex)) + 1;
}

function alignedRotation(card: TableCard): number {
  return Math.round(card.rotation / 180) * 180;
}

export function createTarotSession(cardSet: CardSetDefinition): TarotSession {
  const cards = shuffle(cardSet.cards).map((card, index) => ({
    id: `${cardSet.id}:${card.id}`,
    cardId: card.id,
    cardSetId: cardSet.id,
    zone: "deck" as const,
    position: [0, 0] as TablePoint,
    rotation: 0,
    scale: 1,
    zIndex: index,
    faceUp: false,
  }));

  return {
    cardSetId: cardSet.id,
    cards,
    deckPosition: [0, 0],
    selectedCardId: null,
    history: [],
  };
}

export function getTopDeckCard(session: TarotSession): TableCard | undefined {
  const deckCards = session.cards
    .filter((card) => card.zone === "deck")
    .sort((first, second) => first.zIndex - second.zIndex);

  return deckCards[deckCards.length - 1];
}

export function getTableCards(session: TarotSession): TableCard[] {
  return session.cards
    .filter((card) => card.zone === "table")
    .sort((first, second) => first.zIndex - second.zIndex);
}

export function getRemainingDeckCount(session: TarotSession): number {
  return session.cards.filter((card) => card.zone === "deck").length;
}

export function createLayout(
  cards: TableCard[],
  cardSet: CardSetDefinition,
  layout: TableLayout
): Map<
  string,
  Pick<TableCard, "position" | "rotation" | "scale" | "zIndex">
> {
  const placements = new Map<
    string,
    Pick<TableCard, "position" | "rotation" | "scale" | "zIndex">
  >();
  const orderedCards =
    layout === "sort"
      ? [...cards].sort((first, second) => {
          const firstOrder = cardSet.cards.find(
            (card) => card.id === first.cardId
          )?.order;
          const secondOrder = cardSet.cards.find(
            (card) => card.id === second.cardId
          )?.order;

          return (firstOrder ?? 0) - (secondOrder ?? 0);
        })
      : cards;

  if (layout === "stack") {
    orderedCards.forEach((card, index) => {
      placements.set(card.id, {
        position: [0.3 + index * 0.008, index * 0.01],
        rotation: alignedRotation(card),
        scale: 1,
        zIndex: index + 1,
      });
    });

    return placements;
  }

  if (layout === "fan") {
    const midpoint = (orderedCards.length - 1) / 2;
    const spread = Math.min(0.24, 1.45 / Math.max(orderedCards.length, 1));
    const cardScale = Math.min(
      0.82,
      2.9 / Math.max(orderedCards.length, 3)
    );

    orderedCards.forEach((card, index) => {
      const offset = index - midpoint;
      placements.set(card.id, {
        position: [0.34 + offset * spread, -Math.abs(offset) * 0.025],
        rotation: alignedRotation(card) + offset * 8,
        scale: cardScale,
        zIndex: index + 1,
      });
    });

    return placements;
  }

  const columns = Math.min(
    5,
    Math.max(2, Math.ceil(Math.sqrt(orderedCards.length)))
  );
  const rows = Math.max(1, Math.ceil(orderedCards.length / columns));
  const horizontalGap = Math.min(0.44, 1.65 / Math.max(columns - 1, 1));
  const verticalGap = Math.min(0.54, 1.45 / Math.max(rows - 1, 1));
  const cardScale = Math.min(0.78, 1.85 / Math.max(columns, rows));

  orderedCards.forEach((card, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    placements.set(card.id, {
      position: [
        0.3 + (column - (columns - 1) / 2) * horizontalGap,
        ((rows - 1) / 2 - row) * verticalGap,
      ],
      rotation: alignedRotation(card),
      scale: cardScale,
      zIndex: index + 1,
    });
  });

  return placements;
}

export type TarotSessionAction =
  | { type: "select"; cardId: string | null }
  | { type: "draw"; cardId: string; position: TablePoint }
  | { type: "move-deck"; position: TablePoint }
  | { type: "move"; cardId: string; position: TablePoint }
  | { type: "flip"; cardId: string }
  | { type: "rotate"; cardId: string; degrees?: number }
  | {
      type: "reorder";
      cardId: string;
      direction: CardLayerDirection;
    }
  | { type: "nudge"; cardId: string; delta: TablePoint }
  | { type: "deal-spread"; spread: TarotSpread }
  | {
      type: "layout";
      placements: Map<
        string,
        Pick<TableCard, "position" | "rotation" | "scale" | "zIndex">
      >;
    }
  | { type: "undo" }
  | { type: "new-shuffle"; cardSet: CardSetDefinition };

export function tarotSessionReducer(
  session: TarotSession,
  action: TarotSessionAction
): TarotSession {
  if (action.type === "select") {
    return { ...session, selectedCardId: action.cardId };
  }

  if (action.type === "undo") {
    const previous = session.history[session.history.length - 1];

    if (!previous) {
      return session;
    }

    return {
      ...session,
      cards: cloneCards(previous.cards),
      deckPosition: [...previous.deckPosition] as TablePoint,
      selectedCardId: previous.selectedCardId,
      history: session.history.slice(0, -1),
    };
  }

  if (action.type === "new-shuffle") {
    return createTarotSession(action.cardSet);
  }

  if (action.type === "move-deck") {
    const deckPosition: TablePoint = [
      clampTablePoint(action.position[0]),
      clampTablePoint(action.position[1]),
    ];

    if (
      deckPosition[0] === session.deckPosition[0] &&
      deckPosition[1] === session.deckPosition[1]
    ) {
      return session;
    }

    return commit(session, session.cards, null, deckPosition);
  }

  if (action.type === "layout") {
    const cards = session.cards.map((card) => {
      const placement = action.placements.get(card.id);

      return placement ? { ...card, ...placement } : card;
    });

    return commit(session, cards);
  }

  if (action.type === "deal-spread") {
    if (getTableCards(session).length > 0) {
      return session;
    }

    const deckCards = session.cards
      .filter((card) => card.zone === "deck")
      .sort((first, second) => second.zIndex - first.zIndex)
      .slice(0, action.spread.slots.length);

    if (deckCards.length < action.spread.slots.length) {
      return session;
    }

    const zIndexBase = nextZIndex(session.cards);
    const placements = new Map(
      deckCards.map((card, index) => [
        card.id,
        { index, slot: action.spread.slots[index] },
      ])
    );
    const cards = session.cards.map((card) => {
      const placement = placements.get(card.id);

      if (!placement) {
        return card;
      }

      return {
        ...card,
        zone: "table" as const,
        position: [...placement.slot.position] as TablePoint,
        rotation: placement.slot.rotation,
        scale: placement.slot.scale,
        zIndex: zIndexBase + placement.index,
        faceUp: false,
      };
    });

    return commit(session, cards, null);
  }

  const card = session.cards.find((candidate) => candidate.id === action.cardId);

  if (!card) {
    return session;
  }

  if (action.type === "draw") {
    if (card.zone !== "deck" || card.id !== getTopDeckCard(session)?.id) {
      return session;
    }

    const cards = session.cards.map((candidate) =>
      candidate.id === action.cardId
        ? {
            ...candidate,
            zone: "table" as const,
            position: action.position,
            scale: 1,
            zIndex: nextZIndex(session.cards),
          }
        : candidate
    );

    return commit(session, cards, action.cardId);
  }

  if (card.zone !== "table") {
    return session;
  }

  if (action.type === "reorder") {
    const tableCards = getTableCards(session);
    const currentIndex = tableCards.findIndex(
      (candidate) => candidate.id === action.cardId
    );
    const indexDelta = action.direction === "forward" ? 1 : -1;
    const nextIndex = Math.min(
      tableCards.length - 1,
      Math.max(0, currentIndex + indexDelta)
    );

    if (currentIndex < 0 || nextIndex === currentIndex) {
      return session.selectedCardId === action.cardId
        ? session
        : { ...session, selectedCardId: action.cardId };
    }

    const reorderedCards = [...tableCards];
    const [movedCard] = reorderedCards.splice(currentIndex, 1);
    reorderedCards.splice(nextIndex, 0, movedCard);
    const layerByCardId = new Map(
      reorderedCards.map((candidate, index) => [candidate.id, index + 1])
    );
    const cards = session.cards.map((candidate) => {
      const zIndex = layerByCardId.get(candidate.id);

      return zIndex === undefined ? candidate : { ...candidate, zIndex };
    });

    return commit(session, cards, action.cardId);
  }

  if (action.type === "move") {
    const cards = session.cards.map((candidate) =>
      candidate.id === action.cardId
        ? {
          ...candidate,
          position: action.position,
          zIndex: nextZIndex(session.cards),
          }
        : candidate
    );

    return commit(session, cards, action.cardId);
  }

  if (action.type === "flip") {
    const cards = session.cards.map((candidate) =>
      candidate.id === action.cardId
        ? {
            ...candidate,
            faceUp: !candidate.faceUp,
            zIndex: nextZIndex(session.cards),
          }
        : candidate
    );

    return commit(session, cards, action.cardId);
  }

  if (action.type === "rotate") {
    const degrees = action.degrees ?? 180;
    const cards = session.cards.map((candidate) =>
      candidate.id === action.cardId
        ? {
            ...candidate,
            rotation: candidate.rotation + degrees,
            zIndex: nextZIndex(session.cards),
          }
        : candidate
    );

    return commit(session, cards, action.cardId);
  }

  const cards = session.cards.map((candidate) =>
    candidate.id === action.cardId
      ? {
          ...candidate,
          position: [
            clampTablePoint(candidate.position[0] + action.delta[0]),
            clampTablePoint(candidate.position[1] + action.delta[1]),
          ] as TablePoint,
          zIndex: nextZIndex(session.cards),
        }
      : candidate
  );

  return commit(session, cards, action.cardId);
}
