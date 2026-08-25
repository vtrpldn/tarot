export const TAROT_SCENE_PALETTE = {
  cardPaper: "#eadfca",
  cardPaperShadow: "#c9b99b",
  celestialGold: "#c3a66d",
  dragBoundary: "#9d8358",
  deckMat: "#321a40",
  deckMatEdge: "#866b8d",
  table: "#24142e",
  tableEmissive: "#100918",
  keyLight: "#ffe4b8",
  fillLight: "#8f6ba3",
} as const;

export const SCENE_THEME_IDS = [
  "constellation",
  "solar-temple",
  "moonlit-grove",
] as const;

export type SceneThemeId = (typeof SCENE_THEME_IDS)[number];

export type ScenePalette = {
  [Key in keyof typeof TAROT_SCENE_PALETTE]: string;
};

export type SceneTheme = {
  id: SceneThemeId;
  palette: ScenePalette;
};

export type SceneSettings = {
  themeId: SceneThemeId;
};

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {
  themeId: "constellation",
};

export const SCENE_THEMES: Readonly<Record<SceneThemeId, SceneTheme>> = {
  constellation: {
    id: "constellation",
    palette: TAROT_SCENE_PALETTE,
  },
  "solar-temple": {
    id: "solar-temple",
    palette: {
      ...TAROT_SCENE_PALETTE,
      celestialGold: "#d59b45",
      deckMat: "#4a1f1e",
      deckMatEdge: "#b97846",
      dragBoundary: "#d2a45e",
      fillLight: "#bd6745",
      keyLight: "#ffe0a5",
      table: "#3a171b",
      tableEmissive: "#1d090b",
    },
  },
  "moonlit-grove": {
    id: "moonlit-grove",
    palette: {
      ...TAROT_SCENE_PALETTE,
      celestialGold: "#a9c9a5",
      deckMat: "#173a35",
      deckMatEdge: "#6f9d91",
      dragBoundary: "#92b8aa",
      fillLight: "#6ea69c",
      keyLight: "#d6f0d9",
      table: "#102b2b",
      tableEmissive: "#061414",
    },
  },
};

function isSceneThemeId(value: unknown): value is SceneThemeId {
  return (
    typeof value === "string" &&
    SCENE_THEME_IDS.includes(value as SceneThemeId)
  );
}

/**
 * Accepts legacy scene objects while retaining only the persisted background
 * choice that remains part of the table configuration.
 */
export function resolveSceneSettings(value: unknown): SceneSettings {
  const settings =
    value && typeof value === "object"
      ? (value as { themeId?: unknown })
      : undefined;

  return {
    themeId: isSceneThemeId(settings?.themeId)
      ? settings.themeId
      : DEFAULT_SCENE_SETTINGS.themeId,
  };
}

export function getSceneTheme(themeId: SceneThemeId): SceneTheme {
  return SCENE_THEMES[themeId];
}
