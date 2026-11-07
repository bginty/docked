import {
  cinemaProfiles,
  cinemaV2Timing,
  type CinemaPhase,
  type CinemaTier,
} from "./pack-cinema-v2-model";

/** Original synthesis: no downloaded recordings, music, network or trackers.
 * Phases are cued by the card's animationstart, not by the initial tap clock. */
export const cinemaAudioVoices = {
  CORE: {
    root: 392,
    chord: [1, 1.5],
    bass: 110,
    gain: 0.26,
    tail: 0.22,
    noise: 0.12,
  },
  RARE: {
    root: 440,
    chord: [1, 1.5, 2],
    bass: 98,
    gain: 0.24,
    tail: 0.42,
    noise: 0.2,
  },
  ELITE: {
    root: 330,
    chord: [1, 1.25, 1.5, 2],
    bass: 82,
    gain: 0.22,
    tail: 0.65,
    noise: 0.28,
  },
  ULTRA_RARE: {
    root: 294,
    chord: [1, 1.5, 2.01, 2.5],
    bass: 65,
    gain: 0.21,
    tail: 0.85,
    noise: 0.33,
  },
  LEGENDARY: {
    root: 220,
    chord: [1, 1.25, 1.5, 2, 3],
    bass: 55,
    gain: 0.2,
    tail: 1.1,
    noise: 0.38,
  },
  ICON: {
    root: 294,
    chord: [1, 1.5, 2, 3, 4],
    bass: 49,
    gain: 0.19,
    tail: 1.35,
    noise: 0.42,
  },
} as const;

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(context: BaseAudioContext) {
  const cached = noiseCache.get(context);
  if (cached) return cached;
  // Fixed seed is decorative audio only; completely unrelated to pack results.
  const buffer = context.createBuffer(
    1,
    context.sampleRate,
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  let seed = 18817;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = (seed / 4294967296) * 2 - 1;
  }
  noiseCache.set(context, buffer);
  return buffer;
}

/** One bounded voice group for a single card. Shared context, no overlapping cards. */
export function createCinemaScore(context: BaseAudioContext, tier: CinemaTier) {
  const voice = cinemaAudioVoices[tier],
    level = cinemaProfiles[tier].level;
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  master.gain.value = voice.gain;
  compressor.threshold.value = -15;
  compressor.knee.value = 9;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;
  master.connect(compressor);
  compressor.connect(context.destination);
  const nodes = new Set<AudioScheduledSourceNode>();
  const seen = new Set<CinemaPhase>();
  let stopped = false;
  const timing = cinemaV2Timing(tier);
  function source(
    node: AudioScheduledSourceNode,
    start: number,
    duration: number,
  ) {
    nodes.add(node);
    node.onended = () => {
      nodes.delete(node);
      node.disconnect();
    };
    node.start(start);
    node.stop(start + duration + 0.02);
  }
  function tone(
    at: number,
    duration: number,
    from: number,
    to: number,
    volume: number,
    type: OscillatorType = "sine",
    pan = 0,
    attack = 0.018,
  ) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const stereo = context.createStereoPanner();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, to),
      at + duration,
    );
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(
      volume,
      at + Math.min(attack, duration / 3),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    stereo.pan.value = pan;
    oscillator.connect(envelope);
    envelope.connect(stereo);
    stereo.connect(master);
    oscillator.onended = null;
    source(oscillator, at, duration);
  }
  function air(
    at: number,
    duration: number,
    from: number,
    to: number,
    volume: number,
    pan = 0,
  ) {
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer(context);
    noise.loop = true;
    const filter = context.createBiquadFilter(),
      gain = context.createGain(),
      stereo = context.createStereoPanner();
    filter.type = "bandpass";
    filter.Q.value = 0.65;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, volume),
      at + duration * 0.63,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    stereo.pan.setValueAtTime(-pan, at);
    stereo.pan.linearRampToValueAtTime(pan, at + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(stereo);
    stereo.connect(master);
    source(noise, at, duration);
  }
  function phase(phase: CinemaPhase, at = context.currentTime) {
    if (stopped || seen.has(phase) || phase === "mystery") return;
    seen.add(phase);
    const turn = timing.flip / 1000;
    if (phase === "rarity") {
      const duration = timing.rarity / 1000;
      tone(
        at,
        Math.min(0.2, duration),
        voice.root * 0.5,
        voice.root,
        0.25,
        "triangle",
      );
      if (level > 0)
        air(at, duration, 200, 1800 + level * 450, voice.noise, 0.25);
      if (level >= 2) {
        tone(
          at + 0.04,
          duration * 0.94,
          voice.bass,
          voice.bass * 3,
          0.25,
          "triangle",
          -0.15,
          duration * 0.4,
        );
        tone(
          at + 0.1,
          duration * 0.83,
          voice.bass * 2,
          voice.bass * 6,
          0.12,
          "sine",
          0.15,
          duration * 0.35,
        );
      }
      // Announce the actual rarity with a distinct harmonic shape, not speech.
      voice.chord.forEach((ratio, i) =>
        tone(
          at + Math.min(0.25, duration * 0.2) + i * 0.035,
          Math.min(0.55, duration * 0.65),
          voice.root * ratio,
          voice.root * ratio,
          0.14,
          "sine",
          (i % 2 ? 1 : -1) * 0.24,
        ),
      );
      if (tier === "ICON") {
        // Recognisable three-note diamond ascent before the final turn.
        [1, 1.5, 2].forEach((ratio, i) =>
          tone(
            at + duration * 0.55 + i * 0.14,
            0.45,
            880 * ratio,
            880 * ratio,
            0.13,
            "sine",
            (i - 1) * 0.3,
          ),
        );
      }
    } else if (phase === "flipping") {
      air(at, turn * 0.75, 2300, 280, 0.18 + voice.noise, 0.4);
      tone(at, turn * 0.6, 740 + level * 80, 120, 0.12, "triangle");
      // This matches the Canvas radial flash, 53% through the real flip phase.
      const impact = at + turn * 0.53;
      tone(
        impact,
        0.2 + level * 0.055,
        voice.bass * 1.65,
        voice.bass,
        0.8,
        "sine",
      );
      tone(impact, 0.12, 160 + level * 15, 80, 0.16, "triangle");
      if (level >= 2) air(impact, 0.19, 1300, 3000, 0.2);
      voice.chord
        .slice(0, level >= 3 ? 4 : 2)
        .forEach((ratio, i) =>
          tone(
            impact + 0.015 * i,
            0.25 + level * 0.045,
            voice.root * ratio,
            voice.root * ratio,
            0.12,
          ),
        );
    } else if (phase === "revealed") {
      const shimmerRoot = tier === "ICON" ? 1174.66 : voice.root * 2;
      voice.chord.forEach((ratio, i) => {
        const start = at + i * (tier === "ICON" ? 0.065 : 0.04);
        tone(
          start,
          voice.tail,
          shimmerRoot * ratio,
          shimmerRoot * ratio * 0.999,
          0.2,
          "sine",
          (i % 2 ? 1 : -1) * 0.35,
        );
        if (level >= 3)
          tone(
            start + 0.025,
            voice.tail * 0.6,
            shimmerRoot * ratio * 2.01,
            shimmerRoot * ratio * 2,
            0.045,
            "sine",
            (i % 2 ? -1 : 1) * 0.35,
          );
      });
    }
  }
  return {
    phase,
    stop() {
      if (stopped) return;
      stopped = true;
      const at = context.currentTime;
      master.gain.cancelScheduledValues(at);
      master.gain.setValueAtTime(master.gain.value, at);
      master.gain.linearRampToValueAtTime(0, at + 0.015);
      for (const node of nodes) {
        try {
          node.stop(at + 0.02);
        } catch {}
      }
    },
    dispose() {
      master.disconnect();
      compressor.disconnect();
      nodes.clear();
    },
  };
}

/** Offline rendering and evidence uses the same phase score as the player. */
export function scheduleCinemaAudio(
  context: BaseAudioContext,
  tier: CinemaTier,
) {
  const score = createCinemaScore(context, tier),
    timing = cinemaV2Timing(tier);
  const start = context.currentTime;
  score.phase("rarity", start);
  score.phase("flipping", start + timing.rarity / 1000);
  score.phase("revealed", start + (timing.rarity + timing.flip) / 1000);
  return (
    (timing.rarity + timing.flip) / 1000 + cinemaAudioVoices[tier].tail + 0.4
  );
}

/** Construct only inside a user gesture. One context per open pack, reused for
 * nine cards and closed on close/mute/background. No autoplay on mount/resume. */
export function createCinemaAudioPlayer() {
  const context = new AudioContext();
  let score: ReturnType<typeof createCinemaScore> | undefined;
  let closed = false;
  const retire = () => {
    const previous = score;
    previous?.stop();
    score = undefined;
    if (previous) setTimeout(() => previous.dispose(), 40);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    retire();
    document.removeEventListener("visibilitychange", hidden);
    window.removeEventListener("pagehide", close);
    void context.close().catch(() => {});
  };
  const hidden = () => {
    if (document.hidden) close();
  };
  document.addEventListener("visibilitychange", hidden);
  window.addEventListener("pagehide", close);
  void context.resume().catch(close);
  return {
    get closed() {
      return closed;
    },
    start(tier: CinemaTier) {
      retire();
      if (!closed) score = createCinemaScore(context, tier);
    },
    phase(phase: CinemaPhase) {
      if (!closed && !document.hidden) score?.phase(phase);
    },
    stop: retire,
    close,
  };
}
