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
import {
  getSpreadPresentation,
  popularTarotSpreads,
  type TarotSpread,
} from "@/lib/tarot-spreads";
import {
  loadTarotWorkspace,
  saveTarotWorkspace,
} from "@/lib/tarot-workspace";
import type { CardLayerDirection, TableLayout, TablePoint } from "@/types";
import {
  MAX_VIEW_ZOOM,
  MIN_VIEW_ZOOM,
  type SceneTableLayout,
} from "./table-layout";

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
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const hoveredCardIdRef = useRef<string | null>(null);
  const sceneLayoutRef = useRef<SceneTableLayout | null>(null);
  const activeSpreadRef = useRef<TarotSpread | null>(null);
  const arrangeMenuRef = useRef<HTMLDivElement>(null);
  const arrangeMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const shuffleMenuRef = useRef<HTMLDivElement>(null);
  const shuffleMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const inspectorCollapseRef = useRef<HTMLButtonElement>(null);
  const inspectorToggleRef = useRef<HTMLButtonElement>(null);
  const layerWheelRef = useRef({
    accumulatedDelta: 0,
    direction: 0,
    lastChangeAt: 0,
  });
  const [activeCardSetId, setActiveCardSetId] = useState(cardSets[0].id);
  const [viewZoom, setViewZoom] = useState(1);
  const [isArrangeMenuOpen, setIsArrangeMenuOpen] = useState(false);
  const [isShuffleMenuOpen, setIsShuffleMenuOpen] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isDeckMoveMode, setIsDeckMoveMode] = useState(false);
  const [isSceneLayoutReady, setIsSceneLayoutReady] = useState(false);
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);
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
  const deckCardNoun = deckCount === 1 ? "card" : "cards";
  const tableCardNoun = tableCards.length === 1 ? "card" : "cards";

  useEffect(() => {
    const workspace = loadTarotWorkspace(cardSets);

    if (workspace) {
      setActiveCardSetId(workspace.activeCardSetId);
      setViewZoom(
        Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, workspace.viewZoom))
      );
      setIsInspectorCollapsed(workspace.isInspectorCollapsed);
      dispatch({ type: "restore", session: workspace.session });
    }

    setIsWorkspaceReady(true);
  }, []);

  useEffect(() => {
    if (!isWorkspaceReady) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      saveTarotWorkspace({
        activeCardSetId,
        isInspectorCollapsed,
        session,
        viewZoom,
      });
    }, 160);

    return () => window.clearTimeout(saveTimer);
  }, [
    activeCardSetId,
    isInspectorCollapsed,
    isWorkspaceReady,
    session,
    viewZoom,
  ]);

  useEffect(() => {
    if (!isArrangeMenuOpen) {
      return;
    }

    const focusTimer = window.requestAnimationFrame(() => {
      arrangeMenuRef.current
        ?.querySelector<HTMLButtonElement>(
          "[role='dialog'] button:not(:disabled)"
        )
        ?.focus();
    });

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!arrangeMenuRef.current?.contains(event.target as Node)) {
        setIsArrangeMenuOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsArrangeMenuOpen(false);
        arrangeMenuTriggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isArrangeMenuOpen]);

  useEffect(() => {
    if (!isShuffleMenuOpen) {
      return;
    }

    const focusTimer = window.requestAnimationFrame(() => {
      shuffleMenuRef.current
        ?.querySelector<HTMLButtonElement>(
          "[role='dialog'] button:not(:disabled)"
        )
        ?.focus();
    });

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
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isShuffleMenuOpen]);

  useEffect(() => {
    if (selectedCard?.zone !== "table") {
      setIsInspectorCollapsed(false);
    }
  }, [selectedCard?.zone]);

  const collapseInspector = useCallback(() => {
    setIsInspectorCollapsed(true);
    window.requestAnimationFrame(() => inspectorToggleRef.current?.focus());
  }, []);

  const expandInspector = useCallback(() => {
    setIsInspectorCollapsed(false);
    window.requestAnimationFrame(() => inspectorCollapseRef.current?.focus());
  }, []);

  const closeArrangeMenu = useCallback(() => {
    setIsArrangeMenuOpen(false);
    window.requestAnimationFrame(() => arrangeMenuTriggerRef.current?.focus());
  }, []);

  const closeShuffleMenu = useCallback(() => {
    setIsShuffleMenuOpen(false);
    window.requestAnimationFrame(() => shuffleMenuTriggerRef.current?.focus());
  }, []);

  const drawCard = useCallback(() => {
    if (!topDeckCard) {
      return;
    }

    activeSpreadRef.current = null;
    dispatch({ type: "draw", cardId: topDeckCard.id, position: [0.3, 0] });
  }, [topDeckCard]);

  const arrangeCards = useCallback(
    (layout: TableLayout) => {
      if (tableCards.length === 0) {
        return;
      }

      activeSpreadRef.current = null;
      dispatch({
        type: "layout",
        placements: createLayout(tableCards, activeCardSet, layout),
      });
    },
    [activeCardSet, tableCards]
  );

  const dealSpread = useCallback(
    (spread: TarotSpread) => {
      const layout = sceneLayoutRef.current;

      if (!layout) {
        return;
      }

      const presentation = getSpreadPresentation(spread, layout);
      activeSpreadRef.current = spread;
      setViewZoom(presentation.zoom);

      dispatch({
        type: "deal-spread",
        spread,
        deckPosition: presentation.deckPosition,
      });
    },
    []
  );

  const flipSelected = useCallback(() => {
    if (selectedCard?.zone === "table") {
      dispatch({ type: "flip", cardId: selectedCard.id });
    }
  }, [selectedCard]);

  const turnSelected = useCallback((degrees: number) => {
    if (selectedCard?.zone === "table") {
      activeSpreadRef.current = null;
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

  const handleLayoutChange = useCallback((layout: SceneTableLayout) => {
    sceneLayoutRef.current = layout;
    setIsSceneLayoutReady(true);

    const spread = activeSpreadRef.current;

    if (spread) {
      const presentation = getSpreadPresentation(spread, layout);
      setViewZoom(presentation.zoom);
      dispatch({
        type: "sync-deck-position",
        position: presentation.deckPosition,
      });
    }
  }, []);

  const handleSelect = useCallback((cardId: string | null) => {
    dispatch({ type: "select", cardId });
  }, []);

  const handleDraw = useCallback(
    (cardId: string, position: TablePoint, rotation?: number) => {
      activeSpreadRef.current = null;
      dispatch({ type: "draw", cardId, position, rotation });
    },
    []
  );

  const handleMoveDeck = useCallback((position: TablePoint) => {
    activeSpreadRef.current = null;
    setIsDeckMoveMode(false);
    dispatch({ type: "move-deck", position });
  }, []);

  const handleMove = useCallback(
    (cardId: string, position: TablePoint, rotation?: number) => {
      activeSpreadRef.current = null;
      dispatch({ type: "move", cardId, position, rotation });
    },
    []
  );

  const handleFlip = useCallback((cardId: string) => {
    dispatch({ type: "flip", cardId });
  }, []);

  const handleRotate = useCallback((cardId: string, degrees: number) => {
    activeSpreadRef.current = null;
    dispatch({ type: "rotate", cardId, degrees });
  }, []);

  const handleHover = useCallback((cardId: string | null) => {
    hoveredCardIdRef.current = cardId;
  }, []);

  const undoLastAction = useCallback(() => {
    const previous = session.history[session.history.length - 1];

    if (!previous) {
      return;
    }

    if (previous.cards.every((card) => card.zone === "deck")) {
      activeSpreadRef.current = null;
      setViewZoom(1);
    }

    dispatch({ type: "undo" });
  }, [session.history]);

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

    if (key === "escape" && isDeckMoveMode) {
      setIsDeckMoveMode(false);
      return;
    }

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
      activeSpreadRef.current = null;
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
    ? `${Math.abs(normalizedRotation - 180) < 0.8 ? "Reversed · " : normalizedRotation > 0.8 ? `Rotation ${Math.round(normalizedRotation)}° · ` : ""}${activeCardSet.kind === "lenormand" ? "Lenormand" : selectedDefinition?.arcana === "major" ? "Major Arcana" : "Minor Arcana"} · Layer ${selectedTableIndex + 1} of ${tableCards.length}`
    : selectedCard
      ? `Face down · Layer ${selectedTableIndex + 1} of ${tableCards.length}. Use the layer controls to restack.`
      : "Draw a card or tap one on the table.";

  if (!isWorkspaceReady) {
    return (
      <main className="tarot-app tarot-app--restoring">
        <div className="tarot-grain" aria-hidden="true" />
        <div className="tarot-workspace-loading" role="status">
          Opening the table…
        </div>
      </main>
    );
  }

  return (
    <main className="tarot-app">
      <div className="tarot-grain" aria-hidden="true" />
      <div
        ref={canvasShellRef}
        className="tarot-canvas-shell"
        tabIndex={0}
        role="region"
        aria-label="Interactive card table. Drag the top card to draw it, drag table cards to arrange them, use the card controls to flip, rotate, or change layers, and use Arrange to move the whole deck without keyboard modifiers."
        onKeyDown={handleKeyDown}
        onWheel={handleTableWheel}
      >
        <TarotScene
          cardSet={activeCardSet}
          session={session}
          reducedMotion={reducedMotion}
          viewZoom={viewZoom}
          deckMoveMode={isDeckMoveMode}
          onLayoutChange={handleLayoutChange}
          onSelect={handleSelect}
          onDraw={handleDraw}
          onMoveDeck={handleMoveDeck}
          onMove={handleMove}
          onFlip={handleFlip}
          onRotate={handleRotate}
          onHover={handleHover}
        />
      </div>

      {activeCardSet.kind === "tarot" &&
        tableCards.length === 0 &&
        !isDeckMoveMode && (
        <section className="tarot-spread-actions" aria-label="Popular tarot spreads">
          <span>Spreads</span>
          {popularTarotSpreads.map((spread) => (
            <button
              key={spread.id}
              type="button"
              onClick={() => dealSpread(spread)}
              disabled={
                !isSceneLayoutReady || deckCount < spread.slots.length
              }
            >
              {spread.label}
              <small>{spread.shortLabel}</small>
            </button>
          ))}
        </section>
      )}

      <div className="tarot-set-picker">
        <label htmlFor="card-set">Deck</label>
        <select
          id="card-set"
          name="card-set"
          autoComplete="off"
          value={activeCardSetId}
          onChange={(event) => {
            const nextCardSet = getCardSet(event.target.value);
            activeSpreadRef.current = null;
            setIsDeckMoveMode(false);
            setIsSceneLayoutReady(false);
            setActiveCardSetId(nextCardSet.id);
            dispatch({ type: "new-shuffle", cardSet: nextCardSet });
            setViewZoom(1);
          }}
        >
          {cardSets.map((cardSet) => (
            <option key={cardSet.id} value={cardSet.id}>
              {cardSet.label}
            </option>
          ))}
        </select>
        <span>
          {deckCount} {deckCardNoun} in the deck
        </span>
      </div>

      {isDeckMoveMode && (
        <div className="tarot-mode-hint" role="status">
          <span>Drag the deck to reposition it</span>
          <button
            type="button"
            onClick={() => {
              setIsDeckMoveMode(false);
              canvasShellRef.current?.focus();
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {selectedCard?.zone === "table" &&
        (isInspectorCollapsed ? (
          <button
            ref={inspectorToggleRef}
            type="button"
            className="tarot-inspector-toggle"
            aria-label={`Expand selected card controls for ${selectedTitle}`}
            aria-expanded="false"
            onClick={expandInspector}
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
                ref={inspectorCollapseRef}
                type="button"
                className="tarot-inspector-collapse"
                aria-label="Collapse selected card controls"
                aria-expanded="true"
                onClick={collapseInspector}
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
                name="drawn-card"
                autoComplete="off"
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
        <div className="tarot-arrange-menu" ref={arrangeMenuRef}>
          <button
            ref={arrangeMenuTriggerRef}
            type="button"
            className="tarot-arrange-trigger"
            aria-label="Arrange cards and undo"
            aria-controls="arrange-actions"
            aria-expanded={isArrangeMenuOpen}
            aria-haspopup="dialog"
            onClick={() => {
              setIsShuffleMenuOpen(false);
              setIsArrangeMenuOpen((isOpen) => !isOpen);
            }}
            disabled={
              !topDeckCard && !tableCards.length && !session.history.length
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7.5h10v12H5zM9 4.5h10v12" />
              <path d="M8 11.5h4M8 14.5h4" />
            </svg>
            <span>Arrange</span>
            <svg
              className="tarot-menu-chevron"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m8 10 4 4 4-4" />
            </svg>
          </button>
          {isArrangeMenuOpen && (
            <div
              id="arrange-actions"
              className="tarot-arrange-popover"
              role="dialog"
              aria-label="Arrange cards and undo"
            >
              <p>Table actions</p>
              <div>
                {(
                  [
                    ["fan", "Fan", "Open arc"],
                    ["grid", "Grid", "Even rows"],
                    ["stack", "Stack", "Single pile"],
                    ["sort", "Sort", "Deck order"],
                  ] as const
                ).map(([layout, label, hint]) => (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => {
                      arrangeCards(layout);
                      closeArrangeMenu();
                    }}
                    disabled={!tableCards.length}
                  >
                    <span>{label}</span>
                    <small>{hint}</small>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "select", cardId: null });
                    setIsDeckMoveMode(true);
                    setIsArrangeMenuOpen(false);
                    window.requestAnimationFrame(() =>
                      canvasShellRef.current?.focus()
                    );
                  }}
                  disabled={!topDeckCard}
                >
                  <span>Move deck</span>
                  <small>Then drag the pile</small>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    undoLastAction();
                    closeArrangeMenu();
                  }}
                  disabled={!session.history.length}
                >
                  <span>Undo</span>
                  <small>Last table move</small>
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="tarot-shuffle-menu" ref={shuffleMenuRef}>
          <button
            ref={shuffleMenuTriggerRef}
            type="button"
            className="tarot-shuffle-trigger"
            aria-label="Shuffle"
            aria-controls="shuffle-actions"
            aria-expanded={isShuffleMenuOpen}
            aria-haspopup="dialog"
            onClick={() => {
              setIsArrangeMenuOpen(false);
              setIsShuffleMenuOpen((isOpen) => !isOpen);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h2.7c3.2 0 4 10 7.3 10H20" />
              <path d="m17 14 3 3-3 3M4 17h2.7c1.2 0 2-.7 2.8-1.7M14.5 7H20m-3-3 3 3-3 3" />
            </svg>
            <span>Shuffle</span>
            <svg className="tarot-menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
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
                  activeSpreadRef.current = null;
                  setIsDeckMoveMode(false);
                  dispatch({ type: "new-shuffle", cardSet: activeCardSet });
                  closeShuffleMenu();
                  setViewZoom(1);
                }}
              >
                <span>New shuffle</span>
                <small>Restart with all {activeCardSet.cards.length} cards</small>
              </button>
            </div>
          )}
        </div>
      </nav>

      <p className="tarot-live-status" aria-live="polite">
        {deckCount === 0
          ? "The deck is empty. Start a new shuffle to begin again."
          : `${deckCount} ${deckCardNoun} ${deckCount === 1 ? "remains" : "remain"} in the deck. ${tableCards.length} ${tableCardNoun} ${tableCards.length === 1 ? "is" : "are"} on the table.`}
      </p>
    </main>
  );
}
