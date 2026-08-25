/**
 * Lightweight, asset-free sound effects for the tarot table. The palette uses
 * low, softly enveloped tones and a bounded echo instead of noise textures so
 * card interactions feel atmospheric without becoming sharp or fatiguing.
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

type MysticTone = {
  attack: number;
  delay?: number;
  duration: number;
  echo?: number;
  frequency: number;
  lowpass?: number;
  release: number;
  type: "sine" | "triangle";
  volume: number;
};

type ActiveTone = {
  cleanup: () => void;
  event: CardSoundEvent;
  oscillator: OscillatorNode;
};

type MysticAudioGraph = {
  context: AudioContext;
  delay: DelayNode;
  echoFilter: BiquadFilterNode;
  echoReturn: GainNode;
  feedback: GainNode;
  output: GainNode;
};

const DEFAULT_STORAGE_KEY = "tarot.card-sounds-muted";
const DEFAULT_VOLUME = 0.2;
const ECHO_DELAY_SECONDS = 0.24;
const ECHO_FEEDBACK = 0.12;
const ECHO_RETURN = 0.14;
const MAX_ACTIVE_TONES = 6;
const MAX_ACTIVE_MOVE_TONES = 1;
const THROTTLE_MS: Record<CardSoundEvent, number> = {
  pickup: 110,
  move: 240,
  drop: 150,
  flip: 280,
  rotate: 180,
  shuffle: 420,
  arrange: 360,
  draw: 420,
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

// A fixed D-minor-nine palette keeps repeated gestures cohesive and avoids the
// synthetic chirp created by random pitch or fast frequency sweeps.
const MYSTIC_TONES: Record<CardSoundEvent, readonly MysticTone[]> = {
  pickup: [
    {
      attack: 0.032,
      duration: 0.21,
      frequency: 174.61,
      release: 0.15,
      type: "triangle",
      volume: 0.045,
    },
  ],
  move: [
    {
      attack: 0.042,
      duration: 0.145,
      frequency: 146.83,
      release: 0.088,
      type: "sine",
      volume: 0.018,
    },
  ],
  drop: [
    {
      attack: 0.016,
      duration: 0.285,
      echo: 0.28,
      frequency: 146.83,
      release: 0.245,
      type: "triangle",
      volume: 0.06,
    },
    {
      attack: 0.042,
      delay: 0.034,
      duration: 0.31,
      frequency: 110,
      release: 0.225,
      type: "sine",
      volume: 0.026,
    },
  ],
  flip: [
    {
      attack: 0.045,
      duration: 0.36,
      echo: 0.5,
      frequency: 164.81,
      release: 0.265,
      type: "triangle",
      volume: 0.044,
    },
    {
      attack: 0.068,
      delay: 0.072,
      duration: 0.405,
      echo: 0.45,
      frequency: 220,
      release: 0.255,
      type: "sine",
      volume: 0.024,
    },
  ],
  rotate: [
    {
      attack: 0.035,
      duration: 0.185,
      frequency: 174.61,
      release: 0.12,
      type: "sine",
      volume: 0.022,
    },
  ],
  shuffle: [
    {
      attack: 0.058,
      duration: 0.34,
      echo: 0.35,
      frequency: 146.83,
      release: 0.22,
      type: "triangle",
      volume: 0.026,
    },
    {
      attack: 0.062,
      delay: 0.062,
      duration: 0.305,
      echo: 0.3,
      frequency: 110,
      release: 0.185,
      type: "sine",
      volume: 0.021,
    },
    {
      attack: 0.048,
      delay: 0.126,
      duration: 0.285,
      echo: 0.35,
      frequency: 174.61,
      release: 0.175,
      type: "triangle",
      volume: 0.016,
    },
  ],
  arrange: [
    {
      attack: 0.065,
      duration: 0.39,
      echo: 0.4,
      frequency: 174.61,
      release: 0.24,
      type: "triangle",
      volume: 0.032,
    },
    {
      attack: 0.072,
      delay: 0.108,
      duration: 0.36,
      echo: 0.4,
      frequency: 220,
      release: 0.21,
      type: "sine",
      volume: 0.018,
    },
  ],
  draw: [
    {
      attack: 0.082,
      duration: 0.62,
      echo: 0.55,
      frequency: 146.83,
      release: 0.33,
      type: "triangle",
      volume: 0.04,
    },
    {
      attack: 0.078,
      delay: 0.128,
      duration: 0.52,
      echo: 0.5,
      frequency: 174.61,
      release: 0.265,
      type: "sine",
      volume: 0.025,
    },
    {
      attack: 0.065,
      delay: 0.252,
      duration: 0.39,
      echo: 0.45,
      frequency: 261.63,
      release: 0.195,
      type: "sine",
      volume: 0.014,
    },
  ],
};

function playMysticTone({
  activeTones,
  event,
  graph,
  intensity,
  tone,
}: {
  activeTones: Set<ActiveTone>;
  event: CardSoundEvent;
  graph: MysticAudioGraph;
  intensity: number;
  tone: MysticTone;
}) {
  const { context } = graph;
  const startAt = context.currentTime + Math.max(0, tone.delay ?? 0);
  const stopAt = startAt + tone.duration;
  const attackAt = Math.min(stopAt - 0.008, startAt + tone.attack);
  const releaseAt = Math.max(
    attackAt + 0.004,
    stopAt - Math.min(tone.release, tone.duration - 0.012)
  );
  const oscillator = context.createOscillator();
  const lowpass = context.createBiquadFilter();
  const gain = context.createGain();
  const echoSend = tone.echo ? context.createGain() : null;
  const peak = Math.max(0.0001, tone.volume * intensity);
  let cleanedUp = false;

  oscillator.type = tone.type;
  oscillator.frequency.setValueAtTime(tone.frequency, startAt);
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.35;
  lowpass.frequency.setValueAtTime(
    tone.lowpass ?? (tone.type === "triangle" ? 1_500 : 1_400),
    startAt
  );
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peak, attackAt);
  gain.gain.setValueAtTime(peak, releaseAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  oscillator.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(graph.output);

  if (echoSend) {
    echoSend.gain.value = clamp(tone.echo ?? 0, 0, 0.65);
    gain.connect(echoSend);
    echoSend.connect(graph.delay);
  }

  const activeTone: ActiveTone = {
    event,
    oscillator,
    cleanup: () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      activeTones.delete(activeTone);
      oscillator.disconnect();
      lowpass.disconnect();
      gain.disconnect();
      echoSend?.disconnect();
    },
  };

  activeTones.add(activeTone);
  oscillator.onended = activeTone.cleanup;
  oscillator.start(startAt);
  oscillator.stop(stopAt + 0.02);
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
  let graph: MysticAudioGraph | null = null;
  let disposed = false;
  const activeTones = new Set<ActiveTone>();
  const lastPlayedAt = new Map<CardSoundEvent, number>();

  const stopTone = (tone: ActiveTone) => {
    try {
      tone.oscillator.stop();
    } catch {
      // A tone that already ended is safe to clean up directly.
    }

    tone.cleanup();
  };

  const silenceActiveTones = () => {
    Array.from(activeTones).forEach(stopTone);
    activeTones.clear();
  };

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

    if (!graph) {
      const output = context.createGain();
      const delay = context.createDelay(0.5);
      const echoFilter = context.createBiquadFilter();
      const echoReturn = context.createGain();
      const feedback = context.createGain();

      output.gain.value = muted ? 0 : volume;
      delay.delayTime.value = ECHO_DELAY_SECONDS;
      echoFilter.type = "lowpass";
      echoFilter.frequency.value = 1_600;
      echoFilter.Q.value = 0.35;
      echoReturn.gain.value = muted ? 0 : ECHO_RETURN;
      feedback.gain.value = muted ? 0 : ECHO_FEEDBACK;

      delay.connect(echoFilter);
      echoFilter.connect(echoReturn);
      echoReturn.connect(output);
      echoFilter.connect(feedback);
      feedback.connect(delay);
      output.connect(context.destination);

      graph = {
        context,
        delay,
        echoFilter,
        echoReturn,
        feedback,
        output,
      };
    }

    return graph;
  };

  const setGraphMuted = (nextMuted: boolean) => {
    if (!graph) {
      return;
    }

    graph.output.gain.value = nextMuted ? 0 : volume;

    if (nextMuted) {
      graph.echoReturn.gain.value = 0;
      graph.feedback.gain.value = 0;
    }
  };

  return {
    play(event, playOptions = {}) {
      if (muted || disposed) {
        return;
      }

      const requestedIntensity = clamp(playOptions.intensity ?? 1, 0.25, 1);

      if (event === "move" && requestedIntensity < 0.3) {
        return;
      }

      const playedAt = now();
      const previous = lastPlayedAt.get(event) ?? -Infinity;

      if (playedAt - previous < THROTTLE_MS[event]) {
        return;
      }

      if (
        event === "move" &&
        Array.from(activeTones).filter((tone) => tone.event === "move").length >=
          MAX_ACTIVE_MOVE_TONES
      ) {
        return;
      }

      const audioGraph = ensureAudioGraph();

      if (!audioGraph) {
        return;
      }

      const tones = MYSTIC_TONES[event];

      while (activeTones.size + tones.length > MAX_ACTIVE_TONES) {
        const oldest =
          Array.from(activeTones).find((tone) => tone.event !== "draw") ??
          activeTones.values().next().value;

        if (!oldest) {
          break;
        }

        stopTone(oldest);
      }

      lastPlayedAt.set(event, playedAt);
      audioGraph.output.gain.value = volume;
      audioGraph.echoReturn.gain.value = ECHO_RETURN;
      audioGraph.feedback.gain.value = ECHO_FEEDBACK;
      const intensity = ["flip", "shuffle", "arrange", "draw"].includes(
        event
      )
        ? Math.min(requestedIntensity, 0.85)
        : requestedIntensity;

      tones.forEach((tone) => {
        playMysticTone({
          activeTones,
          event,
          graph: audioGraph,
          intensity,
          tone,
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
      setGraphMuted(muted);

      if (muted) {
        silenceActiveTones();
      }
    },
    toggleMuted() {
      muted = !muted;
      persistMuted(storageKey, muted);
      setGraphMuted(muted);

      if (muted) {
        silenceActiveTones();
      }

      return muted;
    },
    dispose() {
      disposed = true;
      lastPlayedAt.clear();
      silenceActiveTones();

      if (graph) {
        graph.delay.disconnect();
        graph.echoFilter.disconnect();
        graph.echoReturn.disconnect();
        graph.feedback.disconnect();
        graph.output.disconnect();
        graph = null;
      }

      if (context) {
        void context.close().catch(() => undefined);
        context = null;
      }
    },
  };
}
