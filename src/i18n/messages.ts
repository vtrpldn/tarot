import type { AppLocale } from "./locale";
import type { CardSpreadId } from "@/lib/tarot-spreads";

type CardCategory = "lenormand" | "major" | "minor";

type Count = {
  count: number;
  noun: string;
};

type Messages = {
  localeLabel: string;
  localeShortLabel: string;
  loadingTable: string;
  tableDescription: string;
  tableActions: string;
  deckTrigger: (deckLabel: string, deck: Count) => string;
  chooseDeck: string;
  deck: string;
  cardsInDeck: (deck: Count) => string;
  tableZoom: (percent: number) => string;
  zoom: string;
  zoomOut: string;
  resetZoom: string;
  zoomIn: string;
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
      "Interactive card table. Drag the top card to draw it and drag table cards to arrange them. Scroll the table background to zoom, hold Space while dragging to pan, use I and K to change the selected card layer, and J and L to rotate it.",
    tableActions: "Table actions",
    deckTrigger: (deckLabel, deck) =>
      `Choose deck. ${deckLabel}, ${deck.count} ${deck.noun} remaining`,
    chooseDeck: "Choose deck",
    deck: "Deck",
    cardsInDeck: (deck) => `${deck.count} ${deck.noun} in the deck`,
    tableZoom: (percent) => `Table zoom, ${percent} percent`,
    zoom: "Zoom",
    zoomOut: "Zoom out",
    resetZoom: "Reset table zoom",
    zoomIn: "Zoom in",
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
  },
  "pt-BR": {
    localeLabel: "Português (Brasil)",
    localeShortLabel: "PT",
    loadingTable: "Abrindo a mesa…",
    tableDescription:
      "Mesa de cartas interativa. Arraste a carta do topo para tirá-la e arraste as cartas na mesa para organizá-las. Role sobre o fundo da mesa para dar zoom, mantenha Espaço pressionado enquanto arrasta para mover a visão, use I e K para mudar a camada da carta selecionada e J e L para girá-la.",
    tableActions: "Ações da mesa",
    deckTrigger: (deckLabel, deck) =>
      `Escolher baralho. ${deckLabel}, restam ${deck.count} ${deck.noun}`,
    chooseDeck: "Escolher baralho",
    deck: "Baralho",
    cardsInDeck: (deck) => `${deck.count} ${deck.noun} no baralho`,
    tableZoom: (percent) => `Zoom da mesa, ${percent} por cento`,
    zoom: "Zoom",
    zoomOut: "Diminuir zoom",
    resetZoom: "Redefinir zoom da mesa",
    zoomIn: "Aumentar zoom",
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
