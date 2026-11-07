import { cinemaV2Timing, type CinemaTier } from "./pack-cinema-v2-model";

/** Original synthesised score; no sampled recordings, trackers or licence fees. */
export function scheduleCinemaAudio(
  context: BaseAudioContext,
  tier: CinemaTier,
) {
  const base = context.currentTime;
  const timing = cinemaV2Timing(tier);
  const turn = timing.rarity / 1000;
  const impact = turn + (timing.flip / 1000) * 0.53;
  const icon = tier === "ICON";
  const master = context.createGain();
  master.gain.value = 0.09;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -18;
  limiter.ratio.value = 6;
  master.connect(limiter);
  limiter.connect(context.destination);
  function tone(
    at: number,
    length: number,
    from: number,
    to: number,
    volume: number,
    type: OscillatorType = "sine",
  ) {
    const oscillator = context.createOscillator(),
      envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, base + at);
    oscillator.frequency.exponentialRampToValueAtTime(to, base + at + length);
    envelope.gain.setValueAtTime(0, base + at);
    envelope.gain.linearRampToValueAtTime(
      volume,
      base + at + Math.min(0.08, length / 3),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, base + at + length);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(base + at);
    oscillator.stop(base + at + length + 0.02);
  }
  // Low energy rise + harmonic announcement + rotation sweep + impact/chime.
  tone(0, turn, icon ? 78 : 55, icon ? 233 : 147, 0.45, "triangle");
  tone(0.12, turn * 0.8, icon ? 156 : 110, icon ? 466 : 294, 0.18);
  const chord = icon
    ? [587.33, 880, 1174.66, 1760]
    : [220, 277.18, 329.63, 440];
  chord.forEach((frequency, i) =>
    tone(0.38 + i * 0.07, 1.1, frequency, frequency, 0.2),
  );
  tone(turn, 0.6, 1200, 90, 0.17, "triangle");
  tone(impact, 0.7, icon ? 100 : 80, 35, 0.6);
  chord.forEach((frequency, i) =>
    tone(
      impact + i * 0.055,
      1.25,
      frequency * (icon ? 1.5 : 2),
      frequency * (icon ? 1.5 : 2),
      0.2,
    ),
  );
  return impact + 1.5;
}

export function playCinemaAudio(tier: CinemaTier) {
  try {
    const context = new AudioContext();
    let closed = false;
    const stop = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", stop);
      void context.close().catch(() => {});
    };
    const hidden = () => {
      if (document.hidden) stop();
    };
    const timer = setTimeout(
      stop,
      (scheduleCinemaAudio(context, tier) + 0.2) * 1000,
    );
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", stop);
    void context.resume().catch(stop);
    return stop;
  } catch {
    return () => {};
  }
}
