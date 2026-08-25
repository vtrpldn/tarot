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

export const MIN_SCENE_LIGHT_INTENSITY = 0.65;
export const MAX_SCENE_LIGHT_INTENSITY = 1.35;
export const MIN_SCENE_SPOTLIGHT_SIZE = 0.65;
export const MAX_SCENE_SPOTLIGHT_SIZE = 1.35;

export const SCENE_LIGHT_COUNTS = [1, 2, 3] as const;
export const SCENE_LIGHT_ARRANGEMENT_IDS = [
  "centered",
  "cross",
  "triangle",
] as const;

export type SceneLightCount = (typeof SCENE_LIGHT_COUNTS)[number];
export type SceneLightArrangement =
  (typeof SCENE_LIGHT_ARRANGEMENT_IDS)[number];

export type SceneSettings = {
  lightIntensity: number;
  lightCount: SceneLightCount;
  lightArrangement: SceneLightArrangement;
  shadowDepth: number;
  spotlightSize: number;
  themeId: SceneThemeId;
};

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {
  lightIntensity: 1,
  // The current scene uses a key light and a soft central fill. Keeping two
  // centered lights as the default makes existing saved tables look unchanged.
  lightCount: 2,
  lightArrangement: "centered",
  shadowDepth: 1,
  spotlightSize: 1,
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

function isSceneLightCount(value: unknown): value is SceneLightCount {
  return (
    typeof value === "number" &&
    SCENE_LIGHT_COUNTS.includes(value as SceneLightCount)
  );
}

function isSceneLightArrangement(
  value: unknown
): value is SceneLightArrangement {
  return (
    typeof value === "string" &&
    SCENE_LIGHT_ARRANGEMENT_IDS.includes(value as SceneLightArrangement)
  );
}

function clampLightIntensity(value: number) {
  return Math.min(
    MAX_SCENE_LIGHT_INTENSITY,
    Math.max(MIN_SCENE_LIGHT_INTENSITY, value)
  );
}

function clampSpotlightSize(value: number) {
  return Math.min(
    MAX_SCENE_SPOTLIGHT_SIZE,
    Math.max(MIN_SCENE_SPOTLIGHT_SIZE, value)
  );
}

/**
 * Coerces persisted or partial settings to safe scene values. Keeping this
 * here makes new controls additive for existing saved workspaces.
 */
export function resolveSceneSettings(value: unknown): SceneSettings {
  const settings =
    value && typeof value === "object"
      ? (value as Partial<SceneSettings>)
      : undefined;

  return {
    lightArrangement: isSceneLightArrangement(settings?.lightArrangement)
      ? settings.lightArrangement
      : DEFAULT_SCENE_SETTINGS.lightArrangement,
    lightCount: isSceneLightCount(settings?.lightCount)
      ? settings.lightCount
      : DEFAULT_SCENE_SETTINGS.lightCount,
    themeId: isSceneThemeId(settings?.themeId)
      ? settings.themeId
      : DEFAULT_SCENE_SETTINGS.themeId,
    lightIntensity:
      typeof settings?.lightIntensity === "number" &&
      Number.isFinite(settings.lightIntensity)
        ? clampLightIntensity(settings.lightIntensity)
        : DEFAULT_SCENE_SETTINGS.lightIntensity,
    shadowDepth:
      typeof settings?.shadowDepth === "number" &&
      Number.isFinite(settings.shadowDepth)
        ? clampLightIntensity(settings.shadowDepth)
        : DEFAULT_SCENE_SETTINGS.shadowDepth,
    spotlightSize:
      typeof settings?.spotlightSize === "number" &&
      Number.isFinite(settings.spotlightSize)
        ? clampSpotlightSize(settings.spotlightSize)
        : DEFAULT_SCENE_SETTINGS.spotlightSize,
  };
}

export function getSceneTheme(themeId: SceneThemeId): SceneTheme {
  return SCENE_THEMES[themeId];
}
