import type { AppLocale } from "./locale";
import type { CardSetKind, CardSpreadId } from "@/types";
import type { SpreadRelationshipId } from "@/lib/tarot-spreads";

type CardCategory = "lenormand" | "major" | "minor" | "oracle";

type Count = {
  count: number;
  noun: string;
};

export type Messages = {
  localeLabel: string;
  localeShortLabel: string;
  loadingTable: string;
  tableDescription: string;
  tableActions: string;
  deckTrigger: (deckLabel: string, deck: Count) => string;
  chooseDeck: string;
  chooseDeckHint: string;
  currentDeck: string;
  deckKinds: Readonly<Record<CardSetKind, string>>;
  deck: string;
  cardsInDeck: (deck: Count) => string;
  tableZoom: (percent: number) => string;
  zoom: string;
  zoomOut: string;
  resetZoom: string;
  zoomIn: string;
  enterFullscreen: string;
  exitFullscreen: string;
  cancelDeckMove: string;
  movingDeck: string;
  cancel: string;
  chooseSpread: string;
  spreads: string;
  popularSpreads: string;
  chooseASpread: string;
  arrangeAndUndo: string;
  arrange: string;
  tableActionsTitle: string;
  layouts: Readonly<Record<"fan" | "grid" | "stack" | "sort", [string, string]>>;
  moveDeck: [string, string];
  undo: [string, string];
  redo: [string, string];
  resetTable: string;
  resetTableDescription: (count: number) => string;
  tarotCollection: string;
  tarotCollectionActions: string;
  tarotCollections: Readonly<
    Record<"all" | "major" | "minor" | "court", [string, string]>
  >;
  cardSounds: string;
  cardSoundsOn: string;
  cardSoundsOff: string;
  cardSoundsDescription: string;
  config: string;
  configureTable: string;
  background: string;
  backgroundOptions: string;
  backgroundConstellation: string;
  backgroundSolarTemple: string;
  backgroundMoonlitGrove: string;
  language: string;
  chooseLanguage: string;
  languageOptions: string;
  card: string;
  selectedCardControls: (title: string, isOpen: boolean) => string;
  selectCardControls: string;
  selectedCard: string;
  collapseCardControls: string;
  browseTableCards: string;
  selectDrawnCard: string;
  cardNumber: (number: number) => string;
  faceDownCard: string;
  faceDownCardNumber: (number: number) => string;
  selectedHint: (args: {
    category: CardCategory;
    layer: number;
    total: number;
    rotation: number;
    isReversed: boolean;
  }) => string;
  faceDownHint: (layer: number, total: number) => string;
  noSelectionHint: string;
  flip: string;
  turnLeft: string;
  turnRight: string;
  reverse: string;
  sendBack: string;
  bringForward: string;
  moveUp: string;
  moveDown: string;
  symbolism: (title: string) => string;
  symbolismTitle: string;
  openingNotes: string;
  sources: string;
  emptyDeck: string;
  liveStatus: (deck: Count, table: Count) => string;
  spreadLabels: Readonly<Record<CardSpreadId, [string, string]>>;
  spreadRelationshipLabels: Readonly<
    Record<SpreadRelationshipId, string>
  >;
};

const cardNoun = (count: number) => (count === 1 ? "card" : "cards");

const tableStatus = ({ count, noun }: Count) =>
  `${count} ${noun} ${count === 1 ? "is" : "are"} on the table.`;

const messages: Record<AppLocale, Messages> = {
  en: {
    localeLabel: "English",
    localeShortLabel: "EN",
    loadingTable: "Opening the table…",
    tableDescription:
      "Interactive card table. Pull any exposed card from the deck to draw it and drag table cards to arrange them. Scroll the table background to zoom, hold Space while dragging to pan, use I and K to change the selected card layer, and J and L to rotate it.",
    tableActions: "Table actions",
    deckTrigger: (deckLabel, deck) =>
      `Choose deck. ${deckLabel}, ${deck.count} ${deck.noun} remaining`,
    chooseDeck: "Choose deck",
    chooseDeckHint:
      "Focus a deck to preview it. Choosing a different deck resets the table with a fresh shuffle.",
    currentDeck: "Current deck",
    deckKinds: {
      tarot: "Tarot",
      lenormand: "Lenormand",
      oracle: "Oracle",
    },
    deck: "Deck",
    cardsInDeck: (deck) => `${deck.count} ${deck.noun} in the deck`,
    tableZoom: (percent) => `Table zoom, ${percent} percent`,
    zoom: "Zoom",
    zoomOut: "Zoom out",
    resetZoom: "Reset table zoom",
    zoomIn: "Zoom in",
    enterFullscreen: "Enter fullscreen",
    exitFullscreen: "Exit fullscreen",
    cancelDeckMove: "Cancel deck move mode",
    movingDeck: "Moving deck",
    cancel: "Cancel",
    chooseSpread: "Choose a spread",
    spreads: "Spreads",
    popularSpreads: "Popular spreads",
    chooseASpread: "Choose a spread",
    arrangeAndUndo: "Arrange cards and undo",
    arrange: "Arrange",
    tableActionsTitle: "Table actions",
    layouts: {
      fan: ["Fan", "Open arc"],
      grid: ["Grid", "Even rows"],
      stack: ["Stack", "Single pile"],
      sort: ["Sort", "Deck order"],
    },
    moveDeck: ["Move deck", "Then drag the pile"],
    undo: ["Undo", "Last table move"],
    redo: ["Redo", "Reapply last table move"],
    resetTable: "Reset table",
    resetTableDescription: (count) => `Return all ${count} cards to the deck`,
    tarotCollection: "Tarot collection",
    tarotCollectionActions: "Tarot collection actions",
    tarotCollections: {
      all: ["All cards", "78 cards"],
      major: ["Major Arcana", "22 cards"],
      minor: ["Minor Arcana", "56 cards"],
      court: ["Court cards", "16 cards"],
    },
    cardSounds: "Card sounds",
    cardSoundsOn: "Card sounds on",
    cardSoundsOff: "Card sounds off",
    cardSoundsDescription: "Atmospheric sounds while you handle cards",
    config: "Config",
    configureTable: "Configure table",
    background: "Background",
    backgroundOptions: "Background options",
    backgroundConstellation: "Constellation",
    backgroundSolarTemple: "Solar temple",
    backgroundMoonlitGrove: "Moonlit grove",
    language: "Language",
    chooseLanguage: "Choose language",
    languageOptions: "Language options",
    card: "Card",
    selectedCardControls: (title, isOpen) =>
      `${isOpen ? "Close" : "Open"} selected card controls for ${title}`,
    selectCardControls: "Select a card to use card controls",
    selectedCard: "Selected card",
    collapseCardControls: "Collapse selected card controls",
    browseTableCards: "Browse cards on the table",
    selectDrawnCard: "Select a drawn card",
    cardNumber: (number) => `Card ${number}`,
    faceDownCard: "Face-down card",
    faceDownCardNumber: (number) => `Face-down card ${number}`,
    selectedHint: ({ category, layer, total, rotation, isReversed }) => {
      const orientation = isReversed
        ? "Reversed · "
        : rotation > 0.8
          ? `Rotation ${Math.round(rotation)}° · `
          : "";
      const categoryLabel =
        category === "lenormand"
          ? "Lenormand"
          : category === "oracle"
            ? "Oracle"
          : category === "major"
            ? "Major Arcana"
            : "Minor Arcana";

      return `${orientation}${categoryLabel} · Layer ${layer} of ${total}`;
    },
    faceDownHint: (layer, total) =>
      `Face down · Layer ${layer} of ${total}. Use the layer controls to restack.`,
    noSelectionHint: "Draw a card or tap one on the table.",
    flip: "Flip",
    turnLeft: "Turn −15°",
    turnRight: "Turn +15°",
    reverse: "Reverse",
    sendBack: "Send back",
    bringForward: "Bring forward",
    moveUp: "Move up",
    moveDown: "Move down",
    symbolism: (title) => `Symbolism and correspondences for ${title}`,
    symbolismTitle: "Symbolism & correspondences",
    openingNotes: "Opening the card notes…",
    sources: "Sources",
    emptyDeck: "The deck is empty. Reset the table to begin again.",
    liveStatus: (deck, table) =>
      `${deck.count} ${deck.noun} ${deck.count === 1 ? "remains" : "remain"} in the deck. ${tableStatus(table)}`,
    spreadLabels: {
      "one-card": ["One card", "1 card"],
      "three-card": ["Past · Present · Future", "3 cards"],
      horseshoe: ["Horseshoe", "7 cards"],
      "celtic-cross": ["Celtic Cross", "10 cards"],
      "lenormand-three-card": ["Three-card line", "3 cards"],
      "lenormand-five-card": ["Five-card line", "5 cards"],
      "lenormand-portrait": ["Portrait", "9 cards"],
      "lenormand-grand-tableau": ["Grand Tableau", "36 cards"],
    },
    spreadRelationshipLabels: {
      "shapes-present": "shapes the present",
      "guides-future": "guides the future",
      "arrives-now": "arrives in the now",
      "reveals-hidden": "reveals the hidden",
      "meets-obstacle": "meets the obstacle",
      "draws-support": "draws on support",
      "informs-counsel": "informs the counsel",
      "guides-outcome": "guides the outcome",
      "crowns-present": "crowns the present",
      "roots-present": "roots the present",
      "releases-past": "releases the past",
      "opens-future": "opens the future",
      "future-meets-context": "future meets context",
      "self-meets-context": "self meets context",
      "context-shapes-hopes": "context shapes hopes",
      "hopes-guide-outcome": "hopes guide outcome",
      "sets-scene": "sets the scene",
      "centers-matter": "centers the matter",
      "shows-turn": "shows the turn",
      "shows-outcome": "shows the outcome",
      "guides-view": "guides the view",
      "frames-past": "frames the past",
      "grounds-reading": "grounds the reading",
    },
  },
  "pt-BR": {
    localeLabel: "Português (Brasil)",
    localeShortLabel: "PT",
    loadingTable: "Abrindo a mesa…",
    tableDescription:
      "Mesa de cartas interativa. Puxe qualquer carta exposta do monte para tirá-la e arraste as cartas na mesa para organizá-las. Role sobre o fundo da mesa para dar zoom, mantenha Espaço pressionado enquanto arrasta para mover a visão, use I e K para mudar a camada da carta selecionada e J e L para girá-la.",
    tableActions: "Ações da mesa",
    deckTrigger: (deckLabel, deck) =>
      `Escolher baralho. ${deckLabel}, restam ${deck.count} ${deck.noun}`,
    chooseDeck: "Escolher baralho",
    chooseDeckHint:
      "Foque um baralho para visualizá-lo. Escolher outro baralho redefine a mesa com um novo embaralhamento.",
    currentDeck: "Baralho atual",
    deckKinds: {
      tarot: "Tarô",
      lenormand: "Lenormand",
      oracle: "Oráculo",
    },
    deck: "Baralho",
    cardsInDeck: (deck) => `${deck.count} ${deck.noun} no baralho`,
    tableZoom: (percent) => `Zoom da mesa, ${percent} por cento`,
    zoom: "Zoom",
    zoomOut: "Diminuir zoom",
    resetZoom: "Redefinir zoom da mesa",
    zoomIn: "Aumentar zoom",
    enterFullscreen: "Entrar em tela cheia",
    exitFullscreen: "Sair da tela cheia",
    cancelDeckMove: "Cancelar modo de mover baralho",
    movingDeck: "Movendo baralho",
    cancel: "Cancelar",
    chooseSpread: "Escolher uma abertura",
    spreads: "Aberturas",
    popularSpreads: "Aberturas populares",
    chooseASpread: "Escolha uma abertura",
    arrangeAndUndo: "Organizar cartas e desfazer",
    arrange: "Organizar",
    tableActionsTitle: "Ações da mesa",
    layouts: {
      fan: ["Leque", "Arco aberto"],
      grid: ["Grade", "Linhas regulares"],
      stack: ["Pilha", "Uma só pilha"],
      sort: ["Ordenar", "Ordem do baralho"],
    },
    moveDeck: ["Mover baralho", "Arraste a pilha"],
    undo: ["Desfazer", "Último movimento"],
    redo: ["Refazer", "Reaplicar o último movimento"],
    resetTable: "Redefinir mesa",
    resetTableDescription: (count) => `Devolver todas as ${count} cartas ao baralho`,
    tarotCollection: "Coleção de tarot",
    tarotCollectionActions: "Ações da coleção de tarot",
    tarotCollections: {
      all: ["Todas as cartas", "78 cartas"],
      major: ["Arcanos Maiores", "22 cartas"],
      minor: ["Arcanos Menores", "56 cartas"],
      court: ["Cartas da corte", "16 cartas"],
    },
    cardSounds: "Sons das cartas",
    cardSoundsOn: "Sons das cartas ativados",
    cardSoundsOff: "Sons das cartas desativados",
    cardSoundsDescription: "Sons atmosféricos ao interagir com as cartas",
    config: "Configurações",
    configureTable: "Configurar mesa",
    background: "Fundo",
    backgroundOptions: "Opções de fundo",
    backgroundConstellation: "Constelação",
    backgroundSolarTemple: "Templo solar",
    backgroundMoonlitGrove: "Bosque ao luar",
    language: "Idioma",
    chooseLanguage: "Escolher idioma",
    languageOptions: "Opções de idioma",
    card: "Carta",
    selectedCardControls: (title, isOpen) =>
      `${isOpen ? "Fechar" : "Abrir"} controles da carta selecionada: ${title}`,
    selectCardControls: "Selecione uma carta para usar os controles",
    selectedCard: "Carta selecionada",
    collapseCardControls: "Recolher controles da carta selecionada",
    browseTableCards: "Explorar cartas na mesa",
    selectDrawnCard: "Selecione uma carta tirada",
    cardNumber: (number) => `Carta ${number}`,
    faceDownCard: "Carta virada para baixo",
    faceDownCardNumber: (number) => `Carta virada para baixo ${number}`,
    selectedHint: ({ category, layer, total, rotation, isReversed }) => {
      const orientation = isReversed
        ? "Invertida · "
        : rotation > 0.8
          ? `Rotação ${Math.round(rotation)}° · `
          : "";
      const categoryLabel =
        category === "lenormand"
          ? "Lenormand"
          : category === "oracle"
            ? "Oráculo"
          : category === "major"
            ? "Arcanos Maiores"
            : "Arcanos Menores";

      return `${orientation}${categoryLabel} · Camada ${layer} de ${total}`;
    },
    faceDownHint: (layer, total) =>
      `Virada para baixo · Camada ${layer} de ${total}. Use os controles de camada para reorganizar.`,
    noSelectionHint: "Tire uma carta ou toque em uma carta na mesa.",
    flip: "Virar",
    turnLeft: "Girar −15°",
    turnRight: "Girar +15°",
    reverse: "Inverter",
    sendBack: "Enviar para trás",
    bringForward: "Trazer para frente",
    moveUp: "Mover para cima",
    moveDown: "Mover para baixo",
    symbolism: (title) => `Simbolismo e correspondências de ${title}`,
    symbolismTitle: "Simbolismo e correspondências",
    openingNotes: "Abrindo as notas da carta…",
    sources: "Fontes",
    emptyDeck: "O baralho está vazio. Redefina a mesa para recomeçar.",
    liveStatus: (deck, table) =>
      `Restam ${deck.count} ${deck.noun} no baralho. ${table.count} ${table.noun} ${table.count === 1 ? "está" : "estão"} na mesa.`,
    spreadLabels: {
      "one-card": ["Uma carta", "1 carta"],
      "three-card": ["Passado · Presente · Futuro", "3 cartas"],
      horseshoe: ["Ferradura", "7 cartas"],
      "celtic-cross": ["Cruz Celta", "10 cartas"],
      "lenormand-three-card": ["Linha de três cartas", "3 cartas"],
      "lenormand-five-card": ["Linha de cinco cartas", "5 cartas"],
      "lenormand-portrait": ["Retrato", "9 cartas"],
      "lenormand-grand-tableau": ["Grande Tableau", "36 cartas"],
    },
    spreadRelationshipLabels: {
      "shapes-present": "molda o presente",
      "guides-future": "guia o futuro",
      "arrives-now": "chega ao agora",
      "reveals-hidden": "revela o oculto",
      "meets-obstacle": "encontra o obstáculo",
      "draws-support": "busca apoio",
      "informs-counsel": "orienta o conselho",
      "guides-outcome": "guia o desfecho",
      "crowns-present": "coroa o presente",
      "roots-present": "enraíza o presente",
      "releases-past": "libera o passado",
      "opens-future": "abre o futuro",
      "future-meets-context": "futuro encontra contexto",
      "self-meets-context": "você no contexto",
      "context-shapes-hopes": "contexto molda esperanças",
      "hopes-guide-outcome": "esperanças guiam desfecho",
      "sets-scene": "prepara o cenário",
      "centers-matter": "centra o tema",
      "shows-turn": "mostra a virada",
      "shows-outcome": "mostra o desfecho",
      "guides-view": "guia a visão",
      "frames-past": "enquadra o passado",
      "grounds-reading": "firma a leitura",
    },
  },
};

export function getMessages(locale: AppLocale): Messages {
  return messages[locale];
}

export function getCardCount(locale: AppLocale, count: number): Count {
  if (locale === "pt-BR") {
    return { count, noun: count === 1 ? "carta" : "cartas" };
  }

  return { count, noun: cardNoun(count) };
}
