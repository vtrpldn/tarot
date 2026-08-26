import type {
  CardArtwork,
  CardArtworkCrop,
  CardDefinition,
  CardSetDefinition,
  CardSetSource,
  TarotSuit,
} from "@/types";
import type { AppLocale } from "@/i18n/locale";

const getCroppedAspectRatio = (
  sourceAspectRatio: number,
  crop: CardArtworkCrop
) =>
  sourceAspectRatio *
  ((1 - crop.left - crop.right) / (1 - crop.top - crop.bottom));

const marseilleArtworkCrop = {
  left: 40 / 792,
  right: 40 / 792,
  top: 44 / 1464,
  bottom: 40 / 1464,
} satisfies CardArtworkCrop;

const lenormandArtworkCrop = {
  left: 64 / 918,
  right: 60 / 918,
  top: 70 / 1494,
  bottom: 70 / 1494,
} satisfies CardArtworkCrop;

const artwork = (filename: string): CardArtwork => {
  const optimizedFilename = filename.replace(/\.png$/i, ".webp");

  return {
    preview: `/decks/rider-waite-smith/preview/${optimizedFilename}`,
    detail: `/decks/rider-waite-smith/detail/${optimizedFilename}`,
    source: `/img/${filename}`,
  };
};

const lenormandArtwork = (filename: string): CardArtwork => ({
  preview: `/decks/classic-lenormand/preview/${filename}.webp`,
  detail: `/decks/classic-lenormand/detail/${filename}.webp`,
  source: `/decks/classic-lenormand/source/${filename}.avif`,
});

const marseilleArtwork = (filename: string): CardArtwork => ({
  preview: `/decks/tarot-de-marseille/preview/${filename}.webp`,
  detail: `/decks/tarot-de-marseille/detail/${filename}.webp`,
  source: `/decks/tarot-de-marseille/source/${filename}.webp`,
});

const fortyServantsArtwork = (
  filename: string,
  sourceExtension = "png"
): CardArtwork => ({
  preview: `/decks/forty-servants/preview/${filename}.webp`,
  detail: `/decks/forty-servants/detail/${filename}.webp`,
  source: `/decks/forty-servants/source/${filename}.${sourceExtension}`,
});

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

const riderWaitePortugueseMajorNames: Record<string, string> = {
  "0-the-fool": "O Louco",
  "1-the-magician": "O Mago",
  "2-the-high-priestess": "A Sacerdotisa",
  "3-the-empress": "A Imperatriz",
  "4-the-emperor": "O Imperador",
  "5-the-hierophant": "O Hierofante",
  "6-the-lovers": "Os Enamorados",
  "7-the-chariot": "O Carro",
  "8-strength": "A Força",
  "9-the-hermit": "O Eremita",
  "10-wheel-of-fortune": "A Roda da Fortuna",
  "11-justice": "A Justiça",
  "12-the-hanged-man": "O Enforcado",
  "13-death": "A Morte",
  "14-temperance": "A Temperança",
  "15-the-devil": "O Diabo",
  "16-the-tower": "A Torre",
  "17-the-star": "A Estrela",
  "18-the-moon": "A Lua",
  "19-the-sun": "O Sol",
  "20-judgement": "O Julgamento",
  "21-the-world": "O Mundo",
};

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

const portugueseMinorRanks: Record<string, string> = {
  "1": "Ás",
  "2": "Dois",
  "3": "Três",
  "4": "Quatro",
  "5": "Cinco",
  "6": "Seis",
  "7": "Sete",
  "8": "Oito",
  "9": "Nove",
  "10": "Dez",
  page: "Pajem",
  knight: "Cavaleiro",
  queen: "Rainha",
  king: "Rei",
};

const portugueseTarotSuits: Record<TarotSuit, string> = {
  cups: "Copas",
  pentacles: "Ouros",
  swords: "Espadas",
  wands: "Paus",
};

const riderWaiteSmithCards: CardDefinition[] = [
  ...majorArcana.map(([filename, name], order) => ({
    id: filename.replace(/\.png$/i, ""),
    name,
    displayNames: {
      "pt-BR": riderWaitePortugueseMajorNames[filename.replace(/\.png$/i, "")],
    },
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
        displayNames: {
          "pt-BR": `${portugueseMinorRanks[rank]} de ${portugueseTarotSuits[suit]}`,
        },
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
  displayLabels: { "pt-BR": "Tarô Rider–Waite–Smith" },
  displayShortLabels: { "pt-BR": "Rider–Waite–Smith" },
  displayDescriptions: {
    "pt-BR": "Um baralho completo de 78 cartas para tiragens e leituras abertas.",
  },
  sources: [
    {
      label: "Artwork archive · Wikimedia Commons",
      displayLabels: { "pt-BR": "Arquivo de imagens · Wikimedia Commons" },
      href: "https://commons.wikimedia.org/wiki/Category:Rider-Waite_tarot_deck",
    },
    {
      label: "A. E. Waite · The Pictorial Key to the Tarot",
      displayLabels: {
        "pt-BR": "A. E. Waite · The Pictorial Key to the Tarot",
      },
      href: "https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot",
    },
  ],
  cardAspectRatio: 1017 / 1776,
  back: artwork("back.png"),
  cards: riderWaiteSmithCards,
};

const marseilleMajorArcana = [
  ["00-le-mat", "Le Mat"],
  ["01-le-bateleur", "Le Bateleur"],
  ["02-la-papesse", "La Papesse"],
  ["03-l-imperatrice", "L'Impératrice"],
  ["04-l-empereur", "L'Empereur"],
  ["05-le-pape", "Le Pape"],
  ["06-l-amoureux", "L'Amoureux"],
  ["07-le-chariot", "Le Chariot"],
  ["08-la-justice", "La Justice"],
  ["09-l-ermite", "L'Ermite"],
  ["10-la-roue-de-fortune", "La Roue de Fortune"],
  ["11-la-force", "La Force"],
  ["12-le-pendu", "Le Pendu"],
  ["13-arcane-xiii", "Arcane XIII"],
  ["14-temperance", "Tempérance"],
  ["15-le-diable", "Le Diable"],
  ["16-la-maison-dieu", "La Maison Dieu"],
  ["17-l-etoile", "L'Étoile"],
  ["18-la-lune", "La Lune"],
  ["19-le-soleil", "Le Soleil"],
  ["20-le-jugement", "Le Jugement"],
  ["21-le-monde", "Le Monde"],
] as const;

const marseillePortugueseMajorNames: Record<string, string> = {
  "00-le-mat": "O Louco",
  "01-le-bateleur": "O Mago",
  "02-la-papesse": "A Papisa",
  "03-l-imperatrice": "A Imperatriz",
  "04-l-empereur": "O Imperador",
  "05-le-pape": "O Papa",
  "06-l-amoureux": "Os Enamorados",
  "07-le-chariot": "O Carro",
  "08-la-justice": "A Justiça",
  "09-l-ermite": "O Eremita",
  "10-la-roue-de-fortune": "A Roda da Fortuna",
  "11-la-force": "A Força",
  "12-le-pendu": "O Enforcado",
  "13-arcane-xiii": "Arcano XIII",
  "14-temperance": "A Temperança",
  "15-le-diable": "O Diabo",
  "16-la-maison-dieu": "A Casa de Deus",
  "17-l-etoile": "A Estrela",
  "18-la-lune": "A Lua",
  "19-le-soleil": "O Sol",
  "20-le-jugement": "O Julgamento",
  "21-le-monde": "O Mundo",
};

const marseilleRanks = [
  ["1", "As"],
  ["2", "Deux"],
  ["3", "Trois"],
  ["4", "Quatre"],
  ["5", "Cinq"],
  ["6", "Six"],
  ["7", "Sept"],
  ["8", "Huit"],
  ["9", "Neuf"],
  ["10", "Dix"],
  ["page", "Valet"],
  ["knight", "Cavalier"],
  ["queen", "Reine"],
  ["king", "Roi"],
] as const;

const marseilleSuits: Array<{
  id: TarotSuit;
  filename: string;
  label: string;
}> = [
  { id: "cups", filename: "cups", label: "Coupes" },
  { id: "pentacles", filename: "pentacles", label: "Deniers" },
  { id: "swords", filename: "swords", label: "Épées" },
  { id: "wands", filename: "wands", label: "Bâtons" },
];

const portugueseMarseilleRanks: Record<string, string> = {
  ...portugueseMinorRanks,
  page: "Valete",
};

const tarotDeMarseilleCards: CardDefinition[] = [
  ...marseilleMajorArcana.map(([filename, name], order) => ({
    id: filename,
    name,
    displayNames: { "pt-BR": marseillePortugueseMajorNames[filename] },
    order,
    image: marseilleArtwork(filename),
    arcana: "major" as const,
    rank: String(order),
  })),
  ...marseilleSuits.flatMap(({ id: suit, filename, label }, suitIndex) =>
    marseilleRanks.map(([rank, rankLabel], rankIndex) => {
      const cardFilename = `${filename}-${rank}`;

      return {
        id: cardFilename,
        name: `${rankLabel} de ${label}`,
        displayNames: {
          "pt-BR": `${portugueseMarseilleRanks[rank]} de ${portugueseTarotSuits[suit]}`,
        },
        order:
          marseilleMajorArcana.length +
          suitIndex * marseilleRanks.length +
          rankIndex,
        image: marseilleArtwork(cardFilename),
        arcana: "minor" as const,
        suit,
        rank,
      };
    })
  ),
];

export const tarotDeMarseille: CardSetDefinition = {
  id: "tarot-de-marseille",
  kind: "tarot",
  label: "Tarot de Marseille · Jean Dodal",
  shortLabel: "Tarot de Marseille",
  description:
    "Jean Dodal's complete 78-card Tarot de Marseille, printed in Lyon circa 1701–1715.",
  displayLabels: { "pt-BR": "Tarô de Marselha · Jean Dodal" },
  displayShortLabels: { "pt-BR": "Tarô de Marselha" },
  displayDescriptions: {
    "pt-BR": "O Tarô de Marselha completo de Jean Dodal, impresso em Lyon por volta de 1701–1715.",
  },
  sources: [
    {
      label: "Jean Dodal Tarot · Gallica scan",
      displayLabels: {
        "pt-BR": "Tarô de Jean Dodal · digitalização Gallica",
      },
      href: "https://gallica.bnf.fr/ark:/12148/btv1b10537343h",
    },
    {
      label: "Bibliographic record · Bibliothèque nationale de France",
      displayLabels: {
        "pt-BR": "Registro bibliográfico · Biblioteca Nacional da França",
      },
      href: "https://catalogue.bnf.fr/ark:/12148/cb40918567t",
    },
  ],
  cardAspectRatio: getCroppedAspectRatio(33 / 61, marseilleArtworkCrop),
  artworkCrop: marseilleArtworkCrop,
  back: marseilleArtwork("back"),
  cards: tarotDeMarseilleCards,
};

const classicLenormandCards = [
  ["01-rider", "Rider"],
  ["02-clover", "Clover"],
  ["03-ship", "Ship"],
  ["04-house", "House"],
  ["05-tree", "Tree"],
  ["06-clouds", "Clouds"],
  ["07-snake", "Snake"],
  ["08-coffin", "Coffin"],
  ["09-bouquet", "Bouquet"],
  ["10-scythe", "Scythe"],
  ["11-whip", "Whip"],
  ["12-birds", "Birds"],
  ["13-child", "Child"],
  ["14-fox", "Fox"],
  ["15-bear", "Bear"],
  ["16-stars", "Stars"],
  ["17-stork", "Stork"],
  ["18-dog", "Dog"],
  ["19-tower", "Tower"],
  ["20-garden", "Garden"],
  ["21-mountain", "Mountain"],
  ["22-crossroads", "Crossroads"],
  ["23-mice", "Mice"],
  ["24-heart", "Heart"],
  ["25-ring", "Ring"],
  ["26-book", "Book"],
  ["27-letter", "Letter"],
  ["28-man", "Man"],
  ["29-woman", "Woman"],
  ["30-lily", "Lilies"],
  ["31-sun", "Sun"],
  ["32-moon", "Moon"],
  ["33-key", "Key"],
  ["34-fish", "Fish"],
  ["35-anchor", "Anchor"],
  ["36-cross", "Cross"],
] as const;

const lenormandPortugueseNames: Record<string, string> = {
  "01-rider": "Cavaleiro",
  "02-clover": "Trevo",
  "03-ship": "Navio",
  "04-house": "Casa",
  "05-tree": "Árvore",
  "06-clouds": "Nuvens",
  "07-snake": "Cobra",
  "08-coffin": "Caixão",
  "09-bouquet": "Buquê",
  "10-scythe": "Foice",
  "11-whip": "Chicote",
  "12-birds": "Pássaros",
  "13-child": "Criança",
  "14-fox": "Raposa",
  "15-bear": "Urso",
  "16-stars": "Estrelas",
  "17-stork": "Cegonha",
  "18-dog": "Cão",
  "19-tower": "Torre",
  "20-garden": "Jardim",
  "21-mountain": "Montanha",
  "22-crossroads": "Encruzilhada",
  "23-mice": "Ratos",
  "24-heart": "Coração",
  "25-ring": "Anel",
  "26-book": "Livro",
  "27-letter": "Carta",
  "28-man": "Homem",
  "29-woman": "Mulher",
  "30-lily": "Lírios",
  "31-sun": "Sol",
  "32-moon": "Lua",
  "33-key": "Chave",
  "34-fish": "Peixes",
  "35-anchor": "Âncora",
  "36-cross": "Cruz",
};

export const classicLenormand: CardSetDefinition = {
  id: "classic-lenormand",
  kind: "lenormand",
  label: "Stralsund Lenormand",
  shortLabel: "Stralsund Lenormand",
  description:
    "A complete 36-card Stralsund deck from Spielkartenfabrik Altenburg, circa 1890.",
  displayLabels: { "pt-BR": "Lenormand de Stralsund" },
  displayShortLabels: { "pt-BR": "Lenormand de Stralsund" },
  displayDescriptions: {
    "pt-BR": "Um Lenormand completo de 36 cartas da Spielkartenfabrik Altenburg, por volta de 1890.",
  },
  sources: [
    {
      label: "Stralsund deck · Etteilla Foundation",
      displayLabels: {
        "pt-BR": "Baralho de Stralsund · Fundação Etteilla",
      },
      href: "https://etteilla.org/en/deck/7/stralsund-mlle-lenormand-oracle-deck",
    },
    {
      label: "Scan reuse terms · Etteilla Foundation",
      displayLabels: {
        "pt-BR": "Termos de reutilização · Fundação Etteilla",
      },
      href: "https://etteilla.org/en/collection-tos",
    },
  ],
  cardAspectRatio: getCroppedAspectRatio(51 / 83, lenormandArtworkCrop),
  artworkCrop: lenormandArtworkCrop,
  back: lenormandArtwork("back"),
  cards: classicLenormandCards.map(([id, name], order) => ({
    id,
    name,
    displayNames: { "pt-BR": lenormandPortugueseNames[id] },
    order,
    image: lenormandArtwork(id),
  })),
};

const fortyServantsCards = [
  ["the-adventurer", "The Adventurer", "A Aventureira"],
  ["the-balancer", "The Balancer", "A Harmonizadora"],
  ["the-carnal", "The Carnal", "A Carnal"],
  ["the-chaste", "The Chaste", "A Casta"],
  ["the-conductor", "The Conductor", "O Condutor"],
  ["the-contemplator", "The Contemplator", "O Contemplador"],
  ["the-dancer", "The Dancer", "A Dançarina"],
  ["the-dead", "The Dead", "A Morte"],
  ["the-depleted", "The Depleted", "O Esgotado"],
  ["the-desperate", "The Desperate", "O Desesperado"],
  ["the-devil", "The Devil", "O Diabo"],
  ["the-explorer", "The Explorer", "O Explorador"],
  ["the-eye", "The Eye", "O Olho"],
  ["the-father", "The Father", "O Pai"],
  ["the-fixer", "The Fixer", "O Reparador"],
  ["the-fortunate", "The Fortunate", "A Afortunada"],
  ["the-gate-keeper", "The Gate Keeper", "O Porteiro"],
  ["the-giver", "The Giver", "O Doador"],
  ["the-guru", "The Guru", "O Guru"],
  ["the-healer", "The Healer", "A Curadora"],
  ["the-idea", "The Idea", "A Ideia"],
  ["the-levitator", "The Levitator", "O Levitador"],
  ["the-librarian", "The Librarian", "A Bibliotecária"],
  ["the-lovers", "The Lovers", "Os Amantes"],
  ["the-master", "The Master", "O Mestre"],
  ["the-media", "The Media", "A Mídia"],
  ["the-messenger", "The Messenger", "O Mensageiro"],
  ["the-monk", "The Monk", "O Monge"],
  ["the-moon", "The Moon", "A Lua"],
  ["the-mother", "The Mother", "A Mãe"],
  ["the-opposer", "The Opposer", "O Opositor"],
  ["the-planet", "The Planet", "O Planeta"],
  ["the-protector", "The Protector", "O Protetor"],
  ["the-protester", "The Protester", "A Protestadora"],
  ["the-road-opener", "The Road Opener", "O Abre-Caminhos"],
  ["the-saint", "The Saint", "O Santo"],
  ["the-seer", "The Seer", "A Vidente"],
  ["the-sun", "The Sun", "O Sol"],
  ["the-thinker", "The Thinker", "O Pensador"],
  ["the-witch", "The Witch", "A Bruxa"],
] as const;

export const fortyServants: CardSetDefinition = {
  id: "forty-servants",
  kind: "oracle",
  label: "The Forty Servants · Tommie Kelly",
  shortLabel: "The Forty Servants",
  description:
    "Tommie Kelly's complete 40-card oracle and chaos magick system, using his official low-resolution artwork.",
  displayLabels: { "pt-BR": "Os Quarenta Servidores · Tommie Kelly" },
  displayShortLabels: { "pt-BR": "Os Quarenta Servidores" },
  displayDescriptions: {
    "pt-BR":
      "O sistema oracular e de magia do caos completo, com 40 cartas, criado por Tommie Kelly e apresentado com suas imagens oficiais em baixa resolução.",
  },
  sources: [
    {
      label: "Official deck and card index",
      displayLabels: { "pt-BR": "Baralho e índice oficial das cartas" },
      href: "https://www.adventuresinwoowoo.com/thefortyservants/",
    },
    {
      label: "Official free low-resolution artwork",
      displayLabels: {
        "pt-BR": "Imagens oficiais gratuitas em baixa resolução",
      },
      href: "https://www.adventuresinwoowoo.com/2017/08/fortyservantsfree/",
    },
    {
      label: "Support the creator · physical decks",
      displayLabels: { "pt-BR": "Apoie o criador · baralhos físicos" },
      href: "https://www.thegamecrafter.com/designers/tommie-kelly",
    },
  ],
  cardAspectRatio: 216 / 395,
  back: fortyServantsArtwork("back", "svg"),
  cards: fortyServantsCards.map(([id, name, portugueseName], order) => ({
    id,
    name,
    displayNames: { "pt-BR": portugueseName },
    order,
    image: fortyServantsArtwork(id),
  })),
};

/**
 * Add another Tarot, Lenormand, or oracle set here. The table session and card
 * interactions are deliberately independent of card count, art, or aspect ratio.
 */
export const cardSets: CardSetDefinition[] = [
  riderWaiteSmith,
  tarotDeMarseille,
  classicLenormand,
  fortyServants,
];

export function getCardSet(cardSetId: string): CardSetDefinition {
  const cardSet = cardSets.find((set) => set.id === cardSetId);

  if (!cardSet) {
    throw new Error(`Unknown card set: ${cardSetId}`);
  }

  return cardSet;
}

export function getCardDisplayName(
  definition: CardDefinition,
  locale: AppLocale
): string {
  return definition.displayNames?.[locale] ?? definition.name;
}

export function getCardSetDisplayLabel(
  cardSet: CardSetDefinition,
  locale: AppLocale
): string {
  return cardSet.displayLabels?.[locale] ?? cardSet.label;
}

export function getCardSetDisplayShortLabel(
  cardSet: CardSetDefinition,
  locale: AppLocale
): string {
  return cardSet.displayShortLabels?.[locale] ?? cardSet.shortLabel;
}

export function getCardSetDisplayDescription(
  cardSet: CardSetDefinition,
  locale: AppLocale
): string {
  return cardSet.displayDescriptions?.[locale] ?? cardSet.description;
}

export function getCardSetSourceLabel(
  source: CardSetSource,
  locale: AppLocale
): string {
  return source.displayLabels?.[locale] ?? source.label;
}
