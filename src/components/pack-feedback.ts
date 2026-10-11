/** Optional, user-initiated effects. No audio files, trackers or persistent AudioContext. */
export function packSound() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      660,
      context.currentTime + 0.18,
    );
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      void context.close();
    };
    void context.resume().catch(() => context.close());
    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
  } catch {
    /* Audio is optional; presentation remains usable. */
  }
}
