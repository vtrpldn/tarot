/**
 * Lightweight, asset-free sound effects for the tarot table. The palette uses
 * low, softly enveloped sine tones and a short dark room tail instead of noise
 * textures so card interactions feel atmospheric without becoming sharp or
 * fatiguing.
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
  frequency: number;
  lowpass?: number;
  reverb?: number;
  release: number;
  volume: number;
};

type ActiveTone = {
  cleanup: () => void;
  event: CardSoundEvent;
  oscillator: OscillatorNode;
};

type MysticAudioGraph = {
  convolver: ConvolverNode;
  context: AudioContext;
  output: GainNode;
  preDelay: DelayNode;
  reverbFilter: BiquadFilterNode;
  reverbReturn: GainNode;
};

const DEFAULT_STORAGE_KEY = "tarot.card-sounds-muted";
const DEFAULT_VOLUME = 0.18;
const REVERB_DURATION_SECONDS = 0.74;
const REVERB_PRE_DELAY_SECONDS = 0.028;
const REVERB_RETURN = 0.11;
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

function createDarkReverbImpulse(context: AudioContext) {
  const length = Math.max(
    1,
    Math.floor(context.sampleRate * REVERB_DURATION_SECONDS)
  );
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (
    let channelIndex = 0;
    channelIndex < impulse.numberOfChannels;
    channelIndex += 1
  ) {
    const channel = impulse.getChannelData(channelIndex);
    let seed = 0x5f3759df ^ ((channelIndex + 1) * 0x45d9f3b);
    let smoothed = 0;

    for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      const noise = (seed / 0xffffffff) * 2 - 1;
      smoothed += (noise - smoothed) * 0.18;

      const progress = sampleIndex / Math.max(1, length - 1);
      const fadeIn = Math.min(1, progress / 0.025);
      channel[sampleIndex] =
        smoothed * fadeIn * Math.pow(1 - progress, 2.7) * 0.24;
    }
  }

  return impulse;
}

// A low D-minor-nine palette keeps repeated gestures cohesive. Every voice is
// a fixed sine wave: the depth comes from the harmony and room tail, never a
// buzzy waveform, randomized pitch, or synthetic frequency sweep.
const MYSTIC_TONES: Record<CardSoundEvent, readonly MysticTone[]> = {
  pickup: [
    {
      attack: 0.055,
      duration: 0.28,
      frequency: 146.83,
      release: 0.19,
      reverb: 0.08,
      volume: 0.032,
    },
  ],
  move: [
    {
      attack: 0.06,
      duration: 0.24,
      frequency: 110,
      release: 0.16,
      volume: 0.012,
    },
  ],
  drop: [
    {
      attack: 0.045,
      duration: 0.42,
      frequency: 110,
      release: 0.3,
      reverb: 0.2,
      volume: 0.045,
    },
    {
      attack: 0.072,
      delay: 0.05,
      duration: 0.4,
      frequency: 146.83,
      release: 0.27,
      reverb: 0.14,
      volume: 0.018,
    },
  ],
  flip: [
    {
      attack: 0.068,
      duration: 0.56,
      frequency: 146.83,
      release: 0.34,
      reverb: 0.34,
      volume: 0.034,
    },
    {
      attack: 0.082,
      delay: 0.085,
      duration: 0.58,
      frequency: 110,
      release: 0.32,
      reverb: 0.3,
      volume: 0.022,
    },
  ],
  rotate: [
    {
      attack: 0.06,
      duration: 0.26,
      frequency: 146.83,
      release: 0.17,
      reverb: 0.1,
      volume: 0.016,
    },
  ],
  shuffle: [
    {
      attack: 0.075,
      duration: 0.48,
      frequency: 110,
      release: 0.3,
      reverb: 0.18,
      volume: 0.019,
    },
    {
      attack: 0.082,
      delay: 0.07,
      duration: 0.5,
      frequency: 87.31,
      release: 0.31,
      reverb: 0.16,
      volume: 0.016,
    },
    {
      attack: 0.07,
      delay: 0.145,
      duration: 0.42,
      frequency: 146.83,
      release: 0.25,
      reverb: 0.12,
      volume: 0.012,
    },
  ],
  arrange: [
    {
      attack: 0.08,
      duration: 0.54,
      frequency: 146.83,
      release: 0.32,
      reverb: 0.26,
      volume: 0.026,
    },
    {
      attack: 0.09,
      delay: 0.12,
      duration: 0.52,
      frequency: 174.61,
      release: 0.3,
      reverb: 0.2,
      volume: 0.016,
    },
  ],
  draw: [
    {
      attack: 0.09,
      duration: 0.74,
      frequency: 110,
      release: 0.4,
      reverb: 0.4,
      volume: 0.03,
    },
    {
      attack: 0.09,
      delay: 0.14,
      duration: 0.66,
      frequency: 146.83,
      release: 0.35,
      reverb: 0.32,
      volume: 0.02,
    },
    {
      attack: 0.08,
      delay: 0.27,
      duration: 0.52,
      frequency: 174.61,
      release: 0.29,
      reverb: 0.26,
      volume: 0.012,
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
  const reverbSend = tone.reverb ? context.createGain() : null;
  const peak = Math.max(0.0001, tone.volume * intensity);
  let cleanedUp = false;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(tone.frequency, startAt);
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.2;
  lowpass.frequency.setValueAtTime(tone.lowpass ?? 1_050, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peak, attackAt);
  gain.gain.setValueAtTime(peak, releaseAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  oscillator.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(graph.output);

  if (reverbSend) {
    reverbSend.gain.value = clamp(tone.reverb ?? 0, 0, 0.5);
    gain.connect(reverbSend);
    reverbSend.connect(graph.preDelay);
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
      reverbSend?.disconnect();
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
      const preDelay = context.createDelay(0.1);
      const convolver = context.createConvolver();
      const reverbFilter = context.createBiquadFilter();
      const reverbReturn = context.createGain();

      output.gain.value = muted ? 0 : volume;
      preDelay.delayTime.value = REVERB_PRE_DELAY_SECONDS;
      convolver.buffer = createDarkReverbImpulse(context);
      reverbFilter.type = "lowpass";
      reverbFilter.frequency.value = 950;
      reverbFilter.Q.value = 0.25;
      reverbReturn.gain.value = muted ? 0 : REVERB_RETURN;

      preDelay.connect(convolver);
      convolver.connect(reverbFilter);
      reverbFilter.connect(reverbReturn);
      reverbReturn.connect(output);
      output.connect(context.destination);

      graph = {
        convolver,
        context,
        output,
        preDelay,
        reverbFilter,
        reverbReturn,
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
      graph.reverbReturn.gain.value = 0;
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
      audioGraph.reverbReturn.gain.value = REVERB_RETURN;
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
        graph.preDelay.disconnect();
        graph.convolver.disconnect();
        graph.reverbFilter.disconnect();
        graph.reverbReturn.disconnect();
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
