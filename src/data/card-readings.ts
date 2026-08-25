import type { CardDefinition, TarotSuit } from "@/types";
import type { AppLocale } from "@/i18n/locale";

export type CardReading = {
  summary: string;
  correspondences: ReadonlyArray<{
    label: string;
    value: string;
  }>;
  sources: ReadonlyArray<{
    label: string;
    href: string;
    locator?: string;
  }>;
  traditionNote?: string;
  perspective?: {
    label: string;
    text: string;
  };
};

const WAITE_SOURCE = {
  label: "A. E. Waite · The Pictorial Key to the Tarot",
  href: "https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot",
  locator: "1910 text; Parts II–III",
} as const;

const BOOK_T_SOURCE = {
  label: "Golden Dawn attributions · The Equinox",
  href: "https://www.100thmonkeypress.com/biblio/acrowley/books/equinox_1_8_1912/equinox_1_8_1912.htm",
  locator: "Vol. I, No. VIII, 1912",
} as const;

const POLLACK_SOURCE = {
  label: "Rachel Pollack · Seventy-Eight Degrees of Wisdom",
  href: "https://redwheelweiser.com/book/seventy-eight-degrees-of-wisdom-9781578636655/",
  locator: "Publisher overview; picture-led psychological tarot method",
} as const;

const DODAL_SOURCE = {
  label: "Jean Dodal Tarot · Bibliothèque nationale de France",
  href: "https://catalogue.bnf.fr/ark:/12148/cb40918567t",
  locator: "Lyon, c. 1701–1715",
} as const;

const DODAL_SCAN_SOURCE = {
  label: "Jean Dodal Tarot · Gallica scan",
  href: "https://gallica.bnf.fr/ark:/12148/btv1b10537343h",
  locator: "Complete 78-card artifact",
} as const;

const PAPUS_SOURCE = {
  label: "Papus · Le Tarot des Bohémiens",
  href: "https://books.google.com/books?id=vDTgoD9H82QC",
  locator: "Later French occult system, 1889",
} as const;

const STRALSUND_SOURCE = {
  label: "Stralsund Lenormand · Etteilla Foundation",
  href: "https://etteilla.org/en/deck/7/stralsund-mlle-lenormand-oracle-deck",
  locator: "Complete c. 1890 deck scan",
} as const;

const GAME_OF_HOPE_SOURCE = {
  label: "Das Spiel der Hoffnung · British Museum",
  href: "https://www.britishmuseum.org/collection/object/P_1896-0501-495",
  locator: "Historical 36-card precursor, c. 1800",
} as const;

type MajorReading = {
  rwsSummary: string;
  marseilleSummary: string;
  theme: string;
  goldenDawn: string;
  hebrew: string;
};

const MAJOR_READINGS = {
  fool: {
    rwsSummary:
      "A traveler steps toward an unseen edge beneath an open sky, carrying little and meeting the world with trust. The white rose and eager companion make this a symbol of beginnings, freedom, holy foolishness, and the risk that accompanies innocence.",
    marseilleSummary:
      "Le Mat walks outside the numbered sequence, carrying a bundle while an animal presses at the traveler’s legs. The image suggests motion beyond convention: freedom, exile, appetite, inspiration, and the unsettled energy before a path takes form.",
    theme: "Beginnings · freedom · the unknown",
    goldenDawn: "Air 🜁",
    hebrew: "Aleph א",
  },
  magician: {
    rwsSummary:
      "With one hand raised and one directed toward earth, the Magician joins intention to manifestation. The four suit emblems on the table frame focused will, skill, communication, and the responsibility to use available tools consciously.",
    marseilleSummary:
      "Le Bateleur stands at a worktable scattered with tools, poised between craft, performance, and sleight of hand. He corresponds to initiative, dexterity, persuasive intelligence, and the first deliberate act that turns possibility into form.",
    theme: "Will · skill · manifestation",
    goldenDawn: "Mercury ☿",
    hebrew: "Beth ב",
  },
  priestess: {
    rwsSummary:
      "Seated between dark and light pillars before a veiled garden, the High Priestess guards knowledge that is sensed before it is spoken. Lunar imagery and the partly hidden scroll correspond to intuition, receptivity, mystery, and patient inner attention.",
    marseilleSummary:
      "La Papesse sits with an open book while her layered veil and crown enclose a private realm of learning. The card evokes inward authority, gestation, memory, secrecy, and knowledge that ripens away from public view.",
    theme: "Intuition · mystery · inner knowledge",
    goldenDawn: "Moon ☾",
    hebrew: "Gimel ג",
  },
  empress: {
    rwsSummary:
      "The Empress rests among wheat, flowing water, and luxuriant growth beneath a crown of stars. Her landscape corresponds to fertility in its widest sense: embodied creativity, nurture, pleasure, abundance, and ideas becoming living things.",
    marseilleSummary:
      "L’Impératrice holds shield and sceptre with alert, youthful authority. She gathers intelligence, generative power, eloquence, and the capacity to shape relationships or projects through imaginative, embodied presence.",
    theme: "Creation · nurture · abundance",
    goldenDawn: "Venus ♀",
    hebrew: "Daleth ד",
  },
  emperor: {
    rwsSummary:
      "The Emperor’s stone throne and ram emblems place authority within a hard, enduring landscape. He symbolizes structure, boundaries, protection, worldly command, and the need to distinguish stable leadership from rigid control.",
    marseilleSummary:
      "L’Empereur sits in profile with shield and sceptre, forming a compact image of established power. The card corresponds to order, responsibility, boundaries, protection, and the material structures that let intention endure.",
    theme: "Structure · authority · boundaries",
    goldenDawn: "Aries ♈",
    hebrew: "Heh ה",
  },
  hierophant: {
    rwsSummary:
      "The Hierophant blesses two students between formal pillars, with crossed keys at his feet. He represents teaching, initiation, inherited forms, shared belief, and the tension between living wisdom and rules followed only from habit.",
    marseilleSummary:
      "Le Pape raises a hand in blessing toward two smaller figures while holding a staff of office. He corresponds to transmission, counsel, tradition, vows, and the social or spiritual institutions through which meaning is authorized.",
    theme: "Tradition · teaching · initiation",
    goldenDawn: "Taurus ♉",
    hebrew: "Vav ו",
  },
  lovers: {
    rwsSummary:
      "Two exposed figures stand beneath an angel, with desire, knowledge, and a mountain between them. The Lovers concern relationship and attraction, but also the deeper choice to align values, body, and consequence.",
    marseilleSummary:
      "L’Amoureux stands within a charged human triangle while a winged figure aims from above. The card corresponds to attraction, choice, ambivalence, alliance, and the moment when desire asks for a conscious commitment.",
    theme: "Choice · union · aligned values",
    goldenDawn: "Gemini ♊",
    hebrew: "Zayin ז",
  },
  chariot: {
    rwsSummary:
      "An armored driver holds a steady course between paired sphinxes that do not visibly pull the chariot. The image makes victory an act of integration: disciplined direction, protected momentum, and opposing drives held to one purpose.",
    marseilleSummary:
      "Le Chariot presents a crowned figure carried forward by two differently oriented horses. It corresponds to momentum, public success, mastery of competing impulses, and the confidence required to direct power without being dragged by it.",
    theme: "Direction · momentum · self-command",
    goldenDawn: "Cancer ♋",
    hebrew: "Cheth ח",
  },
  strength: {
    rwsSummary:
      "A calm figure meets the lion without force, beneath the sign of infinity. Strength is courage expressed as relationship with instinct: patience, compassion, vitality, and the quiet power to guide what cannot be conquered by violence.",
    marseilleSummary:
      "La Force opens or steadies the jaws of a lion with composed attention. The card corresponds to courage, appetite, creative life-force, and the art of directing instinct through presence instead of domination.",
    theme: "Courage · instinct · gentle mastery",
    goldenDawn: "Leo ♌",
    hebrew: "Teth ט",
  },
  hermit: {
    rwsSummary:
      "Alone on a height, the Hermit carries a staff and a lantern whose light is deliberately contained. He corresponds to retreat, discernment, mature guidance, and the inner search that clarifies what can later be shared.",
    marseilleSummary:
      "L’Ermite moves slowly beneath a cloak, raising a lantern while leaning on a staff. The image suggests time, prudence, solitude, experience, and a small but trustworthy light carried through uncertainty.",
    theme: "Solitude · discernment · guidance",
    goldenDawn: "Virgo ♍",
    hebrew: "Yod י",
  },
  wheel: {
    rwsSummary:
      "A lettered wheel turns among rising and falling creatures while winged witnesses occupy the corners. The card corresponds to cycles, reversals, chance, and the larger patterns that move events beyond personal control.",
    marseilleSummary:
      "La Roue de Fortune turns between supports as creatures rise, reign, and descend around it. It symbolizes cycles, opportunity, instability, and the changing position of every worldly condition.",
    theme: "Cycles · change · turning fortune",
    goldenDawn: "Jupiter ♃",
    hebrew: "Kaph כ",
  },
  justice: {
    rwsSummary:
      "Justice sits between pillars with an upright sword and balanced scales. The card links clear perception to consequence: truth, accountability, proportion, ethical choice, and decisions that restore or reveal balance.",
    marseilleSummary:
      "La Justice faces forward with scales and sword, joining measurement to decisive action. She corresponds to equity, law, consequence, precision, and the sober adjustment required when things have fallen out of balance.",
    theme: "Truth · balance · consequence",
    goldenDawn: "Libra ♎",
    hebrew: "Lamed ל",
  },
  hanged: {
    rwsSummary:
      "Suspended by one foot, the Hanged Man forms a deliberate inversion while a halo illuminates his stillness. He corresponds to surrender, suspension, sacrifice, and the transforming perspective found when ordinary action pauses.",
    marseilleSummary:
      "Le Pendu hangs between cut branches with his hands hidden and one leg folded. The card evokes reversal, waiting, constraint, offering, and the unfamiliar insight available when progress cannot continue in its usual direction.",
    theme: "Surrender · suspension · new perspective",
    goldenDawn: "Water 🜄",
    hebrew: "Mem מ",
  },
  death: {
    rwsSummary:
      "A skeletal rider advances beneath a black banner as figures meet an irreversible passage and light rises in the distance. Death signifies endings that alter identity, necessary release, transformation, and renewal through changed form.",
    marseilleSummary:
      "The usually unnamed Arcane XIII cuts through a dark field where severed forms return to the soil. It corresponds to radical clearing, mortality, transformation, and the fertile work of making an ending real.",
    theme: "Ending · release · transformation",
    goldenDawn: "Scorpio ♏",
    hebrew: "Nun נ",
  },
  temperance: {
    rwsSummary:
      "An angel blends water between two cups while standing with one foot on land and one in water. Temperance corresponds to proportion, healing, mediation, and the alchemical creation of a third state from apparent opposites.",
    marseilleSummary:
      "Tempérance pours between two vessels in a continuous, measured exchange. The card evokes moderation, circulation, healing, adaptation, and the patient blending that keeps a living system in balance.",
    theme: "Integration · healing · right measure",
    goldenDawn: "Sagittarius ♐",
    hebrew: "Samekh ס",
  },
  devil: {
    rwsSummary:
      "A horned figure presides over two loosely chained people who could perhaps leave. The Devil brings attachment into view: appetite, shame, material fixation, shadow, and the power recovered by recognizing one’s participation in a bond.",
    marseilleSummary:
      "Le Diable gathers hybrid bodies, torch-like energy, and bound attendants into an image of charged instinct. The card corresponds to desire, taboo, fascination, material power, and entanglements that both animate and constrain.",
    theme: "Attachment · desire · shadow",
    goldenDawn: "Capricorn ♑",
    hebrew: "Ayin ע",
  },
  tower: {
    rwsSummary:
      "Lightning strikes a crowned tower and casts its occupants into open air. The Tower symbolizes rupture, revelation, collapse of false security, and the liberating terror of a structure that can no longer contain reality.",
    marseilleSummary:
      "La Maison Dieu opens at the crown while fire or radiance descends and figures meet the ground below. The image corresponds to upheaval, release, exposure, and sudden energy breaking through an enclosed order.",
    theme: "Rupture · revelation · liberation",
    goldenDawn: "Mars ♂",
    hebrew: "Peh פ",
  },
  star: {
    rwsSummary:
      "A naked figure pours water onto land and into a pool beneath one great star and seven companions. The Star corresponds to hope, renewal, authenticity, guidance, and the quiet restoration that follows crisis.",
    marseilleSummary:
      "L’Étoile kneels beneath a field of stars, pouring from two vessels into the living landscape. She evokes guidance, generosity, naked truth, replenishment, and confidence in a larger pattern after disruption.",
    theme: "Hope · renewal · guidance",
    goldenDawn: "Aquarius ♒",
    hebrew: "Tzaddi צ",
  },
  moon: {
    rwsSummary:
      "A path runs between towers from the water’s edge, where a creature rises as dog and wolf answer the moon. The card corresponds to dreams, ambiguity, instinct, projection, and the uncertain passage through what the conscious mind cannot fully name.",
    marseilleSummary:
      "La Lune shines above two towers, two animals, and a creature emerging from water. The image evokes cycles, imagination, ancestry, uncertainty, and the deep psychic field where perception mingles with fear and desire.",
    theme: "Dreams · ambiguity · the unconscious",
    goldenDawn: "Pisces ♓",
    hebrew: "Qoph ק",
  },
  sun: {
    rwsSummary:
      "A radiant child rides beneath the Sun before a wall of sunflowers. The image corresponds to vitality, clarity, warmth, shared joy, and the freedom that comes when life can be met without disguise.",
    marseilleSummary:
      "Le Soleil illuminates two closely joined figures beneath streaming rays. The card evokes vitality, truth made visible, fraternity, success, and the warmth that lets separate lives recognize a common ground.",
    theme: "Vitality · clarity · joy",
    goldenDawn: "Sun ☉",
    hebrew: "Resh ר",
  },
  judgement: {
    rwsSummary:
      "An angel’s trumpet calls figures from open graves into a shared awakening. Judgement corresponds to reckoning, vocation, forgiveness, and the moment when a larger truth asks life to be answered differently.",
    marseilleSummary:
      "Le Jugement sounds from above as figures rise and turn toward the call. The card symbolizes awakening, announcement, renewal, ancestry, and a decisive response to what can no longer remain unheard.",
    theme: "Awakening · calling · reckoning",
    goldenDawn: "Fire 🜂",
    hebrew: "Shin ש",
  },
  world: {
    rwsSummary:
      "A dancing figure moves within a wreath while four living beings witness from the corners. The World corresponds to completion, integration, embodiment, and the spacious wholeness that closes one cycle while opening another.",
    marseilleSummary:
      "Le Monde places a central dancing figure within a wreath, accompanied by four beings at the corners. The image evokes completion, totality, right placement, and many forces gathered into a living whole.",
    theme: "Completion · integration · wholeness",
    goldenDawn: "Saturn ♄ · Earth 🜃",
    hebrew: "Tav ת",
  },
} as const satisfies Record<string, MajorReading>;

type MajorKey = keyof typeof MAJOR_READINGS;

const RWS_MAJOR_KEYS: Record<string, MajorKey> = {
  "0-the-fool": "fool",
  "1-the-magician": "magician",
  "2-the-high-priestess": "priestess",
  "3-the-empress": "empress",
  "4-the-emperor": "emperor",
  "5-the-hierophant": "hierophant",
  "6-the-lovers": "lovers",
  "7-the-chariot": "chariot",
  "8-strength": "strength",
  "9-the-hermit": "hermit",
  "10-wheel-of-fortune": "wheel",
  "11-justice": "justice",
  "12-the-hanged-man": "hanged",
  "13-death": "death",
  "14-temperance": "temperance",
  "15-the-devil": "devil",
  "16-the-tower": "tower",
  "17-the-star": "star",
  "18-the-moon": "moon",
  "19-the-sun": "sun",
  "20-judgement": "judgement",
  "21-the-world": "world",
};

const MARSEILLE_MAJOR_KEYS: Record<string, MajorKey> = {
  "00-le-mat": "fool",
  "01-le-bateleur": "magician",
  "02-la-papesse": "priestess",
  "03-l-imperatrice": "empress",
  "04-l-empereur": "emperor",
  "05-le-pape": "hierophant",
  "06-l-amoureux": "lovers",
  "07-le-chariot": "chariot",
  "08-la-justice": "justice",
  "09-l-ermite": "hermit",
  "10-la-roue-de-fortune": "wheel",
  "11-la-force": "strength",
  "12-le-pendu": "hanged",
  "13-arcane-xiii": "death",
  "14-temperance": "temperance",
  "15-le-diable": "devil",
  "16-la-maison-dieu": "tower",
  "17-l-etoile": "star",
  "18-la-lune": "moon",
  "19-le-soleil": "sun",
  "20-le-jugement": "judgement",
  "21-le-monde": "world",
};

const SUIT_READINGS: Record<
  TarotSuit,
  { label: string; french: string; element: string; domain: string }
> = {
  wands: {
    label: "Wands",
    french: "Bâtons",
    element: "Fire 🜂",
    domain: "will, enterprise, creativity, and spirit",
  },
  cups: {
    label: "Cups",
    french: "Coupes",
    element: "Water 🜄",
    domain: "feeling, relationship, imagination, and receptivity",
  },
  swords: {
    label: "Swords",
    french: "Épées",
    element: "Air 🜁",
    domain: "thought, truth, conflict, and discernment",
  },
  pentacles: {
    label: "Pentacles",
    french: "Deniers",
    element: "Earth 🜃",
    domain: "the body, resources, craft, and material life",
  },
};

const RANK_READINGS: Record<
  string,
  { label: string; french: string; correspondence: string }
> = {
  "1": {
    label: "Ace",
    french: "As",
    correspondence: "Unity · seed · undivided potential",
  },
  "2": {
    label: "Two",
    french: "Deux",
    correspondence: "Polarity · relation · choice",
  },
  "3": {
    label: "Three",
    french: "Trois",
    correspondence: "Growth · expression · first result",
  },
  "4": {
    label: "Four",
    french: "Quatre",
    correspondence: "Structure · stability · containment",
  },
  "5": {
    label: "Five",
    french: "Cinq",
    correspondence: "Disruption · tension · adaptation",
  },
  "6": {
    label: "Six",
    french: "Six",
    correspondence: "Exchange · harmony · adjustment",
  },
  "7": {
    label: "Seven",
    french: "Sept",
    correspondence: "Trial · assessment · conviction",
  },
  "8": {
    label: "Eight",
    french: "Huit",
    correspondence: "Organization · movement · power in form",
  },
  "9": {
    label: "Nine",
    french: "Neuf",
    correspondence: "Ripening · intensity · near-completion",
  },
  "10": {
    label: "Ten",
    french: "Dix",
    correspondence: "Completion · consequence · renewal of the cycle",
  },
  page: {
    label: "Page",
    french: "Valet",
    correspondence: "Messenger · student · emerging expression",
  },
  knight: {
    label: "Knight",
    french: "Cavalier",
    correspondence: "Motion · pursuit · testing power",
  },
  queen: {
    label: "Queen",
    french: "Reine",
    correspondence: "Inward mastery · embodiment · stewardship",
  },
  king: {
    label: "King",
    french: "Roi",
    correspondence: "Outward mastery · direction · responsibility",
  },
};

const MINOR_THEMES: Record<TarotSuit, Record<string, string>> = {
  wands: {
    "1": "a first creative spark and the invitation to begin",
    "2": "vision, planning, and a future not yet entered",
    "3": "foresight, expansion, and work moving beyond its origin",
    "4": "celebration, welcome, and a stable place made together",
    "5": "competition, friction, and energies learning to coordinate",
    "6": "recognition, public success, and the weight of being seen",
    "7": "courage, conviction, and the defense of a chosen position",
    "8": "swift movement, messages, and events already in flight",
    "9": "resilience, vigilance, and strength shaped by experience",
    "10": "burden, responsibility, and ambition carried past ease",
    page: "curiosity, fresh enthusiasm, and news of a new venture",
    knight: "ardent pursuit, adventure, and momentum that can outrun judgment",
    queen: "confident warmth, independence, and creativity that encourages others",
    king: "visionary leadership, enterprise, and command of sustained purpose",
  },
  cups: {
    "1": "an emotional opening, a gift of feeling, and renewed receptivity",
    "2": "mutual recognition, attraction, and a bond formed by exchange",
    "3": "friendship, shared joy, and feeling enlarged through community",
    "4": "withdrawal, reevaluation, and an offer not yet emotionally available",
    "5": "grief, disappointment, and the remaining bond hidden by loss",
    "6": "memory, innocence, and the past returning through tenderness",
    "7": "imagination, many desires, and the difficulty of choosing among images",
    "8": "leaving what no longer nourishes the heart in search of deeper meaning",
    "9": "satisfaction, pleasure, and the wish that has taken visible form",
    "10": "lasting emotional harmony, kinship, and joy held in common",
    page: "sensitivity, creative news, and a feeling asking to be received",
    knight: "romantic pursuit, invitation, and devotion carried into motion",
    queen: "intuitive empathy, emotional depth, and receptive self-possession",
    king: "emotional maturity, diplomacy, and feeling held without suppression",
  },
  swords: {
    "1": "clarity, truth, and a breakthrough that cuts through confusion",
    "2": "stalemate, guarded choice, and peace maintained by not yet deciding",
    "3": "sorrow, separation, and a painful truth made impossible to avoid",
    "4": "rest, retreat, and a mind recovering through deliberate stillness",
    "5": "conflict, hollow victory, and the cost of winning without relation",
    "6": "passage, transition, and difficulty carried toward calmer ground",
    "7": "strategy, secrecy, and intelligence operating outside direct encounter",
    "8": "restriction, anxious perception, and limits that may be partly self-held",
    "9": "anxiety, night thoughts, and suffering intensified by isolation",
    "10": "a painful ending, finality, and the first light beyond exhaustion",
    page: "vigilance, restless curiosity, and a message that demands discernment",
    knight: "decisive action, argument, and intellect moving at dangerous speed",
    queen: "discernment, independence, and truth spoken after hard experience",
    king: "reasoned authority, ethical judgment, and the disciplined use of intellect",
  },
  pentacles: {
    "1": "a tangible opportunity, useful resources, and a seed that can be cultivated",
    "2": "adaptability, competing demands, and balance maintained through motion",
    "3": "craftsmanship, collaboration, and skill recognized within a larger work",
    "4": "security, possession, and the point where protection becomes holding too tightly",
    "5": "scarcity, exclusion, and support that may be difficult to perceive or request",
    "6": "generosity, unequal exchange, and the power present in giving and receiving",
    "7": "patience, assessment, and labor measured against the harvest it may yield",
    "8": "apprenticeship, repetition, and mastery built one careful act at a time",
    "9": "self-sufficiency, cultivated pleasure, and the harvest of sustained discipline",
    "10": "legacy, continuity, and material wealth woven through family or community",
    page: "study, practical curiosity, and a material opportunity ready for attention",
    knight: "diligence, routine, and dependable progress that values completion",
    queen: "embodied care, resourcefulness, and abundance made useful and welcoming",
    king: "stewardship, material mastery, and prosperity governed with responsibility",
  },
};

const LENORMAND_READINGS: Record<
  string,
  { summary: string; playingCard: string; themes: string }
> = {
  "01-rider": {
    summary:
      "The Rider makes arrival visible: a person, message, or event is already moving toward the scene. In contemporary Lenormand practice the image is commonly associated with news, speed, approach, and an active visitor.",
    playingCard: "Nine of Hearts",
    themes: "News · arrival · movement",
  },
  "02-clover": {
    summary:
      "The small clover suggests a fortunate opening that may be easy to miss or quick to pass. It is commonly read as modest luck, relief, playfulness, and a brief chance that rewards lightness of touch.",
    playingCard: "Six of Diamonds",
    themes: "Small luck · opportunity · brevity",
  },
  "03-ship": {
    summary:
      "The Ship carries goods and people beyond the familiar shore. It is commonly associated with travel, distance, trade, longing, and the gradual movement from one condition into another.",
    playingCard: "Ten of Spades",
    themes: "Journey · distance · commerce",
  },
  "04-house": {
    summary:
      "The House encloses a stable, known place. It is commonly read through home, family, privacy, property, safety, and the boundaries that distinguish one’s own ground from the wider world.",
    playingCard: "King of Hearts",
    themes: "Home · security · boundaries",
  },
  "05-tree": {
    summary:
      "The Tree joins deep roots to slow, organic growth. It is commonly associated with health, ancestry, endurance, life systems, and developments whose meaning becomes visible over a long span of time.",
    playingCard: "Seven of Hearts",
    themes: "Health · roots · long growth",
  },
  "06-clouds": {
    summary:
      "Clouds obscure the landscape and change shape while they pass. The card is commonly read as confusion, uncertainty, mixed perception, and a temporary atmosphere in which clarity is uneven.",
    playingCard: "King of Clubs",
    themes: "Confusion · uncertainty · shifting conditions",
  },
  "07-snake": {
    summary:
      "The Snake follows a winding rather than direct path. It is commonly associated with complexity, strategy, desire, temptation, and intelligence that must navigate around an obstacle or hidden motive.",
    playingCard: "Queen of Clubs",
    themes: "Complexity · strategy · desire",
  },
  "08-coffin": {
    summary:
      "The Coffin is an enclosed place of stillness and finality. It is commonly read as closure, rest, cessation, grief, or transformation after something can no longer continue in its former state.",
    playingCard: "Nine of Diamonds",
    themes: "Closure · stillness · ending",
  },
  "09-bouquet": {
    summary:
      "The Bouquet turns cultivated beauty into an offered gift. It is commonly associated with appreciation, invitation, charm, pleasure, and a social gesture that brings delight or recognition.",
    playingCard: "Queen of Spades",
    themes: "Gift · beauty · appreciation",
  },
  "10-scythe": {
    summary:
      "The Scythe is both a harvest tool and a sharp edge capable of sudden separation. It is commonly read as a swift decision, cut, warning, or decisive moment whose effect is immediate.",
    playingCard: "Jack of Diamonds",
    themes: "Cut · decision · sudden change",
  },
  "11-whip": {
    summary:
      "The Whip repeats impact through rhythm and return. It is commonly associated with argument, pressure, rehearsal, physical intensity, and patterns that recur until their energy is consciously redirected.",
    playingCard: "Jack of Clubs",
    themes: "Repetition · conflict · intensity",
  },
  "12-birds": {
    summary:
      "The paired Birds make quick sound and restless movement. They are commonly read as conversation, nervous excitement, chatter, negotiation, and the agitation or pleasure produced by an active exchange.",
    playingCard: "Seven of Diamonds",
    themes: "Conversation · nerves · exchange",
  },
  "13-child": {
    summary:
      "The Child represents what is new, small, dependent, or still learning the world. It is commonly associated with beginnings, innocence, simplicity, curiosity, and a situation at an early stage.",
    playingCard: "Jack of Spades",
    themes: "Beginning · smallness · innocence",
  },
  "14-fox": {
    summary:
      "The Fox survives through attention, timing, and self-directed intelligence. It is commonly read as caution, work, self-interest, craftiness, and the need to inspect what appears convenient.",
    playingCard: "Nine of Clubs",
    themes: "Caution · work · self-interest",
  },
  "15-bear": {
    summary:
      "The Bear concentrates physical strength, protection, and appetite in one imposing figure. It is commonly associated with power, authority, resources, guardianship, and influence that can shelter or dominate.",
    playingCard: "Ten of Clubs",
    themes: "Power · protection · resources",
  },
  "16-stars": {
    summary:
      "The Stars offer a pattern by which direction can be found across darkness. They are commonly read as guidance, hope, clarity, inspiration, and the ability to orient a plan toward a larger design.",
    playingCard: "Six of Hearts",
    themes: "Guidance · hope · pattern",
  },
  "17-stork": {
    summary:
      "The Stork is a migratory figure whose movement changes where life is housed. It is commonly associated with transition, relocation, improvement, return, and a meaningful alteration of circumstances.",
    playingCard: "Queen of Hearts",
    themes: "Change · movement · improvement",
  },
  "18-dog": {
    summary:
      "The Dog stands close as a familiar and dependable companion. It is commonly read as loyalty, friendship, trust, help, and a person or bond whose reliability has been demonstrated over time.",
    playingCard: "Ten of Hearts",
    themes: "Loyalty · friendship · support",
  },
  "19-tower": {
    summary:
      "The Tower raises a solitary structure above its surroundings. It is commonly associated with institutions, authority, distance, boundaries, and the solitude that may feel protective or isolating.",
    playingCard: "Six of Spades",
    themes: "Institution · distance · solitude",
  },
  "20-garden": {
    summary:
      "The Garden is a cultivated public place designed for gathering and display. It is commonly read as community, audience, society, events, networks, and what becomes visible in a shared space.",
    playingCard: "Eight of Spades",
    themes: "Public life · gathering · community",
  },
  "21-mountain": {
    summary:
      "The Mountain is a large, immovable fact in the path. It is commonly associated with obstacle, delay, distance, endurance, and the need to work with a limit rather than pretend it is absent.",
    playingCard: "Eight of Clubs",
    themes: "Obstacle · delay · endurance",
  },
  "22-crossroads": {
    summary:
      "The Crossroads divides one route into several possible futures. It is commonly read as choice, alternatives, separation, freedom, and the uncertainty that accompanies a path not yet selected.",
    playingCard: "Queen of Diamonds",
    themes: "Choice · alternatives · divergence",
  },
  "23-mice": {
    summary:
      "Mice remove a little at a time, often before the loss is fully noticed. They are commonly associated with erosion, worry, theft, stress, and small persistent problems that diminish energy or resources.",
    playingCard: "Seven of Clubs",
    themes: "Erosion · worry · gradual loss",
  },
  "24-heart": {
    summary:
      "The Heart presents feeling as the central and unmistakable subject. It is commonly read as love, affection, desire, sincerity, pleasure, and what a person values with emotional immediacy.",
    playingCard: "Jack of Hearts",
    themes: "Love · desire · sincerity",
  },
  "25-ring": {
    summary:
      "The Ring closes into a continuous form and is worn as a sign of agreement. It is commonly associated with commitment, contract, partnership, promise, and cycles that bind people or events together.",
    playingCard: "Ace of Clubs",
    themes: "Commitment · contract · cycle",
  },
  "26-book": {
    summary:
      "The closed Book holds knowledge that has not yet been opened or disclosed. It is commonly read as study, secrets, research, education, and information whose contents remain protected.",
    playingCard: "Ten of Diamonds",
    themes: "Knowledge · study · secret",
  },
  "27-letter": {
    summary:
      "The Letter gives a message durable form through writing. It is commonly associated with documents, correspondence, notices, records, and the exact details carried by a text or contract.",
    playingCard: "Seven of Spades",
    themes: "Message · document · detail",
  },
  "28-man": {
    summary:
      "The Man is one of the deck’s two traditional person cards and historically served as a significator chosen for the subject of a reading. In an open contemporary reading it can simply mark a person, role, identity, or point of view.",
    playingCard: "Ace of Hearts",
    themes: "Person · identity · point of view",
  },
  "29-woman": {
    summary:
      "The Woman is one of the deck’s two traditional person cards and historically served as a significator chosen for the subject of a reading. In an open contemporary reading it can simply mark a person, role, identity, or point of view.",
    playingCard: "Ace of Spades",
    themes: "Person · identity · point of view",
  },
  "30-lily": {
    summary:
      "The Lilies join cultivated beauty with age, scent, and calm order. They are commonly associated with maturity, peace, sensuality, ethics, family elders, and experience brought to a settled state.",
    playingCard: "King of Spades",
    themes: "Maturity · peace · sensuality",
  },
  "31-sun": {
    summary:
      "The Sun makes the whole field visible and fills it with heat. It is commonly read as success, vitality, confidence, clarity, and the strong affirmative energy that allows other matters to flourish.",
    playingCard: "Ace of Diamonds",
    themes: "Success · vitality · visibility",
  },
  "32-moon": {
    summary:
      "The Moon governs reflected light, changing phases, and nocturnal imagination. It is commonly associated with emotion, recognition, reputation, dreams, creativity, and cycles of response.",
    playingCard: "Eight of Hearts",
    themes: "Emotion · recognition · cycles",
  },
  "33-key": {
    summary:
      "The Key both opens access and confirms that something can be secured. It is commonly read as solution, certainty, discovery, significance, and the decisive piece that makes a problem intelligible.",
    playingCard: "Eight of Diamonds",
    themes: "Solution · certainty · access",
  },
  "34-fish": {
    summary:
      "Fish move through a medium of continuous flow and traditionally connect to trade and plenty. They are commonly associated with money, resources, commerce, independence, and abundance in circulation.",
    playingCard: "King of Diamonds",
    themes: "Resources · flow · commerce",
  },
  "35-anchor": {
    summary:
      "The Anchor holds a vessel in place against movement in the surrounding water. It is commonly read as stability, work, persistence, security, and an attachment that may ground or prevent departure.",
    playingCard: "Nine of Spades",
    themes: "Stability · work · persistence",
  },
  "36-cross": {
    summary:
      "The Cross bears the weight of ordeal, faith, and unavoidable significance. It is commonly associated with burden, duty, suffering, devotion, and a difficult matter that asks to be carried consciously.",
    playingCard: "Six of Clubs",
    themes: "Burden · faith · necessity",
  },
};

function getMajorReading(
  cardSetId: "rider-waite-smith" | "tarot-de-marseille",
  definition: CardDefinition
): CardReading | undefined {
  const majorKey =
    cardSetId === "rider-waite-smith"
      ? RWS_MAJOR_KEYS[definition.id]
      : MARSEILLE_MAJOR_KEYS[definition.id];

  if (!majorKey) {
    return undefined;
  }

  const reading = MAJOR_READINGS[majorKey];

  if (cardSetId === "rider-waite-smith") {
    return {
      summary: reading.rwsSummary,
      correspondences: [
        { label: "Archetype", value: reading.theme },
        { label: "Astrology", value: reading.goldenDawn },
        { label: "Hebrew path", value: reading.hebrew },
      ],
      sources: [WAITE_SOURCE, BOOK_T_SOURCE, POLLACK_SOURCE],
      traditionNote:
        "The image note follows Waite’s companion text; astrology and Hebrew letters are labeled Golden Dawn correspondences.",
      perspective:
        majorKey === "fool"
          ? {
              label: "Rachel Pollack lens",
              text: "A picture-led psychological reading can meet the Fool as the self at the threshold: open to experience, not yet fixed, and invited to discover itself through the journey. This is an original synopsis, not a quotation.",
            }
          : {
              label: "Rachel Pollack lens",
              text: "A picture-led psychological reading asks what in this scene is becoming conscious. Use the card as a prompt for self-discovery rather than a fixed prediction; this is a general methodology note, not a card-by-card paraphrase.",
            },
    };
  }

  return {
    summary: reading.marseilleSummary,
    correspondences: [
      { label: "Archetype", value: reading.theme },
      { label: "Sequence", value: definition.name },
      { label: "Occult lens", value: "Later French tarot · 1889" },
    ],
    sources: [DODAL_SOURCE, PAPUS_SOURCE],
    traditionNote:
      "Dodal left no per-card esoteric guide. The object record grounds the image; Papus is a clearly later French occult lens.",
  };
}

function getMinorReading(
  cardSetId: "rider-waite-smith" | "tarot-de-marseille",
  definition: CardDefinition
): CardReading | undefined {
  const suit = definition.suit;
  const rank = definition.rank;

  if (!suit || !rank) {
    return undefined;
  }

  const suitReading = SUIT_READINGS[suit];
  const rankReading = RANK_READINGS[rank];
  const theme = MINOR_THEMES[suit][rank];

  if (!rankReading || !theme) {
    return undefined;
  }

  if (cardSetId === "rider-waite-smith") {
    return {
      summary: `This editorial reading places ${theme} within the Rider–Waite–Smith suit of ${suitReading.label}. Symbolically, the card joins ${suitReading.domain} to the ${rankReading.correspondence.toLowerCase()} expressed by the ${rankReading.label}.`,
      correspondences: [
        { label: "Element", value: suitReading.element },
        { label: "Number or role", value: rankReading.correspondence },
        { label: "Esoteric theme", value: theme },
      ],
      sources: [WAITE_SOURCE, BOOK_T_SOURCE, POLLACK_SOURCE],
      traditionNote:
        "Smith’s image and Waite’s companion text ground the card; the elemental and number synthesis is presented as an editorial esoteric reading framework.",
      perspective: {
        label: "Rachel Pollack lens",
        text: "A picture-led psychological reading asks what in this scene is becoming conscious. Use the card as a prompt for self-discovery rather than a fixed prediction; this is a general methodology note, not a card-by-card paraphrase.",
      },
    };
  }

  return {
    summary: `In Dodal’s ${rankReading.french} de ${suitReading.french}, number or court role organizes the suit rather than a fully illustrated scene. As a later comparative lens, the card joins ${suitReading.domain} to ${rankReading.correspondence.toLowerCase()}.`,
    correspondences: [
      { label: "Element", value: suitReading.element },
      { label: "Number or role", value: rankReading.correspondence },
      { label: "Suit domain", value: suitReading.domain },
    ],
    sources: [DODAL_SCAN_SOURCE, PAPUS_SOURCE],
    traditionNote:
      "The BnF scan grounds Dodal’s pip or court image; the interpretive layer is later and is not presented as original to the c. 1701–1715 deck.",
  };
}

function getLenormandReading(definition: CardDefinition): CardReading | undefined {
  const reading = LENORMAND_READINGS[definition.id];

  if (!reading) {
    return undefined;
  }

  return {
    summary: reading.summary,
    correspondences: [
      { label: "Playing-card inset", value: reading.playingCard },
      { label: "Editorial themes", value: reading.themes },
      { label: "System", value: `Petit Lenormand · Card ${definition.order + 1}` },
    ],
    sources: [STRALSUND_SOURCE, GAME_OF_HOPE_SOURCE],
    traditionNote:
      "The linked deck and museum sources establish the image, number, inset, and history. Per-card themes are a concise editorial reading, not a canonical text from the 1890 deck.",
  };
}

const PORTUGUESE_MAJOR_THEMES: Record<MajorKey, string> = {
  fool: "Começos · liberdade · o desconhecido",
  magician: "Vontade · habilidade · manifestação",
  priestess: "Intuição · mistério · saber interior",
  empress: "Criação · nutrição · abundância",
  emperor: "Estrutura · autoridade · limites",
  hierophant: "Tradição · ensino · iniciação",
  lovers: "Escolha · união · valores alinhados",
  chariot: "Direção · impulso · autodomínio",
  strength: "Coragem · instinto · domínio gentil",
  hermit: "Solidão · discernimento · orientação",
  wheel: "Ciclos · mudança · fortuna em movimento",
  justice: "Verdade · equilíbrio · consequência",
  hanged: "Entrega · suspensão · nova perspectiva",
  death: "Encerramento · liberação · transformação",
  temperance: "Integração · cura · medida justa",
  devil: "Apego · desejo · sombra",
  tower: "Ruptura · revelação · libertação",
  star: "Esperança · reparação · renovação",
  moon: "Imaginação · incerteza · inconsciente",
  sun: "Vitalidade · clareza · alegria",
  judgement: "Despertar · chamado · acerto de contas",
  world: "Conclusão · integração · totalidade",
};

const PORTUGUESE_SUIT_READINGS: Record<
  TarotSuit,
  { label: string; element: string; domain: string }
> = {
  wands: {
    label: "Paus",
    element: "Fogo 🜂",
    domain: "vontade, iniciativa, criatividade e espírito",
  },
  cups: {
    label: "Copas",
    element: "Água 🜄",
    domain: "afeto, relação, imaginação e receptividade",
  },
  swords: {
    label: "Espadas",
    element: "Ar 🜁",
    domain: "pensamento, verdade, conflito e discernimento",
  },
  pentacles: {
    label: "Ouros",
    element: "Terra 🜃",
    domain: "corpo, recursos, ofício e vida material",
  },
};

const PORTUGUESE_RANKS: Record<
  string,
  { label: string; marseilleLabel: string; correspondence: string }
> = {
  "1": { label: "Ás", marseilleLabel: "Ás", correspondence: "Unidade · semente · potencial indiviso" },
  "2": { label: "Dois", marseilleLabel: "Dois", correspondence: "Polaridade · relação · escolha" },
  "3": { label: "Três", marseilleLabel: "Três", correspondence: "Crescimento · expressão · primeiro resultado" },
  "4": { label: "Quatro", marseilleLabel: "Quatro", correspondence: "Estrutura · estabilidade · contenção" },
  "5": { label: "Cinco", marseilleLabel: "Cinco", correspondence: "Ruptura · tensão · adaptação" },
  "6": { label: "Seis", marseilleLabel: "Seis", correspondence: "Troca · harmonia · ajuste" },
  "7": { label: "Sete", marseilleLabel: "Sete", correspondence: "Prova · avaliação · convicção" },
  "8": { label: "Oito", marseilleLabel: "Oito", correspondence: "Organização · movimento · poder em forma" },
  "9": { label: "Nove", marseilleLabel: "Nove", correspondence: "Amadurecimento · intensidade · quase conclusão" },
  "10": { label: "Dez", marseilleLabel: "Dez", correspondence: "Conclusão · consequência · renovação do ciclo" },
  page: { label: "Pajem", marseilleLabel: "Valete", correspondence: "Mensageiro · estudante · expressão emergente" },
  knight: { label: "Cavaleiro", marseilleLabel: "Cavaleiro", correspondence: "Movimento · busca · força em prova" },
  queen: { label: "Rainha", marseilleLabel: "Rainha", correspondence: "Domínio interno · corporificação · cuidado" },
  king: { label: "Rei", marseilleLabel: "Rei", correspondence: "Domínio externo · direção · responsabilidade" },
};

const PORTUGUESE_LENORMAND_THEMES: Record<string, string> = {
  "01-rider": "Notícias · chegada · movimento",
  "02-clover": "Pequena sorte · oportunidade · brevidade",
  "03-ship": "Jornada · distância · comércio",
  "04-house": "Lar · segurança · limites",
  "05-tree": "Saúde · raízes · crescimento lento",
  "06-clouds": "Confusão · incerteza · condições mutáveis",
  "07-snake": "Complexidade · estratégia · desejo",
  "08-coffin": "Fechamento · quietude · fim",
  "09-bouquet": "Presente · beleza · apreciação",
  "10-scythe": "Corte · decisão · mudança súbita",
  "11-whip": "Repetição · conflito · intensidade",
  "12-birds": "Conversa · nervosismo · troca",
  "13-child": "Começo · pequenez · inocência",
  "14-fox": "Cautela · trabalho · interesse próprio",
  "15-bear": "Poder · proteção · recursos",
  "16-stars": "Orientação · esperança · padrão",
  "17-stork": "Mudança · movimento · melhora",
  "18-dog": "Lealdade · amizade · apoio",
  "19-tower": "Instituição · distância · solidão",
  "20-garden": "Vida pública · encontro · comunidade",
  "21-mountain": "Obstáculo · atraso · resistência",
  "22-crossroads": "Escolha · alternativas · divergência",
  "23-mice": "Erosão · preocupação · perda gradual",
  "24-heart": "Amor · desejo · sinceridade",
  "25-ring": "Compromisso · contrato · ciclo",
  "26-book": "Conhecimento · estudo · segredo",
  "27-letter": "Mensagem · documento · detalhe",
  "28-man": "Pessoa · identidade · ponto de vista",
  "29-woman": "Pessoa · identidade · ponto de vista",
  "30-lily": "Maturidade · paz · sensualidade",
  "31-sun": "Sucesso · vitalidade · visibilidade",
  "32-moon": "Emoção · reconhecimento · ciclos",
  "33-key": "Solução · certeza · acesso",
  "34-fish": "Recursos · fluxo · comércio",
  "35-anchor": "Estabilidade · trabalho · persistência",
  "36-cross": "Fardo · fé · necessidade",
};

const PORTUGUESE_SOURCE_METADATA: Record<
  string,
  { label: string; locator?: string }
> = {
  [WAITE_SOURCE.href]: {
    label: "A. E. Waite · The Pictorial Key to the Tarot",
    locator: "Texto de 1910; Partes II–III",
  },
  [BOOK_T_SOURCE.href]: {
    label: "Atribuições da Golden Dawn · The Equinox",
    locator: "Vol. I, n.º VIII, 1912",
  },
  [POLLACK_SOURCE.href]: {
    label: "Rachel Pollack · Seventy-Eight Degrees of Wisdom",
    locator: "Página da editora; método pictórico e psicológico",
  },
  [DODAL_SOURCE.href]: {
    label: "Tarô de Jean Dodal · Biblioteca Nacional da França",
    locator: "Lyon, c. 1701–1715",
  },
  [DODAL_SCAN_SOURCE.href]: {
    label: "Tarô de Jean Dodal · reprodução Gallica",
    locator: "Artefato completo de 78 cartas",
  },
  [PAPUS_SOURCE.href]: {
    label: "Papus · Le Tarot des Bohémiens",
    locator: "Sistema ocultista francês posterior, 1889",
  },
  [STRALSUND_SOURCE.href]: {
    label: "Lenormand de Stralsund · Fundação Etteilla",
    locator: "Reprodução do baralho completo, c. 1890",
  },
  [GAME_OF_HOPE_SOURCE.href]: {
    label: "Das Spiel der Hoffnung · Museu Britânico",
    locator: "Precursor histórico de 36 cartas, c. 1800",
  },
};

function getPortugueseName(definition: CardDefinition): string {
  return definition.displayNames?.["pt-BR"] ?? definition.name;
}

function localizeSources(
  sources: CardReading["sources"]
): CardReading["sources"] {
  return sources.map((source) => {
    const translation = PORTUGUESE_SOURCE_METADATA[source.href];

    return translation
      ? { ...source, ...translation }
      : source;
  });
}

function localizeAstrology(value: string): string {
  const [name, ...symbol] = value.split(" ");
  const names: Record<string, string> = {
    Air: "Ar",
    Aquarius: "Aquário",
    Aries: "Áries",
    Cancer: "Câncer",
    Capricorn: "Capricórnio",
    Earth: "Terra",
    Fire: "Fogo",
    Gemini: "Gêmeos",
    Jupiter: "Júpiter",
    Leo: "Leão",
    Libra: "Libra",
    Mars: "Marte",
    Mercury: "Mercúrio",
    Moon: "Lua",
    Pisces: "Peixes",
    Sagittarius: "Sagitário",
    Saturn: "Saturno",
    Scorpio: "Escorpião",
    Sun: "Sol",
    Taurus: "Touro",
    Venus: "Vênus",
    Virgo: "Virgem",
    Water: "Água",
  };

  return [names[name] ?? name, ...symbol].join(" ");
}

function getPortuguesePollackPerspective(majorKey?: MajorKey): NonNullable<CardReading["perspective"]> {
  if (majorKey === "fool") {
    return {
      label: "Perspectiva de Rachel Pollack",
      text: "Uma leitura psicológica orientada pela imagem pode encontrar o Louco como o eu no limiar: aberto à experiência, ainda não fixado e convidado a se descobrir pela jornada. Esta é uma síntese original, não uma citação.",
    };
  }

  return {
    label: "Perspectiva de Rachel Pollack",
    text: "Uma leitura psicológica orientada pela imagem pergunta o que está se tornando consciente na cena. Use a carta como convite à autodescoberta, não como previsão fixa; esta é uma nota metodológica geral, não uma paráfrase carta a carta.",
  };
}

function getPortugueseMajorReading(
  cardSetId: "rider-waite-smith" | "tarot-de-marseille",
  definition: CardDefinition
): CardReading | undefined {
  const majorKey =
    cardSetId === "rider-waite-smith"
      ? RWS_MAJOR_KEYS[definition.id]
      : MARSEILLE_MAJOR_KEYS[definition.id];

  if (!majorKey) {
    return undefined;
  }

  const reading = MAJOR_READINGS[majorKey];
  const name = getPortugueseName(definition);

  if (cardSetId === "rider-waite-smith") {
    return {
      summary: `Nesta imagem da Rider–Waite–Smith, ${name} concentra ${PORTUGUESE_MAJOR_THEMES[majorKey].toLocaleLowerCase("pt-BR")}. A cena oferece uma pergunta aberta sobre como essas forças se movem na situação presente.`,
      correspondences: [
        { label: "Arquétipo", value: PORTUGUESE_MAJOR_THEMES[majorKey] },
        { label: "Astrologia", value: localizeAstrology(reading.goldenDawn) },
        { label: "Caminho hebraico", value: reading.hebrew },
      ],
      sources: localizeSources([WAITE_SOURCE, BOOK_T_SOURCE, POLLACK_SOURCE]),
      traditionNote:
        "A imagem é contextualizada pelo texto de Waite; astrologia e letras hebraicas são correspondências identificadas como Golden Dawn.",
      perspective: getPortuguesePollackPerspective(majorKey),
    };
  }

  return {
    summary: `Nesta lâmina de Jean Dodal, ${name} põe em primeiro plano ${PORTUGUESE_MAJOR_THEMES[majorKey].toLocaleLowerCase("pt-BR")}. A composição histórica permite observar como o símbolo organiza a pergunta antes de acrescentar qualquer sistema posterior.`,
    correspondences: [
      { label: "Arquétipo", value: PORTUGUESE_MAJOR_THEMES[majorKey] },
      { label: "Sequência", value: name },
      { label: "Lente ocultista", value: "Tarô francês posterior · 1889" },
    ],
    sources: localizeSources([DODAL_SOURCE, PAPUS_SOURCE]),
    traditionNote:
      "Dodal não deixou um guia esotérico carta a carta. O registro do objeto fundamenta a imagem; Papus é uma lente ocultista francesa claramente posterior.",
  };
}

function getPortugueseMinorReading(
  cardSetId: "rider-waite-smith" | "tarot-de-marseille",
  definition: CardDefinition
): CardReading | undefined {
  const suit = definition.suit;
  const rank = definition.rank;

  if (!suit || !rank) {
    return undefined;
  }

  const suitReading = PORTUGUESE_SUIT_READINGS[suit];
  const rankReading = PORTUGUESE_RANKS[rank];

  if (!rankReading) {
    return undefined;
  }

  const name = getPortugueseName(definition);
  const rankLabel =
    cardSetId === "tarot-de-marseille"
      ? rankReading.marseilleLabel
      : rankReading.label;

  if (cardSetId === "rider-waite-smith") {
    return {
      summary: `Na Rider–Waite–Smith, ${name} une ${suitReading.domain} a ${rankReading.correspondence.toLocaleLowerCase("pt-BR")}. A cena pode ser usada como uma pergunta sobre onde essa dinâmica já está visível na vida cotidiana.`,
      correspondences: [
        { label: "Elemento", value: suitReading.element },
        { label: "Número ou figura", value: rankReading.correspondence },
        { label: "Domínio do naipe", value: suitReading.domain },
      ],
      sources: localizeSources([WAITE_SOURCE, BOOK_T_SOURCE, POLLACK_SOURCE]),
      traditionNote:
        "A imagem de Smith e o texto de Waite fundamentam a carta; a síntese elemental e numérica é apresentada como uma estrutura editorial de leitura esotérica.",
      perspective: getPortuguesePollackPerspective(),
    };
  }

  return {
    summary: `No ${rankLabel} de ${suitReading.label} de Dodal, o número ou a figura da corte organiza o naipe sem uma cena totalmente ilustrada. Como lente comparativa posterior, a carta une ${suitReading.domain} a ${rankReading.correspondence.toLocaleLowerCase("pt-BR")}.`,
    correspondences: [
      { label: "Elemento", value: suitReading.element },
      { label: "Número ou figura", value: rankReading.correspondence },
      { label: "Domínio do naipe", value: suitReading.domain },
    ],
    sources: localizeSources([DODAL_SCAN_SOURCE, PAPUS_SOURCE]),
    traditionNote:
      "A reprodução da BnF fundamenta a imagem do ás, número ou corte de Dodal; a camada interpretativa é posterior e não é apresentada como original ao baralho de c. 1701–1715.",
  };
}

const PORTUGUESE_PLAYING_CARD_RANKS: Record<string, string> = {
  Ace: "Ás",
  King: "Rei",
  Queen: "Rainha",
  Jack: "Valete",
  Ten: "Dez",
  Nine: "Nove",
  Eight: "Oito",
  Seven: "Sete",
  Six: "Seis",
};

const PORTUGUESE_PLAYING_CARD_SUITS: Record<string, string> = {
  Diamonds: "Ouros",
  Hearts: "Copas",
  Clubs: "Paus",
  Spades: "Espadas",
};

function localizePlayingCard(value: string): string {
  const [rank, suit] = value.split(" of ");

  return `${PORTUGUESE_PLAYING_CARD_RANKS[rank] ?? rank} de ${PORTUGUESE_PLAYING_CARD_SUITS[suit] ?? suit}`;
}

function getPortugueseLenormandReading(
  definition: CardDefinition
): CardReading | undefined {
  const reading = LENORMAND_READINGS[definition.id];
  const themes = PORTUGUESE_LENORMAND_THEMES[definition.id];

  if (!reading || !themes) {
    return undefined;
  }

  const name = getPortugueseName(definition);

  return {
    summary: `No Petit Lenormand, ${name} orienta a leitura por ${themes.toLocaleLowerCase("pt-BR")}. A imagem ganha precisão no contexto, especialmente em combinação com as cartas vizinhas e a pergunta formulada.`,
    correspondences: [
      { label: "Carta do baralho comum", value: localizePlayingCard(reading.playingCard) },
      { label: "Temas editoriais", value: themes },
      { label: "Sistema", value: `Petit Lenormand · Carta ${definition.order + 1}` },
    ],
    sources: localizeSources([STRALSUND_SOURCE, GAME_OF_HOPE_SOURCE]),
    traditionNote:
      "As fontes do baralho e do museu estabelecem imagem, número, inserto e história. Os temas carta a carta são uma leitura editorial concisa, não um texto canônico do baralho de 1890.",
  };
}

export function getCardReading(
  cardSetId: string,
  definition: CardDefinition,
  locale: AppLocale = "en"
): CardReading | undefined {
  if (locale === "pt-BR") {
    if (cardSetId === "classic-lenormand") {
      return getPortugueseLenormandReading(definition);
    }

    if (cardSetId === "rider-waite-smith" || cardSetId === "tarot-de-marseille") {
      return definition.arcana === "major"
        ? getPortugueseMajorReading(cardSetId, definition)
        : getPortugueseMinorReading(cardSetId, definition);
    }

    return undefined;
  }

  if (cardSetId === "classic-lenormand") {
    return getLenormandReading(definition);
  }

  if (
    cardSetId !== "rider-waite-smith" &&
    cardSetId !== "tarot-de-marseille"
  ) {
    return undefined;
  }

  return definition.arcana === "major"
    ? getMajorReading(cardSetId, definition)
    : getMinorReading(cardSetId, definition);
}
