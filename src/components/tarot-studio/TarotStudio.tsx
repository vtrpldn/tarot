"use client";

import dynamic from "next/dynamic";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { cardSets, getCardSet } from "@/data/card-sets";
import {
  createLayout,
  createTarotSession,
  getRemainingDeckCount,
  getTableCards,
  getTopDeckCard,
  tarotSessionReducer,
} from "@/lib/tarot-session";
import type { TableLayout } from "@/types";

const TarotScene = dynamic(
  () => import("./TarotScene").then((module) => module.TarotScene),
  {
    ssr: false,
    loading: () => <div className="tarot-scene-loading">Preparing the table…</div>,
  }
);

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return reducedMotion;
}

function Shortcut({ children }: { children: ReactNode }) {
  return <kbd className="tarot-shortcut">{children}</kbd>;
}

export function TarotStudio() {
  const [activeCardSetId, setActiveCardSetId] = useState(cardSets[0].id);
  const activeCardSet = useMemo(
    () => getCardSet(activeCardSetId),
    [activeCardSetId]
  );
  const [session, dispatch] = useReducer(
    tarotSessionReducer,
    activeCardSet,
    createTarotSession
  );
  const reducedMotion = useReducedMotionPreference();
  const tableCards = getTableCards(session);
  const topDeckCard = getTopDeckCard(session);
  const selectedCard = session.cards.find(
    (card) => card.id === session.selectedCardId
  );
  const selectedDefinition = selectedCard
    ? activeCardSet.cards.find((card) => card.id === selectedCard.cardId)
    : undefined;
  const deckCount = getRemainingDeckCount(session);

  const drawCard = useCallback(() => {
    if (!topDeckCard) {
      return;
    }

    dispatch({ type: "draw", cardId: topDeckCard.id, position: [0, 0] });
  }, [topDeckCard]);

  const arrangeCards = useCallback(
    (layout: TableLayout) => {
      if (tableCards.length === 0) {
        return;
      }

      dispatch({
        type: "layout",
        placements: createLayout(tableCards, activeCardSet, layout),
      });
    },
    [activeCardSet, tableCards]
  );

  const flipSelected = useCallback(() => {
    if (selectedCard?.zone === "table") {
      dispatch({ type: "flip", cardId: selectedCard.id });
    }
  }, [selectedCard]);

  const rotateSelected = useCallback(() => {
    if (selectedCard?.zone === "table") {
      dispatch({ type: "rotate", cardId: selectedCard.id });
    }
  }, [selectedCard]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (target.matches("button, select, input, textarea")) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "f" && selectedCard?.zone === "table") {
      event.preventDefault();
      flipSelected();
      return;
    }

    if (key === "r" && selectedCard?.zone === "table") {
      event.preventDefault();
      rotateSelected();
      return;
    }

    if ((key === "enter" || key === " ") && !selectedCard) {
      event.preventDefault();
      drawCard();
      return;
    }

    const nudgeMap: Record<string, [number, number]> = {
      arrowup: [0, 0.035],
      arrowdown: [0, -0.035],
      arrowleft: [-0.035, 0],
      arrowright: [0.035, 0],
    };
    const nudge = nudgeMap[key];

    if (nudge && selectedCard?.zone === "table") {
      event.preventDefault();
      dispatch({
        type: "nudge",
        cardId: selectedCard.id,
        delta: nudge,
      });
    }

    if (key === "escape") {
      dispatch({ type: "select", cardId: null });
    }
  };

  const selectedTitle = selectedCard?.faceUp
    ? selectedDefinition?.name ?? "Selected card"
    : selectedCard
      ? "Face-down card"
      : "Nothing selected";
  const selectedHint = selectedCard?.faceUp
    ? `${selectedCard.rotation ? "Reversed · " : ""}${selectedDefinition?.arcana === "major" ? "Major Arcana" : "Minor Arcana"}`
    : selectedCard
      ? "Select Flip when you are ready to reveal it."
      : "Draw a card or tap one on the table.";

  return (
    <main className="tarot-app">
      <div className="tarot-grain" aria-hidden="true" />
      <div
        className="tarot-canvas-shell"
        tabIndex={0}
        role="application"
        aria-label="Interactive tarot table. Drag the top card to draw it, drag table cards to arrange them, and use the controls to flip or rotate a selected card."
        onKeyDown={handleKeyDown}
      >
        <TarotScene
          cardSet={activeCardSet}
          session={session}
          reducedMotion={reducedMotion}
          onSelect={(cardId) => dispatch({ type: "select", cardId })}
          onDraw={(cardId, position) =>
            dispatch({ type: "draw", cardId, position })
          }
          onMove={(cardId, position) =>
            dispatch({ type: "move", cardId, position })
          }
          onFlip={(cardId) => dispatch({ type: "flip", cardId })}
        />
      </div>

      <header className="tarot-header">
        <p className="tarot-eyebrow">Tarot table · v2</p>
        <h1>
          Shuffle by touch.
          <span>Read by instinct.</span>
        </h1>
        <p className="tarot-intro">
          A real-feeling table for drawing, turning, reversing, and arranging
          your own spread.
        </p>
      </header>

      <div className="tarot-set-picker">
        <label htmlFor="card-set">Card set</label>
        <select
          id="card-set"
          value={activeCardSetId}
          onChange={(event) => {
            const nextCardSet = getCardSet(event.target.value);
            setActiveCardSetId(nextCardSet.id);
            dispatch({ type: "new-shuffle", cardSet: nextCardSet });
          }}
        >
          {cardSets.map((cardSet) => (
            <option key={cardSet.id} value={cardSet.id}>
              {cardSet.label}
            </option>
          ))}
        </select>
        <span>{deckCount} cards in the deck</span>
      </div>

      <aside className="tarot-inspector" aria-live="polite">
        <p className="tarot-eyebrow">Selected card</p>
        <h2>{selectedTitle}</h2>
        <p>{selectedHint}</p>
        <div className="tarot-inspector-actions">
          <button
            type="button"
            onClick={flipSelected}
            disabled={selectedCard?.zone !== "table"}
          >
            Flip <Shortcut>F</Shortcut>
          </button>
          <button
            type="button"
            onClick={rotateSelected}
            disabled={selectedCard?.zone !== "table"}
          >
            Rotate <Shortcut>R</Shortcut>
          </button>
        </div>
      </aside>

      <nav className="tarot-toolbar" aria-label="Table actions">
        <button
          type="button"
          className="tarot-primary-action"
          onClick={drawCard}
          disabled={!topDeckCard}
        >
          Draw card
          <span>{topDeckCard ? "or drag the deck" : "deck is empty"}</span>
        </button>
        <div className="tarot-arrange-actions" aria-label="Arrange cards">
          <button
            type="button"
            onClick={() => arrangeCards("fan")}
            disabled={!tableCards.length}
          >
            Fan
          </button>
          <button
            type="button"
            onClick={() => arrangeCards("grid")}
            disabled={!tableCards.length}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => arrangeCards("stack")}
            disabled={!tableCards.length}
          >
            Stack
          </button>
          <button
            type="button"
            onClick={() => arrangeCards("sort")}
            disabled={!tableCards.length}
          >
            Sort
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "undo" })}
            disabled={!session.history.length}
          >
            Undo
          </button>
        </div>
        <button
          type="button"
          className="tarot-reset-action"
          onClick={() => dispatch({ type: "new-shuffle", cardSet: activeCardSet })}
        >
          New shuffle
        </button>
      </nav>

      <p className="tarot-live-status" aria-live="polite">
        {deckCount === 0
          ? "The deck is empty. Start a new shuffle to begin again."
          : `${deckCount} cards remain in the deck. ${tableCards.length} cards are on the table.`}
      </p>
    </main>
  );
}
