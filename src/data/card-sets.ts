import type {
  CardArtwork,
  CardDefinition,
  CardSetDefinition,
  TarotSuit,
} from "@/types";

const artwork = (filename: string): CardArtwork => {
  const optimizedFilename = filename.replace(/\.png$/i, ".webp");

  return {
    preview: `/decks/rider-waite-smith/preview/${optimizedFilename}`,
    detail: `/decks/rider-waite-smith/detail/${optimizedFilename}`,
    source: `/img/${filename}`,
  };
};

const majorArcana = [
  ["0-the-fool.png", "The Fool"],
  ["1-the-magician.png", "The Magician"],
  ["2-the-high-priestess.png", "The High Priestess"],
  ["3-the-empress.png", "The Empress"],
  ["4-the-emperor.png", "The Emperor"],
  ["5-the-hierophant.png", "The Hierophant"],
  ["6-the-lovers.png", "The Lovers"],
  ["7-the-chariot.png", "The Chariot"],
  ["8-strength.png", "Strength"],
  ["9-the-hermit.png", "The Hermit"],
  ["10-wheel-of-fortune.png", "Wheel of Fortune"],
  ["11-justice.png", "Justice"],
  ["12-the-hanged-man.png", "The Hanged Man"],
  ["13-death.png", "Death"],
  ["14-temperance.png", "Temperance"],
  ["15-the-devil.png", "The Devil"],
  ["16-the-tower.png", "The Tower"],
  ["17-the-star.png", "The Star"],
  ["18-the-moon.png", "The Moon"],
  ["19-the-sun.png", "The Sun"],
  ["20-judgement.png", "Judgement"],
  ["21-the-world.png", "The World"],
] as const;

const minorRanks = [
  ["1", "Ace"],
  ["2", "Two"],
  ["3", "Three"],
  ["4", "Four"],
  ["5", "Five"],
  ["6", "Six"],
  ["7", "Seven"],
  ["8", "Eight"],
  ["9", "Nine"],
  ["10", "Ten"],
  ["page", "Page"],
  ["knight", "Knight"],
  ["queen", "Queen"],
  ["king", "King"],
] as const;

const suits: Array<{ id: TarotSuit; label: string }> = [
  { id: "cups", label: "Cups" },
  { id: "pentacles", label: "Pentacles" },
  { id: "swords", label: "Swords" },
  { id: "wands", label: "Wands" },
];

const riderWaiteSmithCards: CardDefinition[] = [
  ...majorArcana.map(([filename, name], order) => ({
    id: filename.replace(/\.png$/i, ""),
    name,
    order,
    image: artwork(filename),
    arcana: "major" as const,
    rank: String(order),
  })),
  ...suits.flatMap(({ id: suit, label: suitLabel }, suitIndex) =>
    minorRanks.map(([rank, rankLabel], rankIndex) => {
      const filename = `${suit}-${rank}.png`;

      return {
        id: filename.replace(/\.png$/i, ""),
        name: `${rankLabel} of ${suitLabel}`,
        order: majorArcana.length + suitIndex * minorRanks.length + rankIndex,
        image: artwork(filename),
        arcana: "minor" as const,
        suit,
        rank,
      };
    })
  ),
];

export const riderWaiteSmith: CardSetDefinition = {
  id: "rider-waite-smith",
  kind: "tarot",
  label: "Rider–Waite–Smith Tarot",
  shortLabel: "Rider–Waite–Smith",
  description: "A complete 78-card deck for open-ended readings and spreads.",
  cardAspectRatio: 1017 / 1776,
  back: artwork("back.png"),
  cards: riderWaiteSmithCards,
};

/**
 * Add another Tarot deck or a Lenormand set here. The table session and card
 * interactions are deliberately independent of card count, art, or aspect ratio.
 */
export const cardSets: CardSetDefinition[] = [riderWaiteSmith];

export function getCardSet(cardSetId: string): CardSetDefinition {
  const cardSet = cardSets.find((set) => set.id === cardSetId);

  if (!cardSet) {
    throw new Error(`Unknown card set: ${cardSetId}`);
  }

  return cardSet;
}
