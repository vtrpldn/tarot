"use client";

import dynamic from "next/dynamic";
import {
  type KeyboardEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
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
import { popularTarotSpreads } from "@/lib/tarot-spreads";
import type { CardLayerDirection, TableLayout } from "@/types";
import { MAX_VIEW_ZOOM, MIN_VIEW_ZOOM } from "./table-layout";

const WHEEL_LAYER_COOLDOWN = 110;
const WHEEL_LAYER_THRESHOLD = 36;

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
  const hoveredCardIdRef = useRef<string | null>(null);
  const shuffleMenuRef = useRef<HTMLDivElement>(null);
  const shuffleMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const layerWheelRef = useRef({
    accumulatedDelta: 0,
    direction: 0,
    lastChangeAt: 0,
  });
  const [activeCardSetId, setActiveCardSetId] = useState(cardSets[0].id);
  const [viewZoom, setViewZoom] = useState(1);
  const [isShuffleMenuOpen, setIsShuffleMenuOpen] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
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
  const selectedTableIndex = selectedCard
    ? tableCards.findIndex((card) => card.id === selectedCard.id)
    : -1;
  const canSendBackward = selectedTableIndex > 0;
  const canBringForward =
    selectedTableIndex >= 0 && selectedTableIndex < tableCards.length - 1;
  const deckCount = getRemainingDeckCount(session);

  useEffect(() => {
    if (!isShuffleMenuOpen) {
      return;
    }

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!shuffleMenuRef.current?.contains(event.target as Node)) {
        setIsShuffleMenuOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsShuffleMenuOpen(false);
        shuffleMenuTriggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isShuffleMenuOpen]);

  useEffect(() => {
    if (selectedCard?.zone !== "table") {
      setIsInspectorCollapsed(false);
    }
  }, [selectedCard?.zone]);

  const drawCard = useCallback(() => {
    if (!topDeckCard) {
      return;
    }

    dispatch({ type: "draw", cardId: topDeckCard.id, position: [0.3, 0] });
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

  const turnSelected = useCallback((degrees: number) => {
    if (selectedCard?.zone === "table") {
      dispatch({ type: "rotate", cardId: selectedCard.id, degrees });
    }
  }, [selectedCard]);

  const reorderSelected = useCallback(
    (direction: CardLayerDirection) => {
      if (selectedCard?.zone === "table") {
        dispatch({ type: "reorder", cardId: selectedCard.id, direction });
      }
    },
    [selectedCard]
  );

  const adjustViewZoom = useCallback((delta: number) => {
    setViewZoom((current) =>
      Math.min(
        MAX_VIEW_ZOOM,
        Math.max(MIN_VIEW_ZOOM, Number((current + delta).toFixed(2)))
      )
    );
  }, []);

  const handleTableWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      const hoveredCardId = hoveredCardIdRef.current;

      if (!hoveredCardId || event.ctrlKey || event.metaKey) {
        return;
      }

      event.stopPropagation();
      const wheel = layerWheelRef.current;
      const deltaMultiplier =
        event.deltaMode === 0 ? 1 : event.deltaMode === 1 ? 16 : 120;
      const normalizedDelta = event.deltaY * deltaMultiplier;
      const direction = Math.sign(normalizedDelta);

      if (direction !== 0 && direction !== wheel.direction) {
        wheel.accumulatedDelta = 0;
        wheel.direction = direction;
      }

      wheel.accumulatedDelta += normalizedDelta;

      if (
        Math.abs(wheel.accumulatedDelta) < WHEEL_LAYER_THRESHOLD ||
        event.timeStamp - wheel.lastChangeAt < WHEEL_LAYER_COOLDOWN
      ) {
        return;
      }

      const layerDirection: CardLayerDirection =
        wheel.accumulatedDelta < 0 ? "forward" : "backward";
      wheel.accumulatedDelta = 0;
      wheel.lastChangeAt = event.timeStamp;
      dispatch({
        type: "reorder",
        cardId: hoveredCardId,
        direction: layerDirection,
      });
    },
    []
  );

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
      turnSelected(180);
      return;
    }

    if (event.key === "[" && selectedCard?.zone === "table") {
      event.preventDefault();
      turnSelected(-15);
      return;
    }

    if (event.key === "]" && selectedCard?.zone === "table") {
      event.preventDefault();
      turnSelected(15);
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      adjustViewZoom(-0.1);
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      adjustViewZoom(0.1);
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      setViewZoom(1);
      return;
    }

    if (key === "pageup" && selectedCard?.zone === "table") {
      event.preventDefault();
      reorderSelected("forward");
      return;
    }

    if (key === "pagedown" && selectedCard?.zone === "table") {
      event.preventDefault();
      reorderSelected("backward");
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

  const normalizedRotation = selectedCard
    ? ((selectedCard.rotation % 360) + 360) % 360
    : 0;
  const selectedTitle = selectedCard?.faceUp
    ? selectedDefinition?.name ?? "Selected card"
    : selectedCard
      ? "Face-down card"
      : "Nothing selected";
  const selectedHint = selectedCard?.faceUp
    ? `${Math.abs(normalizedRotation - 180) < 0.8 ? "Reversed · " : normalizedRotation > 0.8 ? `Rotation ${Math.round(normalizedRotation)}° · ` : ""}${selectedDefinition?.arcana === "major" ? "Major Arcana" : "Minor Arcana"} · Layer ${selectedTableIndex + 1} of ${tableCards.length}`
    : selectedCard
      ? `Face down · Layer ${selectedTableIndex + 1} of ${tableCards.length}. Scroll over it to restack.`
      : "Draw a card or tap one on the table.";

  return (
    <main className="tarot-app">
      <div className="tarot-grain" aria-hidden="true" />
      <div
        className="tarot-canvas-shell"
        tabIndex={0}
        role="region"
        aria-label="Interactive tarot table. Drag the top card to draw it, hold Control or Command while dragging to move the whole deck, drag table cards to arrange them, scroll over a card to change its layer, and drag near a selected card edge to rotate it."
        onKeyDown={handleKeyDown}
        onWheel={handleTableWheel}
      >
        <TarotScene
          cardSet={activeCardSet}
          session={session}
          reducedMotion={reducedMotion}
          viewZoom={viewZoom}
          onSelect={(cardId) => dispatch({ type: "select", cardId })}
          onDraw={(cardId, position) =>
            dispatch({ type: "draw", cardId, position })
          }
          onMoveDeck={(position) =>
            dispatch({ type: "move-deck", position })
          }
          onMove={(cardId, position) =>
            dispatch({ type: "move", cardId, position })
          }
          onFlip={(cardId) => dispatch({ type: "flip", cardId })}
          onRotate={(cardId, degrees) =>
            dispatch({ type: "rotate", cardId, degrees })
          }
          onHover={(cardId) => {
            hoveredCardIdRef.current = cardId;
          }}
        />
      </div>

      {tableCards.length === 0 && (
        <section className="tarot-spread-actions" aria-label="Popular tarot spreads">
          <span>Spreads</span>
          {popularTarotSpreads.map((spread) => (
            <button
              key={spread.id}
              type="button"
              onClick={() => {
                dispatch({ type: "deal-spread", spread });
              }}
              disabled={deckCount < spread.slots.length}
            >
              {spread.label}
              <small>{spread.shortLabel}</small>
            </button>
          ))}
        </section>
      )}

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

      {selectedCard?.zone === "table" &&
        (isInspectorCollapsed ? (
          <button
            type="button"
            className="tarot-inspector-toggle"
            aria-label={`Expand selected card controls for ${selectedTitle}`}
            aria-expanded="false"
            onClick={() => setIsInspectorCollapsed(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
              <path d="m12 7 .8 2.1 2.2.1-1.7 1.4.6 2.2-1.9-1.2-1.9 1.2.6-2.2-1.7-1.4 2.2-.1L12 7Z" />
            </svg>
          </button>
        ) : (
          <aside
            id="selected-card-inspector"
            className="tarot-inspector"
            aria-live="polite"
          >
            <div className="tarot-inspector-heading">
              <p className="tarot-eyebrow">Selected card</p>
              <button
                type="button"
                className="tarot-inspector-collapse"
                aria-label="Collapse selected card controls"
                aria-expanded="true"
                onClick={() => setIsInspectorCollapsed(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m7 10 5 5 5-5" />
                </svg>
              </button>
            </div>
            <h2>{selectedTitle}</h2>
            <p>{selectedHint}</p>
            <div className="tarot-card-browser">
              <label htmlFor="drawn-card">Browse cards on the table</label>
              <select
                id="drawn-card"
                value={session.selectedCardId ?? ""}
                disabled={tableCards.length === 0}
                onChange={(event) =>
                  dispatch({ type: "select", cardId: event.target.value || null })
                }
              >
                <option value="">Select a drawn card</option>
                {tableCards.map((card, index) => {
                  const definition = activeCardSet.cards.find(
                    (candidate) => candidate.id === card.cardId
                  );

                  return (
                    <option key={card.id} value={card.id}>
                      {card.faceUp
                        ? definition?.name ?? `Card ${index + 1}`
                        : `Face-down card ${index + 1}`}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="tarot-inspector-actions">
              <button type="button" onClick={flipSelected}>
                Flip <Shortcut>F</Shortcut>
              </button>
              <button type="button" onClick={() => turnSelected(-15)}>
                Turn −15° <Shortcut>[</Shortcut>
              </button>
              <button type="button" onClick={() => turnSelected(15)}>
                Turn +15° <Shortcut>]</Shortcut>
              </button>
              <button type="button" onClick={() => turnSelected(180)}>
                Reverse <Shortcut>R</Shortcut>
              </button>
              <button
                type="button"
                onClick={() => reorderSelected("backward")}
                disabled={!canSendBackward}
              >
                Send back <Shortcut>Pg↓</Shortcut>
              </button>
              <button
                type="button"
                onClick={() => reorderSelected("forward")}
                disabled={!canBringForward}
              >
                Bring forward <Shortcut>Pg↑</Shortcut>
              </button>
            </div>
          </aside>
        ))}

      <nav className="tarot-toolbar" aria-label="Table actions">
        <div className="tarot-zoom-controls" aria-label="Table zoom">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => adjustViewZoom(-0.1)}
            disabled={viewZoom <= MIN_VIEW_ZOOM}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Reset table zoom"
            title="Reset zoom"
            onClick={() => setViewZoom(1)}
          >
            {Math.round(viewZoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => adjustViewZoom(0.1)}
            disabled={viewZoom >= MAX_VIEW_ZOOM}
          >
            +
          </button>
        </div>
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
        <div className="tarot-shuffle-menu" ref={shuffleMenuRef}>
          <button
            ref={shuffleMenuTriggerRef}
            type="button"
            className="tarot-shuffle-trigger"
            aria-controls="shuffle-actions"
            aria-expanded={isShuffleMenuOpen}
            aria-haspopup="dialog"
            onClick={() => setIsShuffleMenuOpen((isOpen) => !isOpen)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h2.7c3.2 0 4 10 7.3 10H20" />
              <path d="m17 14 3 3-3 3M4 17h2.7c1.2 0 2-.7 2.8-1.7M14.5 7H20m-3-3 3 3-3 3" />
            </svg>
            <span>Shuffle</span>
            <svg className="tarot-shuffle-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m8 10 4 4 4-4" />
            </svg>
          </button>
          {isShuffleMenuOpen && (
            <div
              id="shuffle-actions"
              className="tarot-shuffle-popover"
              role="dialog"
              aria-label="Shuffle actions"
            >
              <p>Deck session</p>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "new-shuffle", cardSet: activeCardSet });
                  setIsShuffleMenuOpen(false);
                }}
              >
                <span>New shuffle</span>
                <small>Restart with all 78 cards</small>
              </button>
            </div>
          )}
        </div>
      </nav>

      <p className="tarot-live-status" aria-live="polite">
        {deckCount === 0
          ? "The deck is empty. Start a new shuffle to begin again."
          : `${deckCount} cards remain in the deck. ${tableCards.length} cards are on the table.`}
      </p>
    </main>
  );
}
