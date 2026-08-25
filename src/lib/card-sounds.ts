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

export type CardSoundPlayer = (
  event: CardSoundEvent,
  options?: CardSoundPlayOptions
) => void;

export type CardSoundEngine = {
  /**
   * Plays an effect. Call from a pointer, click, or keyboard event handler to
   * satisfy browser autoplay rules and lazily create the AudioContext.
   */
  play: CardSoundPlayer;
  /** Prepares audio after a user gesture without playing an effect. */
  prime: () => void;
  getMuted: () => boolean;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => boolean;
  /** Releases the AudioContext when its owning component unmounts. */
  dispose: () => void;
};

type PaperStroke = {
  attack?: number;
  delay?: number;
  duration: number;
  endHighpass?: number;
  endLowpass?: number;
  grainPulse?: boolean;
  highpass: number;
  lowpass: number;
  volume: number;
};

type ActivePaperStroke = {
  cleanup: () => void;
  source: AudioBufferSourceNode;
};

const DEFAULT_STORAGE_KEY = "tarot.card-sounds-muted";
const DEFAULT_VOLUME = 0.32;
const PAPER_NOISE_SECONDS = 0.72;
const MAX_ACTIVE_MOVE_STROKES = 8;
const THROTTLE_MS: Record<CardSoundEvent, number> = {
  pickup: 75,
  move: 120,
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

const PAPER_STROKES: Record<CardSoundEvent, readonly PaperStroke[]> = {
  pickup: [
    {
      duration: 0.052,
      endHighpass: 1_500,
      endLowpass: 6_500,
      highpass: 1_050,
      lowpass: 5_400,
      volume: 0.055,
    },
    {
      delay: 0.026,
      duration: 0.018,
      endHighpass: 1_700,
      endLowpass: 5_600,
      highpass: 2_200,
      lowpass: 7_200,
      volume: 0.025,
    },
  ],
  move: [
    {
      attack: 0.018,
      duration: 0.16,
      endHighpass: 320,
      endLowpass: 2_200,
      grainPulse: false,
      highpass: 240,
      lowpass: 2_600,
      volume: 0.022,
    },
  ],
  drop: [
    {
      attack: 0.002,
      duration: 0.028,
      endHighpass: 350,
      endLowpass: 1_800,
      highpass: 550,
      lowpass: 2_600,
      volume: 0.05,
    },
    {
      attack: 0.002,
      delay: 0.018,
      duration: 0.06,
      endHighpass: 45,
      endLowpass: 700,
      highpass: 80,
      lowpass: 1_200,
      volume: 0.075,
    },
    {
      delay: 0.034,
      duration: 0.045,
      endHighpass: 600,
      endLowpass: 2_400,
      highpass: 900,
      lowpass: 3_500,
      volume: 0.035,
    },
  ],
  flip: [
    {
      duration: 0.105,
      endHighpass: 1_650,
      endLowpass: 3_600,
      highpass: 800,
      lowpass: 6_500,
      volume: 0.055,
    },
    {
      delay: 0.058,
      duration: 0.055,
      endHighpass: 850,
      endLowpass: 4_200,
      highpass: 1_800,
      lowpass: 7_000,
      volume: 0.035,
    },
  ],
  rotate: [
    {
      duration: 0.06,
      endHighpass: 900,
      endLowpass: 4_200,
      highpass: 1_400,
      lowpass: 5_900,
      volume: 0.034,
    },
  ],
  shuffle: [
    {
      duration: 0.048,
      endHighpass: 1_300,
      endLowpass: 4_000,
      highpass: 650,
      lowpass: 6_200,
      volume: 0.038,
    },
    {
      delay: 0.04,
      duration: 0.05,
      endHighpass: 700,
      endLowpass: 5_800,
      highpass: 1_350,
      lowpass: 4_100,
      volume: 0.036,
    },
    {
      delay: 0.082,
      duration: 0.052,
      endHighpass: 1_450,
      endLowpass: 3_900,
      highpass: 720,
      lowpass: 6_400,
      volume: 0.04,
    },
    {
      delay: 0.126,
      duration: 0.045,
      endHighpass: 680,
      endLowpass: 4_800,
      highpass: 1_250,
      lowpass: 3_700,
      volume: 0.034,
    },
  ],
  arrange: [
    {
      duration: 0.068,
      endHighpass: 950,
      endLowpass: 5_600,
      highpass: 620,
      lowpass: 4_300,
      volume: 0.038,
    },
    {
      delay: 0.055,
      duration: 0.072,
      endHighpass: 650,
      endLowpass: 4_100,
      highpass: 1_000,
      lowpass: 5_700,
      volume: 0.036,
    },
  ],
  draw: [
    {
      duration: 0.135,
      endHighpass: 1_450,
      endLowpass: 6_500,
      highpass: 650,
      lowpass: 4_200,
      volume: 0.06,
    },
    {
      delay: 0.006,
      duration: 0.022,
      endHighpass: 1_500,
      endLowpass: 5_700,
      highpass: 2_000,
      lowpass: 7_200,
      volume: 0.03,
    },
    {
      delay: 0.102,
      duration: 0.04,
      endHighpass: 950,
      endLowpass: 4_200,
      highpass: 1_600,
      lowpass: 6_000,
      volume: 0.025,
    },
  ],
};

function jitter(value: number, amount = 0.12) {
  return value * (1 + (Math.random() * 2 - 1) * amount);
}

function createPaperNoise(context: AudioContext) {
  const length = Math.ceil(context.sampleRate * PAPER_NOISE_SECONDS);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let smoothedNoise = 0;
  let clusterSamples = 0;
  let clusterLevel = 1;

  for (let index = 0; index < length; index += 1) {
    if (clusterSamples <= 0) {
      clusterSamples = Math.round(
        context.sampleRate * (0.001 + Math.random() * 0.007)
      );
      clusterLevel = 0.42 + Math.random() * 0.58;
    }

    const whiteNoise = Math.random() * 2 - 1;
    smoothedNoise = smoothedNoise * 0.82 + whiteNoise * 0.18;
    const fiberClick = Math.random() < 0.0025 ? whiteNoise * 0.75 : 0;
    channel[index] = clamp(
      (whiteNoise * 0.58 + smoothedNoise * 0.42) * clusterLevel + fiberClick,
      -1,
      1
    );
    clusterSamples -= 1;
  }

  return buffer;
}

function playPaperStroke({
  activeStrokes,
  context,
  noise,
  output,
  stroke,
  intensity,
}: {
  activeStrokes: Set<ActivePaperStroke>;
  context: AudioContext;
  noise: AudioBuffer;
  output: AudioNode;
  stroke: PaperStroke;
  intensity: number;
}) {
  const delay = Math.max(0, jitter(stroke.delay ?? 0, 0.08));
  const duration = Math.max(0.012, jitter(stroke.duration));
  const startAt = context.currentTime + delay;
  const stopAt = startAt + duration;
  const attackAt = Math.min(
    stopAt - 0.004,
    startAt + Math.max(0.001, stroke.attack ?? duration * 0.08)
  );
  const source = context.createBufferSource();
  const highpass = context.createBiquadFilter();
  const lowpass = context.createBiquadFilter();
  const gain = context.createGain();
  const peak = Math.max(0.0001, jitter(stroke.volume) * intensity);
  let cleanedUp = false;

  source.buffer = noise;
  source.loop = true;
  source.playbackRate.value = jitter(1, 0.14);
  highpass.type = "highpass";
  highpass.Q.value = 0.55;
  highpass.frequency.setValueAtTime(jitter(stroke.highpass), startAt);
  highpass.frequency.exponentialRampToValueAtTime(
    Math.max(20, jitter(stroke.endHighpass ?? stroke.highpass)),
    stopAt
  );
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.7;
  lowpass.frequency.setValueAtTime(jitter(stroke.lowpass), startAt);
  lowpass.frequency.exponentialRampToValueAtTime(
    Math.max(40, jitter(stroke.endLowpass ?? stroke.lowpass)),
    stopAt
  );
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peak, attackAt);

  if (stroke.grainPulse !== false && duration >= 0.055) {
    const notchAt = startAt + duration * 0.52;
    gain.gain.linearRampToValueAtTime(peak * 0.48, notchAt);
    gain.gain.linearRampToValueAtTime(
      peak * 0.82,
      Math.min(stopAt - 0.006, notchAt + duration * 0.13)
    );
  }

  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(output);

  const activeStroke: ActivePaperStroke = {
    source,
    cleanup: () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      activeStrokes.delete(activeStroke);
      source.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      gain.disconnect();
    },
  };

  activeStrokes.add(activeStroke);
  source.onended = activeStroke.cleanup;
  source.start(startAt, Math.random() * noise.duration);
  source.stop(stopAt + 0.012);
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
  let paperNoise: AudioBuffer | null = null;
  let output: GainNode | null = null;
  let disposed = false;
  const activeStrokes = new Set<ActivePaperStroke>();
  const lastPlayedAt = new Map<CardSoundEvent, number>();

  const ensureAudioGraph = () => {
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

    if (context.state === "closed") {
      return null;
    }

    if (context.state !== "running") {
      void context.resume().catch(() => undefined);
    }

    if (!paperNoise) {
      paperNoise = createPaperNoise(context);
    }

    if (!output) {
      output = context.createGain();
      output.gain.value = volume;
      output.connect(context.destination);
    }

    return { context, noise: paperNoise, output };
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

      const audioGraph = ensureAudioGraph();

      if (
        !audioGraph ||
        (event === "move" && activeStrokes.size >= MAX_ACTIVE_MOVE_STROKES)
      ) {
        return;
      }

      lastPlayedAt.set(event, playedAt);
      const intensity = clamp(playOptions.intensity ?? 1, 0.25, 1);

      PAPER_STROKES[event].forEach((stroke) => {
        playPaperStroke({
          activeStrokes,
          context: audioGraph.context,
          intensity,
          noise: audioGraph.noise,
          output: audioGraph.output,
          stroke,
        });
      });
    },
    prime() {
      ensureAudioGraph();
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
      activeStrokes.forEach((stroke) => {
        try {
          stroke.source.stop();
        } catch {
          // A source that already ended is safe to clean up directly.
        }

        stroke.cleanup();
      });
      activeStrokes.clear();
      output?.disconnect();
      output = null;
      paperNoise = null;

      if (context) {
        void context.close().catch(() => undefined);
        context = null;
      }
    },
  };
}
