import type {
  CardSetDefinition,
  TableCard,
  TablePoint,
  TarotSession,
} from "@/types";
import { DECK_POINT_LIMIT, TABLE_POINT_LIMIT } from "@/types";

export const TAROT_WORKSPACE_STORAGE_KEY = "tarot-table:workspace:v1";

const WORKSPACE_VERSION = 1;

export type TarotWorkspace = {
  activeCardSetId: string;
  isInspectorCollapsed: boolean;
  session: TarotSession;
  viewZoom: number;
};

type StoredWorkspace = TarotWorkspace & {
  version: typeof WORKSPACE_VERSION;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPointWithinLimit(
  value: unknown,
  limit: number
): value is TablePoint {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (coordinate) =>
        isFiniteNumber(coordinate) && Math.abs(coordinate) <= limit
    )
  );
}

const isTablePoint = (value: unknown): value is TablePoint =>
  isPointWithinLimit(value, TABLE_POINT_LIMIT);

const isDeckPoint = (value: unknown): value is TablePoint =>
  isPointWithinLimit(value, DECK_POINT_LIMIT);

function isTableCard(value: unknown, cardSet: CardSetDefinition): value is TableCard {
  if (!value || typeof value !== "object") {
    return false;
  }

  const card = value as Partial<TableCard>;
  const definition = cardSet.cards.find(
    (candidate) => candidate.id === card.cardId
  );

  return Boolean(
    definition &&
      card.id === `${cardSet.id}:${definition.id}` &&
      card.cardSetId === cardSet.id &&
      (card.zone === "deck" || card.zone === "table") &&
      isTablePoint(card.position) &&
      isFiniteNumber(card.rotation) &&
      isFiniteNumber(card.zIndex) &&
      typeof card.faceUp === "boolean"
  );
}

function restoreSession(
  value: unknown,
  cardSet: CardSetDefinition
): TarotSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const session = value as Partial<TarotSession>;

  if (
    session.cardSetId !== cardSet.id ||
    !Array.isArray(session.cards) ||
    session.cards.length !== cardSet.cards.length ||
    !session.cards.every((card) => isTableCard(card, cardSet)) ||
    !(
      session.deckPosition === null || isDeckPoint(session.deckPosition)
    ) ||
    !(
      session.selectedCardId === null ||
      typeof session.selectedCardId === "string"
    )
  ) {
    return null;
  }

  const cards = session.cards.map((card) => ({
    ...card,
    position: [...card.position] as TablePoint,
  }));
  const cardIds = new Set(cards.map((card) => card.id));

  if (
    cardIds.size !== cardSet.cards.length ||
    (session.selectedCardId !== null && !cardIds.has(session.selectedCardId))
  ) {
    return null;
  }

  return {
    cardSetId: cardSet.id,
    cards,
    deckPosition: session.deckPosition
      ? ([...session.deckPosition] as TablePoint)
      : null,
    selectedCardId: session.selectedCardId,
    history: [],
    redo: [],
  };
}

export function loadTarotWorkspace(
  cardSets: CardSetDefinition[]
): TarotWorkspace | null {
  try {
    const serialized = window.localStorage.getItem(TAROT_WORKSPACE_STORAGE_KEY);

    if (!serialized) {
      return null;
    }

    const stored = JSON.parse(serialized) as Partial<StoredWorkspace>;
    const cardSet = cardSets.find(
      (candidate) => candidate.id === stored.activeCardSetId
    );

    if (
      stored.version !== WORKSPACE_VERSION ||
      !cardSet ||
      !isFiniteNumber(stored.viewZoom) ||
      typeof stored.isInspectorCollapsed !== "boolean"
    ) {
      return null;
    }

    const session = restoreSession(stored.session, cardSet);

    return session
      ? {
          activeCardSetId: cardSet.id,
          isInspectorCollapsed: stored.isInspectorCollapsed,
          session,
          viewZoom: stored.viewZoom,
        }
      : null;
  } catch {
    return null;
  }
}

export function saveTarotWorkspace(workspace: TarotWorkspace): void {
  try {
    const stored: StoredWorkspace = {
      version: WORKSPACE_VERSION,
      activeCardSetId: workspace.activeCardSetId,
      isInspectorCollapsed: workspace.isInspectorCollapsed,
      session: {
        ...workspace.session,
        history: [],
        redo: [],
      },
      viewZoom: workspace.viewZoom,
    };

    window.localStorage.setItem(
      TAROT_WORKSPACE_STORAGE_KEY,
      JSON.stringify(stored)
    );
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
  }
}
