"use client";

import dynamic from "next/dynamic";
import {
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  cardSets,
  getCardDisplayName,
  getCardSet,
  getCardSetDisplayLabel,
} from "@/data/card-sets";
import type { CardReading } from "@/data/card-readings";
import {
  applyDocumentLocale,
  getInitialLocale,
  persistLocale,
  type AppLocale,
} from "@/i18n/locale";
import { getCardCount, getMessages } from "@/i18n/messages";
import {
  createCardSoundEngine,
  type CardSoundEvent,
  type CardSoundPlayOptions,
} from "@/lib/card-sounds";
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
const DOCK_EDGE_REVEAL_DISTANCE = 52;
const DOCK_HIDE_DELAY = 850;
const DOCK_INITIAL_HIDE_DELAY = 1800;
const LANGUAGE_OPTIONS = ["en", "pt-BR"] as const satisfies readonly AppLocale[];

const TarotScene = dynamic(
  () => import("./TarotScene").then((module) => module.TarotScene),
  {
    ssr: false,
    loading: () => null,
  }
);

let cardReadingsPromise: Promise<typeof import("@/data/card-readings")> | null =
  null;

function loadCardReadings() {
  cardReadingsPromise ??= import("@/data/card-readings");
  return cardReadingsPromise;
}

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

function useCardSounds() {
  const engineRef = useRef<ReturnType<typeof createCardSoundEngine> | null>(
    null
  );
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const engine = createCardSoundEngine();
    engineRef.current = engine;
    setIsMuted(engine.getMuted());

    return () => {
      engine.dispose();

      if (engineRef.current === engine) {
        engineRef.current = null;
      }
    };
  }, []);

  const play = useCallback(
    (event: CardSoundEvent, options?: CardSoundPlayOptions) => {
      engineRef.current?.play(event, options);
    },
    []
  );
  const toggle = useCallback(() => {
    const engine = engineRef.current;

    if (!engine) {
      return;
    }

    setIsMuted(engine.toggleMuted());
  }, []);

  return { isMuted, play, toggle };
}

function useAutoHidingDock(
  isPinned: boolean,
  fallbackFocusRef: RefObject<HTMLElement | null>
) {
  const dockRef = useRef<HTMLElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const finePointerRef = useRef(false);
  const keyboardFocusRef = useRef(true);
  const pointerInsideRef = useRef(false);
  const pinnedRef = useRef(isPinned);
  const [isVisible, setIsVisible] = useState(true);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current === null) {
      return;
    }

    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);
  const showDock = useCallback(() => {
    clearHideTimer();
    setIsVisible(true);
  }, [clearHideTimer]);
  const scheduleHide = useCallback(
    (delay = DOCK_HIDE_DELAY) => {
      if (
        !finePointerRef.current ||
        pinnedRef.current ||
        pointerInsideRef.current ||
        hideTimerRef.current !== null
      ) {
        return;
      }

      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null;
        const dock = dockRef.current;

        if (
          !finePointerRef.current ||
          pinnedRef.current ||
          pointerInsideRef.current
        ) {
          return;
        }

        if (dock?.contains(document.activeElement)) {
          if (keyboardFocusRef.current) {
            return;
          }

          fallbackFocusRef.current?.focus({ preventScroll: true });
        }

        setIsVisible(false);
      }, delay);
    },
    [fallbackFocusRef]
  );

  useEffect(() => {
    pinnedRef.current = isPinned;

    if (isPinned) {
      showDock();
    } else {
      scheduleHide();
    }
  }, [isPinned, scheduleHide, showDock]);

  useEffect(() => {
    const finePointer = window.matchMedia(
      "(min-width: 768px) and (hover: hover) and (pointer: fine)"
    );
    const updatePointerMode = () => {
      finePointerRef.current = finePointer.matches;

      if (finePointer.matches) {
        scheduleHide(DOCK_INITIAL_HIDE_DELAY);
      } else {
        showDock();
      }
    };
    const revealFromBottomEdge = (event: PointerEvent) => {
      if (!finePointerRef.current || event.pointerType !== "mouse") {
        return;
      }

      keyboardFocusRef.current = false;

      if (event.clientY >= window.innerHeight - DOCK_EDGE_REVEAL_DISTANCE) {
        showDock();
      } else {
        scheduleHide();
      }
    };
    const noteKeyboardUse = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === "Tab" ||
        dockRef.current?.contains(document.activeElement)
      ) {
        keyboardFocusRef.current = true;
      }
    };

    updatePointerMode();
    finePointer.addEventListener("change", updatePointerMode);
    document.addEventListener("keydown", noteKeyboardUse, true);
    document.addEventListener("pointermove", revealFromBottomEdge, {
      capture: true,
      passive: true,
    });

    return () => {
      clearHideTimer();
      finePointer.removeEventListener("change", updatePointerMode);
      document.removeEventListener("keydown", noteKeyboardUse, true);
      document.removeEventListener("pointermove", revealFromBottomEdge, true);
    };
  }, [clearHideTimer, scheduleHide, showDock]);

  const onPointerEnter = useCallback(() => {
    pointerInsideRef.current = true;
    showDock();
  }, [showDock]);
  const onPointerLeave = useCallback(() => {
    pointerInsideRef.current = false;
    scheduleHide();
  }, [scheduleHide]);
  const onPointerDown = useCallback(() => {
    keyboardFocusRef.current = false;
    showDock();
  }, [showDock]);
  const onFocus = useCallback(() => {
    showDock();
  }, [showDock]);
  const onBlur = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (!dockRef.current?.contains(document.activeElement)) {
        scheduleHide();
      }
    });
  }, [scheduleHide]);

  return {
    dockRef,
    isVisible,
    onBlur,
    onFocus,
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
  };
}

function Shortcut({ children }: { children: ReactNode }) {
  return <kbd className="tarot-shortcut">{children}</kbd>;
}

type DockPopoverOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

function useDockPopover({
  containerRef,
  isOpen,
  setIsOpen,
  triggerRef,
}: DockPopoverOptions) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLElement>(
          "[role='dialog'] [role='radio'][aria-checked='true'], [role='dialog'] button:not(:disabled), [role='dialog'] select:not(:disabled)"
        )
        ?.focus();
    });
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);

        const target = event.target;

        if (target instanceof HTMLElement) {
          const tableRegion = target.closest<HTMLElement>(
            ".tarot-canvas-shell"
          );
          const isFocusableControl = target.closest(
            "button, select, input, textarea, a[href], [tabindex]"
          );

          if (tableRegion) {
            window.requestAnimationFrame(() => tableRegion.focus());
          } else if (!isFocusableControl) {
            window.requestAnimationFrame(() => triggerRef.current?.focus());
          }
        }
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [containerRef, isOpen, setIsOpen, triggerRef]);
}

export function TarotStudio() {
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const hoveredCardIdRef = useRef<string | null>(null);
  const sceneLayoutRef = useRef<SceneTableLayout | null>(null);
  const activeSpreadRef = useRef<TarotSpread | null>(null);
  const deckMenuRef = useRef<HTMLDivElement>(null);
  const deckMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const zoomMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const spreadMenuRef = useRef<HTMLDivElement>(null);
  const spreadMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const arrangeMenuRef = useRef<HTMLDivElement>(null);
  const arrangeMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const shuffleMenuRef = useRef<HTMLDivElement>(null);
  const shuffleMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const languageMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const inspectorCollapseRef = useRef<HTMLButtonElement>(null);
  const inspectorToggleRef = useRef<HTMLButtonElement>(null);
  const layerWheelRef = useRef({
    accumulatedDelta: 0,
    direction: 0,
    lastChangeAt: 0,
  });
  const [activeCardSetId, setActiveCardSetId] = useState(cardSets[0].id);
  const [viewZoom, setViewZoom] = useState(1);
  const [isDeckMenuOpen, setIsDeckMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [isSpreadMenuOpen, setIsSpreadMenuOpen] = useState(false);
  const [isArrangeMenuOpen, setIsArrangeMenuOpen] = useState(false);
  const [isShuffleMenuOpen, setIsShuffleMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(true);
  const [isDeckMoveMode, setIsDeckMoveMode] = useState(false);
  const [isSceneLayoutReady, setIsSceneLayoutReady] = useState(false);
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);
  const [selectedReading, setSelectedReading] = useState<CardReading | null>(
    null
  );
  const [isReadingLoading, setIsReadingLoading] = useState(false);
  const [locale, setLocale] = useState<AppLocale>("en");
  const messages = getMessages(locale);
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
  const {
    isMuted: areCardSoundsMuted,
    play: playCardSound,
    toggle: toggleCardSounds,
  } = useCardSounds();
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
  const hasSelectedTableCard = selectedCard?.zone === "table";
  const isInspectorOpen =
    hasSelectedTableCard && !isInspectorCollapsed && !isDeckMoveMode;
  const isDockPinned =
    isDeckMenuOpen ||
    isZoomMenuOpen ||
    isSpreadMenuOpen ||
    isArrangeMenuOpen ||
    isShuffleMenuOpen ||
    isLanguageMenuOpen ||
    isInspectorOpen ||
    isDeckMoveMode;
  const {
    dockRef,
    isVisible: isDockVisible,
    onBlur: handleDockBlur,
    onFocus: handleDockFocus,
    onPointerDown: handleDockPointerDown,
    onPointerEnter: handleDockPointerEnter,
    onPointerLeave: handleDockPointerLeave,
  } = useAutoHidingDock(isDockPinned, canvasShellRef);
  const canSendBackward = selectedTableIndex > 0;
  const canBringForward =
    selectedTableIndex >= 0 && selectedTableIndex < tableCards.length - 1;
  const deckCount = getRemainingDeckCount(session);
  const deckCardCount = getCardCount(locale, deckCount);
  const tableCardCount = getCardCount(locale, tableCards.length);

  useEffect(() => {
    const initialLocale = getInitialLocale();

    setLocale(initialLocale);
    applyDocumentLocale(initialLocale);
  }, []);

  useEffect(() => {
    const workspace = loadTarotWorkspace(cardSets);

    if (workspace) {
      setActiveCardSetId(workspace.activeCardSetId);
      setViewZoom(
        Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, workspace.viewZoom))
      );
      setIsInspectorCollapsed(true);
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

  useDockPopover({
    containerRef: deckMenuRef,
    isOpen: isDeckMenuOpen,
    setIsOpen: setIsDeckMenuOpen,
    triggerRef: deckMenuTriggerRef,
  });
  useDockPopover({
    containerRef: zoomMenuRef,
    isOpen: isZoomMenuOpen,
    setIsOpen: setIsZoomMenuOpen,
    triggerRef: zoomMenuTriggerRef,
  });
  useDockPopover({
    containerRef: spreadMenuRef,
    isOpen: isSpreadMenuOpen,
    setIsOpen: setIsSpreadMenuOpen,
    triggerRef: spreadMenuTriggerRef,
  });
  useDockPopover({
    containerRef: arrangeMenuRef,
    isOpen: isArrangeMenuOpen,
    setIsOpen: setIsArrangeMenuOpen,
    triggerRef: arrangeMenuTriggerRef,
  });
  useDockPopover({
    containerRef: shuffleMenuRef,
    isOpen: isShuffleMenuOpen,
    setIsOpen: setIsShuffleMenuOpen,
    triggerRef: shuffleMenuTriggerRef,
  });
  useDockPopover({
    containerRef: languageMenuRef,
    isOpen: isLanguageMenuOpen,
    setIsOpen: setIsLanguageMenuOpen,
    triggerRef: languageMenuTriggerRef,
  });

  useEffect(() => {
    if (selectedCard?.zone !== "table") {
      setIsInspectorCollapsed(true);
    }
  }, [selectedCard?.zone]);

  useEffect(() => {
    let cancelled = false;

    if (
      !isInspectorOpen ||
      !selectedCard?.faceUp ||
      !selectedDefinition
    ) {
      setSelectedReading(null);
      setIsReadingLoading(false);
      return;
    }

    setSelectedReading(null);
    setIsReadingLoading(true);

    void loadCardReadings()
      .then(({ getCardReading }) => {
        if (!cancelled) {
          setSelectedReading(
            getCardReading(activeCardSet.id, selectedDefinition, locale) ?? null
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedReading(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsReadingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeCardSet.id,
    isInspectorOpen,
    locale,
    selectedCard?.faceUp,
    selectedDefinition,
  ]);

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
    playCardSound("draw");
    dispatch({ type: "draw", cardId: topDeckCard.id, position: [0.3, 0] });
  }, [playCardSound, topDeckCard]);

  const arrangeCards = useCallback(
    (layout: TableLayout) => {
      if (tableCards.length === 0) {
        return;
      }

      activeSpreadRef.current = null;
      playCardSound("arrange");
      dispatch({
        type: "layout",
        placements: createLayout(tableCards, activeCardSet, layout),
      });
    },
    [activeCardSet, playCardSound, tableCards]
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
      playCardSound("arrange");

      dispatch({
        type: "deal-spread",
        spread,
        deckPosition: presentation.deckPosition,
      });
    },
    [playCardSound]
  );

  const flipSelected = useCallback(() => {
    if (selectedCard?.zone === "table") {
      playCardSound("flip");
      dispatch({ type: "flip", cardId: selectedCard.id });
    }
  }, [playCardSound, selectedCard]);

  const turnSelected = useCallback((degrees: number) => {
    if (selectedCard?.zone === "table") {
      activeSpreadRef.current = null;
      playCardSound("rotate");
      dispatch({ type: "rotate", cardId: selectedCard.id, degrees });
    }
  }, [playCardSound, selectedCard]);

  const reorderSelected = useCallback(
    (direction: CardLayerDirection) => {
      if (selectedCard?.zone === "table") {
        playCardSound("move", { intensity: 0.7 });
        dispatch({ type: "reorder", cardId: selectedCard.id, direction });
      }
    },
    [playCardSound, selectedCard]
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
      playCardSound("draw");
      dispatch({ type: "draw", cardId, position, rotation });
    },
    [playCardSound]
  );

  const handleMoveDeck = useCallback((position: TablePoint) => {
    activeSpreadRef.current = null;
    setIsDeckMoveMode(false);
    playCardSound("drop");
    dispatch({ type: "move-deck", position });
  }, [playCardSound]);

  const handleMove = useCallback(
    (cardId: string, position: TablePoint, rotation?: number) => {
      activeSpreadRef.current = null;
      playCardSound("drop");
      dispatch({ type: "move", cardId, position, rotation });
    },
    [playCardSound]
  );

  const handleFlip = useCallback((cardId: string) => {
    playCardSound("flip");
    dispatch({ type: "flip", cardId });
  }, [playCardSound]);

  const handleRotate = useCallback((cardId: string, degrees: number) => {
    activeSpreadRef.current = null;
    playCardSound("rotate");
    dispatch({ type: "rotate", cardId, degrees });
  }, [playCardSound]);

  const handleHover = useCallback((cardId: string | null) => {
    hoveredCardIdRef.current = cardId;
  }, []);

  const updateLocale = useCallback(
    (nextLocale: AppLocale, closeMenu: boolean) => {
      persistLocale(nextLocale);
      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);

      if (closeMenu) {
        setIsLanguageMenuOpen(false);
        window.requestAnimationFrame(() =>
          languageMenuTriggerRef.current?.focus()
        );
        return;
      }

      window.requestAnimationFrame(() =>
        languageMenuRef.current
          ?.querySelector<HTMLButtonElement>(
            `[data-locale-option="${nextLocale}"]`
          )
          ?.focus()
      );
    },
    []
  );

  const handleLanguageRadioKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, currentLocale: AppLocale) => {
      const currentIndex = LANGUAGE_OPTIONS.indexOf(currentLocale);
      let nextIndex: number;

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex =
            (currentIndex - 1 + LANGUAGE_OPTIONS.length) %
            LANGUAGE_OPTIONS.length;
          break;
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (currentIndex + 1) % LANGUAGE_OPTIONS.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = LANGUAGE_OPTIONS.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      updateLocale(LANGUAGE_OPTIONS[nextIndex], false);
    },
    [updateLocale]
  );

  const undoLastAction = useCallback(() => {
    const previous = session.history[session.history.length - 1];

    if (!previous) {
      return;
    }

    if (previous.cards.every((card) => card.zone === "deck")) {
      activeSpreadRef.current = null;
      setViewZoom(1);
    }

    playCardSound("arrange");
    dispatch({ type: "undo" });
  }, [playCardSound, session.history]);

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
      playCardSound("move", { intensity: 0.65 });
      dispatch({
        type: "reorder",
        cardId: hoveredCardId,
        direction: layerDirection,
      });
    },
    [playCardSound]
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
      playCardSound("move", { intensity: 0.6 });
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
    ? selectedDefinition
      ? getCardDisplayName(selectedDefinition, locale)
      : messages.selectedCard
    : selectedCard
      ? messages.faceDownCard
      : messages.selectCardControls;
  const selectedHint = selectedCard?.faceUp
    ? messages.selectedHint({
        category:
          activeCardSet.kind === "lenormand"
            ? "lenormand"
            : selectedDefinition?.arcana === "major"
              ? "major"
              : "minor",
        layer: selectedTableIndex + 1,
        total: tableCards.length,
        rotation: normalizedRotation,
        isReversed: Math.abs(normalizedRotation - 180) < 0.8,
      })
    : selectedCard
      ? messages.faceDownHint(selectedTableIndex + 1, tableCards.length)
      : messages.noSelectionHint;

  if (!isWorkspaceReady) {
    return (
      <main className="tarot-app tarot-app--restoring">
        <div className="tarot-grain" aria-hidden="true" />
        <div className="tarot-workspace-loading" role="status">
          {messages.loadingTable}
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
        aria-label={messages.tableDescription}
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
          onSound={playCardSound}
        />
      </div>

      <nav
        ref={dockRef}
        className="tarot-toolbar"
        aria-label={messages.tableActions}
        data-dock-state={
          isDockVisible || isDockPinned ? "visible" : "hidden"
        }
        onPointerEnter={handleDockPointerEnter}
        onPointerLeave={handleDockPointerLeave}
        onPointerDownCapture={handleDockPointerDown}
        onFocusCapture={handleDockFocus}
        onBlurCapture={handleDockBlur}
      >
        <span className="tarot-toolbar-sigil" aria-hidden="true">
          ☾
        </span>
        <div className="tarot-deck-menu" ref={deckMenuRef}>
          <button
            ref={deckMenuTriggerRef}
            type="button"
            className="tarot-toolbar-trigger tarot-deck-trigger"
            aria-label={messages.deckTrigger(
              getCardSetDisplayLabel(activeCardSet, locale),
              deckCardCount
            )}
            aria-controls="deck-actions"
            aria-expanded={isDeckMenuOpen}
            aria-haspopup="dialog"
            onClick={() => {
              const willOpen = !isDeckMenuOpen;
              setIsZoomMenuOpen(false);
              setIsSpreadMenuOpen(false);
              setIsArrangeMenuOpen(false);
              setIsShuffleMenuOpen(false);
              setIsLanguageMenuOpen(false);
              if (selectedCard?.zone === "table") {
                setIsInspectorCollapsed(true);
              }
              setIsDeckMenuOpen(willOpen);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="6" width="12" height="14" rx="1.5" />
              <path d="M8 3.8h10.2a1.8 1.8 0 0 1 1.8 1.8V17" />
              <path d="m11 10 .7 1.7 1.8.1-1.4 1.2.5 1.8-1.6-1-1.6 1 .5-1.8-1.4-1.2 1.8-.1L11 10Z" />
            </svg>
            <span>{messages.deck}</span>
            <svg className="tarot-menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m8 10 4 4 4-4" />
            </svg>
          </button>
          {isDeckMenuOpen && (
            <div
              id="deck-actions"
              className="tarot-set-picker"
              role="dialog"
              aria-label={messages.chooseDeck}
            >
              <label htmlFor="card-set">{messages.deck}</label>
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
                  playCardSound("shuffle");
                  dispatch({ type: "new-shuffle", cardSet: nextCardSet });
                  setViewZoom(1);
                  setIsDeckMenuOpen(false);
                  window.requestAnimationFrame(() =>
                    deckMenuTriggerRef.current?.focus()
                  );
                }}
              >
                {cardSets.map((cardSet) => (
                  <option key={cardSet.id} value={cardSet.id}>
                    {getCardSetDisplayLabel(cardSet, locale)}
                  </option>
                ))}
              </select>
              <span>
                {messages.cardsInDeck(deckCardCount)}
              </span>
            </div>
          )}
        </div>
        <div className="tarot-zoom-menu" ref={zoomMenuRef}>
          <button
            ref={zoomMenuTriggerRef}
            type="button"
            className="tarot-toolbar-trigger tarot-zoom-trigger"
            aria-label={messages.tableZoom(Math.round(viewZoom * 100))}
            aria-controls="zoom-actions"
            aria-expanded={isZoomMenuOpen}
            aria-haspopup="dialog"
            onClick={() => {
              const willOpen = !isZoomMenuOpen;
              setIsDeckMenuOpen(false);
              setIsSpreadMenuOpen(false);
              setIsArrangeMenuOpen(false);
              setIsShuffleMenuOpen(false);
              setIsLanguageMenuOpen(false);
              setIsInspectorCollapsed(true);
              setIsZoomMenuOpen(willOpen);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="5.5" />
              <path d="m14.5 14.5 5 5M8 10.5h5M10.5 8v5" />
            </svg>
            <span>{messages.zoom}</span>
            <svg className="tarot-menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m8 10 4 4 4-4" />
            </svg>
          </button>
          <div
            id="zoom-actions"
            className={`tarot-zoom-controls${isZoomMenuOpen ? " tarot-zoom-controls--open" : ""}`}
            role={isZoomMenuOpen ? "dialog" : undefined}
            aria-label={messages.zoom}
          >
            <button
              type="button"
              aria-label={messages.zoomOut}
              onClick={() => adjustViewZoom(-0.1)}
              disabled={viewZoom <= MIN_VIEW_ZOOM}
            >
              −
            </button>
            <button
              type="button"
              aria-label={messages.resetZoom}
              title={messages.resetZoom}
              onClick={() => setViewZoom(1)}
            >
              {Math.round(viewZoom * 100)}%
            </button>
            <button
              type="button"
              aria-label={messages.zoomIn}
              onClick={() => adjustViewZoom(0.1)}
              disabled={viewZoom >= MAX_VIEW_ZOOM}
            >
              +
            </button>
          </div>
        </div>
        {isDeckMoveMode && (
          <button
            type="button"
            className="tarot-mode-cancel"
            aria-label={messages.cancelDeckMove}
            onClick={() => {
              setIsDeckMoveMode(false);
              canvasShellRef.current?.focus();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.5 12.5V8.8a1.4 1.4 0 0 1 2.8 0v2.4-5a1.4 1.4 0 0 1 2.8 0v4.5-3a1.4 1.4 0 0 1 2.8 0v3.6-2a1.4 1.4 0 0 1 2.8 0v5.2c0 3.6-2.2 5.5-5.7 5.5h-.7c-2.4 0-3.7-1.2-5.2-3.2L4.5 14a1.35 1.35 0 0 1 2-1.8l1.7 1.6" />
            </svg>
            <span className="tarot-mode-cancel-label">
              {messages.movingDeck}
            </span>
            <span>{messages.cancel}</span>
          </button>
        )}
        {activeCardSet.kind === "tarot" &&
          tableCards.length === 0 &&
          !isDeckMoveMode && (
            <div className="tarot-spread-menu" ref={spreadMenuRef}>
              <button
                ref={spreadMenuTriggerRef}
                type="button"
                className="tarot-toolbar-trigger tarot-spread-trigger"
                aria-label={messages.chooseSpread}
                aria-controls="spread-actions"
                aria-expanded={isSpreadMenuOpen}
                aria-haspopup="dialog"
                onClick={() => {
                  const willOpen = !isSpreadMenuOpen;
                  setIsDeckMenuOpen(false);
                  setIsZoomMenuOpen(false);
                  setIsArrangeMenuOpen(false);
                  setIsShuffleMenuOpen(false);
                  setIsLanguageMenuOpen(false);
                  setIsSpreadMenuOpen(willOpen);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="8" width="5" height="8" rx="1" />
                  <rect x="9.5" y="5" width="5" height="11" rx="1" />
                  <rect x="15.5" y="8" width="5" height="8" rx="1" />
                </svg>
                <span>{messages.spreads}</span>
                <svg className="tarot-menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m8 10 4 4 4-4" />
                </svg>
              </button>
              {isSpreadMenuOpen && (
                <section
                  id="spread-actions"
                  className="tarot-spread-actions"
                  role="dialog"
                  aria-label={messages.popularSpreads}
                >
                  <span>{messages.chooseASpread}</span>
                  <div>
                    {popularTarotSpreads.map((spread) => (
                      <button
                        key={spread.id}
                        type="button"
                        onClick={() => {
                          dealSpread(spread);
                          setIsSpreadMenuOpen(false);
                          window.requestAnimationFrame(() =>
                            canvasShellRef.current?.focus()
                          );
                        }}
                        disabled={
                          !isSceneLayoutReady || deckCount < spread.slots.length
                        }
                      >
                        {messages.spreadLabels[spread.id][0]}
                        <small>{messages.spreadLabels[spread.id][1]}</small>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        <div className="tarot-arrange-menu" ref={arrangeMenuRef}>
          <button
            ref={arrangeMenuTriggerRef}
            type="button"
            className="tarot-toolbar-trigger tarot-arrange-trigger"
            aria-label={messages.arrangeAndUndo}
            aria-controls="arrange-actions"
            aria-expanded={isArrangeMenuOpen}
            aria-haspopup="dialog"
            onClick={() => {
              const willOpen = !isArrangeMenuOpen;
              setIsDeckMenuOpen(false);
              setIsZoomMenuOpen(false);
              setIsSpreadMenuOpen(false);
              setIsShuffleMenuOpen(false);
              setIsLanguageMenuOpen(false);
              if (selectedCard?.zone === "table") {
                setIsInspectorCollapsed(true);
              }
              setIsArrangeMenuOpen(willOpen);
            }}
            disabled={
              !topDeckCard && !tableCards.length && !session.history.length
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7.5h10v12H5zM9 4.5h10v12" />
              <path d="M8 11.5h4M8 14.5h4" />
            </svg>
            <span>{messages.arrange}</span>
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
              aria-label={messages.arrangeAndUndo}
            >
              <p>{messages.tableActionsTitle}</p>
              <div>
                {(
                  [
                    ["fan", ...messages.layouts.fan],
                    ["grid", ...messages.layouts.grid],
                    ["stack", ...messages.layouts.stack],
                    ["sort", ...messages.layouts.sort],
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
                    setIsDeckMenuOpen(false);
                    setIsZoomMenuOpen(false);
                    setIsSpreadMenuOpen(false);
                    setIsShuffleMenuOpen(false);
                    setIsLanguageMenuOpen(false);
                    setIsDeckMoveMode(true);
                    setIsArrangeMenuOpen(false);
                    window.requestAnimationFrame(() =>
                      canvasShellRef.current?.focus()
                    );
                  }}
                  disabled={!topDeckCard}
                >
                  <span>{messages.moveDeck[0]}</span>
                  <small>{messages.moveDeck[1]}</small>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    undoLastAction();
                    closeArrangeMenu();
                  }}
                  disabled={!session.history.length}
                >
                  <span>{messages.undo[0]}</span>
                  <small>{messages.undo[1]}</small>
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="tarot-shuffle-menu" ref={shuffleMenuRef}>
          <button
            ref={shuffleMenuTriggerRef}
            type="button"
            className="tarot-toolbar-trigger tarot-shuffle-trigger"
            aria-label={messages.shuffle}
            aria-controls="shuffle-actions"
            aria-expanded={isShuffleMenuOpen}
            aria-haspopup="dialog"
            onClick={() => {
              const willOpen = !isShuffleMenuOpen;
              setIsDeckMenuOpen(false);
              setIsZoomMenuOpen(false);
              setIsSpreadMenuOpen(false);
              setIsArrangeMenuOpen(false);
              setIsLanguageMenuOpen(false);
              if (selectedCard?.zone === "table") {
                setIsInspectorCollapsed(true);
              }
              setIsShuffleMenuOpen(willOpen);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h2.7c3.2 0 4 10 7.3 10H20" />
              <path d="m17 14 3 3-3 3M4 17h2.7c1.2 0 2-.7 2.8-1.7M14.5 7H20m-3-3 3 3-3 3" />
            </svg>
            <span>{messages.shuffle}</span>
            <svg className="tarot-menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m8 10 4 4 4-4" />
            </svg>
          </button>
          {isShuffleMenuOpen && (
            <div
              id="shuffle-actions"
              className="tarot-shuffle-popover"
              role="dialog"
              aria-label={messages.shuffleActions}
            >
              <p>{messages.deckSession}</p>
              <button
                type="button"
                onClick={() => {
                  activeSpreadRef.current = null;
                  setIsDeckMoveMode(false);
                  playCardSound("shuffle");
                  dispatch({ type: "new-shuffle", cardSet: activeCardSet });
                  closeShuffleMenu();
                  setViewZoom(1);
                }}
              >
                <span>{messages.newShuffle}</span>
                <small>{messages.restartWithAll(activeCardSet.cards.length)}</small>
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="tarot-toolbar-trigger tarot-sound-toggle"
          aria-label={messages.cardSounds}
          aria-pressed={!areCardSoundsMuted}
          title={areCardSoundsMuted ? messages.cardSoundsOff : messages.cardSoundsOn}
          onClick={toggleCardSounds}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 10h3.2L13 6.2v11.6L8.2 14H5z" />
            {areCardSoundsMuted ? (
              <path d="m16.5 9.2 4.3 5.6m0-5.6-4.3 5.6" />
            ) : (
              <path d="M16.5 9.2a4 4 0 0 1 0 5.6M18.8 7a7 7 0 0 1 0 10" />
            )}
          </svg>
          <span>{messages.cardSounds}</span>
        </button>
        <div className="tarot-language-menu" ref={languageMenuRef}>
          <button
            ref={languageMenuTriggerRef}
            type="button"
            className="tarot-toolbar-trigger tarot-language-trigger"
            aria-label={`${messages.language}: ${messages.localeLabel}`}
            aria-controls="language-actions"
            aria-expanded={isLanguageMenuOpen}
            aria-haspopup="dialog"
            onClick={() => {
              const willOpen = !isLanguageMenuOpen;

              setIsDeckMenuOpen(false);
              setIsZoomMenuOpen(false);
              setIsSpreadMenuOpen(false);
              setIsArrangeMenuOpen(false);
              setIsShuffleMenuOpen(false);
              if (selectedCard?.zone === "table") {
                setIsInspectorCollapsed(true);
              }
              setIsLanguageMenuOpen(willOpen);
            }}
          >
            <span>{messages.localeShortLabel}</span>
            <svg
              className="tarot-menu-chevron"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m8 10 4 4 4-4" />
            </svg>
          </button>
          {isLanguageMenuOpen && (
            <section
              id="language-actions"
              className="tarot-language-popover"
              role="dialog"
              aria-label={messages.chooseLanguage}
            >
              <span>{messages.language}</span>
              <div role="radiogroup" aria-label={messages.languageOptions}>
                {LANGUAGE_OPTIONS.map((optionLocale) => {
                  const optionMessages = getMessages(optionLocale);

                  return (
                    <button
                      key={optionLocale}
                      type="button"
                      role="radio"
                      aria-checked={locale === optionLocale}
                      data-locale-option={optionLocale}
                      tabIndex={locale === optionLocale ? 0 : -1}
                      onKeyDown={(event) =>
                        handleLanguageRadioKeyDown(event, optionLocale)
                      }
                      onClick={() => updateLocale(optionLocale, true)}
                    >
                      <span>{optionMessages.localeShortLabel}</span>
                      <small>{optionMessages.localeLabel}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
        <div className="tarot-card-menu">
          <button
            ref={inspectorToggleRef}
            type="button"
            className="tarot-toolbar-trigger tarot-card-trigger"
            aria-label={
              hasSelectedTableCard
                ? messages.selectedCardControls(selectedTitle, isInspectorOpen)
                : messages.selectCardControls
            }
            aria-controls="selected-card-inspector"
            aria-expanded={isInspectorOpen}
            disabled={!hasSelectedTableCard || isDeckMoveMode}
            onClick={() => {
              setIsDeckMenuOpen(false);
              setIsZoomMenuOpen(false);
              setIsSpreadMenuOpen(false);
              setIsArrangeMenuOpen(false);
              setIsShuffleMenuOpen(false);
              setIsLanguageMenuOpen(false);
              if (isInspectorOpen) {
                collapseInspector();
              } else {
                expandInspector();
              }
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
              <path d="m12 7 .8 2.1 2.2.1-1.7 1.4.6 2.2-1.9-1.2-1.9 1.2.6-2.2-1.7-1.4 2.2-.1L12 7Z" />
            </svg>
            <span>{messages.card}</span>
            <svg className="tarot-menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m8 10 4 4 4-4" />
            </svg>
          </button>
          {isInspectorOpen && (
            <aside
              id="selected-card-inspector"
              className={`tarot-inspector${selectedCard?.faceUp ? " tarot-inspector--with-reading" : ""}`}
              aria-label={messages.selectedCardControls(selectedTitle, true)}
            >
              <div className="tarot-inspector-controls">
                <div className="tarot-inspector-heading">
                  <p className="tarot-eyebrow">{messages.selectedCard}</p>
                  <button
                    ref={inspectorCollapseRef}
                    type="button"
                    className="tarot-inspector-collapse"
                    aria-label={messages.collapseCardControls}
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
                  <label htmlFor="drawn-card">{messages.browseTableCards}</label>
                  <select
                    id="drawn-card"
                    name="drawn-card"
                    autoComplete="off"
                    value={session.selectedCardId ?? ""}
                    disabled={tableCards.length === 0}
                    onChange={(event) => {
                      const cardId = event.target.value || null;

                      if (cardId) {
                        playCardSound("pickup", { intensity: 0.7 });
                      }
                      handleSelect(cardId);
                    }}
                  >
                    <option value="">{messages.selectDrawnCard}</option>
                    {tableCards.map((card, index) => {
                      const definition = activeCardSet.cards.find(
                        (candidate) => candidate.id === card.cardId
                      );

                      return (
                        <option key={card.id} value={card.id}>
                          {card.faceUp
                            ? definition
                              ? getCardDisplayName(definition, locale)
                              : messages.cardNumber(index + 1)
                            : messages.faceDownCardNumber(index + 1)}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="tarot-inspector-actions">
                  <button type="button" onClick={flipSelected}>
                    {messages.flip} <Shortcut>F</Shortcut>
                  </button>
                  <button type="button" onClick={() => turnSelected(-15)}>
                    {messages.turnLeft} <Shortcut>[</Shortcut>
                  </button>
                  <button type="button" onClick={() => turnSelected(15)}>
                    {messages.turnRight} <Shortcut>]</Shortcut>
                  </button>
                  <button type="button" onClick={() => turnSelected(180)}>
                    {messages.reverse} <Shortcut>R</Shortcut>
                  </button>
                  <button
                    type="button"
                    onClick={() => reorderSelected("backward")}
                    disabled={!canSendBackward}
                  >
                    {messages.sendBack} <Shortcut>Pg↓</Shortcut>
                  </button>
                  <button
                    type="button"
                    onClick={() => reorderSelected("forward")}
                    disabled={!canBringForward}
                  >
                    {messages.bringForward} <Shortcut>Pg↑</Shortcut>
                  </button>
                </div>
              </div>
              {selectedCard?.faceUp && (
                <section
                  className="tarot-card-reading"
                  aria-busy={isReadingLoading}
                  aria-label={messages.symbolism(selectedTitle)}
                >
                  <h3>{messages.symbolismTitle}</h3>
                  {isReadingLoading && (
                    <p className="tarot-card-reading-loading">
                      {messages.openingNotes}
                    </p>
                  )}
                  {selectedReading && (
                    <>
                      <p>{selectedReading.summary}</p>
                      <dl className="tarot-correspondences">
                        {selectedReading.correspondences.map(
                          ({ label, value }) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          )
                        )}
                      </dl>
                      {selectedReading.traditionNote && (
                        <p className="tarot-tradition-note">
                          {selectedReading.traditionNote}
                        </p>
                      )}
                      {selectedReading.perspective && (
                        <div className="tarot-card-perspective">
                          <span>{selectedReading.perspective.label}</span>
                          <p>{selectedReading.perspective.text}</p>
                        </div>
                      )}
                      <div className="tarot-card-sources">
                        <span>{messages.sources}</span>
                        <ul>
                          {selectedReading.sources.map((source) => (
                            <li key={source.href}>
                              <a
                                href={source.href}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {source.label}
                              </a>
                              {source.locator && <small>{source.locator}</small>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </section>
              )}
            </aside>
          )}
        </div>
      </nav>

      <p className="tarot-live-status" aria-live="polite">
        {deckCount === 0
          ? messages.emptyDeck
          : messages.liveStatus(deckCardCount, tableCardCount)}
      </p>
    </main>
  );
}
