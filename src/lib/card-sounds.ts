/**
 * Lightweight, asset-free sound effects for the tarot table. Create an engine
 * inside a client component and call `play` directly from user interactions so
 * the AudioContext is only allocated after a browser gesture.
 */

export const CARD_SOUND_EVENTS = [
  "pickup",
  "move",
  "drop",
  "flip",
  "rotate",
  "shuffle",
  "arrange",
  "draw",
] as const;

export type CardSoundEvent = (typeof CARD_SOUND_EVENTS)[number];

export type CardSoundEngineOptions = {
  /** Starts muted when no persisted choice exists. Defaults to false. */
  muted?: boolean;
  /** A localStorage key for the user's mute preference. */
  storageKey?: string;
  /** Overall volume multiplier, constrained to the subtle 0–1 range. */
  volume?: number;
};

export type CardSoundPlayOptions = {
  /** Scales an individual effect without allowing unexpectedly loud audio. */
  intensity?: number;
};

export type CardSoundEngine = {
  /**
   * Plays an effect. Call from a pointer, click, or keyboard event handler to
   * satisfy browser autoplay rules and lazily create the AudioContext.
   */
  play: (event: CardSoundEvent, options?: CardSoundPlayOptions) => void;
  /** Prepares audio after a user gesture without playing an effect. */
  prime: () => void;
  getMuted: () => boolean;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => boolean;
  /** Releases the AudioContext when its owning component unmounts. */
  dispose: () => void;
};

type Tone = {
  delay?: number;
  duration: number;
  endFrequency?: number;
  frequency: number;
  type: OscillatorType;
  volume: number;
};

const DEFAULT_STORAGE_KEY = "tarot.card-sounds-muted";
const DEFAULT_VOLUME = 0.42;
const THROTTLE_MS: Record<CardSoundEvent, number> = {
  pickup: 75,
  move: 70,
  drop: 45,
  flip: 100,
  rotate: 65,
  shuffle: 140,
  arrange: 160,
  draw: 110,
};

type LegacyAudioWindow = Window & {
  webkitAudioContext?: new () => AudioContext;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function readMuted(storageKey: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(storageKey);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function persistMuted(storageKey: string, muted: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, String(muted));
  } catch {
    // Storage can be unavailable in private browsing or embedded previews.
  }
}

function getTones(event: CardSoundEvent): Tone[] {
  const shimmer = 1 + (Math.random() - 0.5) * 0.06;

  switch (event) {
    case "pickup":
      return [
        { duration: 0.045, endFrequency: 530 * shimmer, frequency: 390 * shimmer, type: "sine", volume: 0.07 },
        { delay: 0.022, duration: 0.04, endFrequency: 710 * shimmer, frequency: 620 * shimmer, type: "triangle", volume: 0.035 },
      ];
    case "move":
      return [
        { duration: 0.028, endFrequency: 245 * shimmer, frequency: 210 * shimmer, type: "sine", volume: 0.025 },
      ];
    case "drop":
      return [
        { duration: 0.065, endFrequency: 132 * shimmer, frequency: 228 * shimmer, type: "sine", volume: 0.09 },
        { delay: 0.008, duration: 0.032, endFrequency: 310 * shimmer, frequency: 360 * shimmer, type: "triangle", volume: 0.026 },
      ];
    case "flip":
      return [
        { duration: 0.09, endFrequency: 660 * shimmer, frequency: 345 * shimmer, type: "triangle", volume: 0.062 },
        { delay: 0.065, duration: 0.035, endFrequency: 445 * shimmer, frequency: 495 * shimmer, type: "sine", volume: 0.026 },
      ];
    case "rotate":
      return [
        { duration: 0.05, endFrequency: 275 * shimmer, frequency: 390 * shimmer, type: "sine", volume: 0.042 },
      ];
    case "shuffle":
      return [
        { duration: 0.045, endFrequency: 240 * shimmer, frequency: 330 * shimmer, type: "triangle", volume: 0.038 },
        { delay: 0.052, duration: 0.045, endFrequency: 310 * shimmer, frequency: 220 * shimmer, type: "triangle", volume: 0.036 },
        { delay: 0.106, duration: 0.055, endFrequency: 195 * shimmer, frequency: 290 * shimmer, type: "sine", volume: 0.045 },
      ];
    case "arrange":
      return [
        { duration: 0.05, endFrequency: 285 * shimmer, frequency: 370 * shimmer, type: "sine", volume: 0.035 },
        { delay: 0.045, duration: 0.05, endFrequency: 365 * shimmer, frequency: 295 * shimmer, type: "triangle", volume: 0.038 },
      ];
    case "draw":
      return [
        { duration: 0.055, endFrequency: 515 * shimmer, frequency: 325 * shimmer, type: "sine", volume: 0.06 },
        { delay: 0.042, duration: 0.065, endFrequency: 625 * shimmer, frequency: 470 * shimmer, type: "triangle", volume: 0.046 },
      ];
  }
}

function playTone(
  context: AudioContext,
  tone: Tone,
  volume: number
) {
  const startAt = context.currentTime + (tone.delay ?? 0);
  const stopAt = startAt + tone.duration;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const peak = Math.max(0.0001, tone.volume * volume);

  oscillator.type = tone.type;
  oscillator.frequency.setValueAtTime(tone.frequency, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(1, tone.endFrequency ?? tone.frequency),
    stopAt
  );
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(startAt);
  oscillator.stop(stopAt + 0.015);
}

/**
 * Creates a browser-only sound engine without allocating audio resources until
 * `prime` or `play` is called from an interaction handler.
 */
export function createCardSoundEngine(
  options: CardSoundEngineOptions = {}
): CardSoundEngine {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const volume = clamp(options.volume ?? DEFAULT_VOLUME, 0, 1);
  let muted = readMuted(storageKey, options.muted ?? false);
  let context: AudioContext | null = null;
  let disposed = false;
  const lastPlayedAt = new Map<CardSoundEvent, number>();

  const ensureContext = () => {
    if (disposed || typeof window === "undefined") {
      return null;
    }

    if (!context) {
      const Constructor = window.AudioContext ??
        (window as LegacyAudioWindow).webkitAudioContext;

      if (!Constructor) {
        return null;
      }

      context = new Constructor();
    }

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    return context;
  };

  return {
    play(event, playOptions = {}) {
      if (muted || disposed) {
        return;
      }

      const playedAt = now();
      const previous = lastPlayedAt.get(event) ?? -Infinity;

      if (playedAt - previous < THROTTLE_MS[event]) {
        return;
      }

      const audioContext = ensureContext();

      if (!audioContext) {
        return;
      }

      lastPlayedAt.set(event, playedAt);
      const intensity = clamp(playOptions.intensity ?? 1, 0.25, 1);

      getTones(event).forEach((tone) => {
        playTone(audioContext, tone, volume * intensity);
      });
    },
    prime() {
      ensureContext();
    },
    getMuted() {
      return muted;
    },
    setMuted(nextMuted) {
      muted = nextMuted;
      persistMuted(storageKey, muted);
    },
    toggleMuted() {
      muted = !muted;
      persistMuted(storageKey, muted);
      return muted;
    },
    dispose() {
      disposed = true;
      lastPlayedAt.clear();

      if (context) {
        void context.close().catch(() => undefined);
        context = null;
      }
    },
  };
}
