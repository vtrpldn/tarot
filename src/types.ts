export type CardSetKind = "tarot" | "lenormand";

export type TarotSuit = "cups" | "pentacles" | "swords" | "wands";

export type CardArtwork = {
  /** Small WebP texture used for cards on the table. */
  preview: string;
  /** Higher-resolution WebP texture used for the selected card. */
  detail: string;
  /** Original artwork retained as the archival source. */
  source: string;
};

export type CardArtworkCrop = {
  /** Fraction of the source texture hidden from each edge. */
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CardDefinition = {
  id: string;
  name: string;
  order: number;
  image: CardArtwork;
  arcana?: "major" | "minor";
  suit?: TarotSuit;
  rank?: string;
};

export type CardSetDefinition = {
  id: string;
  kind: CardSetKind;
  label: string;
  shortLabel: string;
  description: string;
  cardAspectRatio: number;
  artworkCrop?: CardArtworkCrop;
  back: CardArtwork;
  cards: CardDefinition[];
};

export type TableZone = "deck" | "table";

export type TablePoint = [number, number];

export const TABLE_POINT_LIMIT = 2.6;

export type CardLayerDirection = "forward" | "backward";

export type TableCard = {
  id: string;
  cardId: string;
  cardSetId: string;
  zone: TableZone;
  position: TablePoint;
  rotation: number;
  zIndex: number;
  faceUp: boolean;
};

export type TableSnapshot = {
  cards: TableCard[];
  deckPosition: TablePoint | null;
  selectedCardId: string | null;
};

export type TarotSession = {
  cardSetId: string;
  cards: TableCard[];
  deckPosition: TablePoint | null;
  selectedCardId: string | null;
  history: TableSnapshot[];
};

export type TableLayout = "fan" | "grid" | "stack" | "sort";

/** @deprecated Kept while the legacy route components are retired. */
export type TarotDecks = "majorArcana" | "minorArcana" | "all";
