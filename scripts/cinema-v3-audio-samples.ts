import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";

async function main() {
  const output = process.env.DOCKED_VISUAL_EVIDENCE;
  if (!output) throw Error("Set DOCKED_VISUAL_EVIDENCE");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      "<!doctype html><title>Original Docked sound samples</title>",
    );
    await page.addScriptTag({ content: "window.__name = value => value;" });
    await page.addScriptTag({
      content: await bundleCommunityFixture("tests/fixtures/cinema-audio.ts"),
    });
    for (const tier of [
      "CORE",
      "RARE",
      "ELITE",
      "ULTRA_RARE",
      "LEGENDARY",
      "ICON",
    ]) {
      const result = await page.evaluate(async (tier) => {
        const context = new OfflineAudioContext(2, 44100 * 6, 44100);
        const duration = (
          window as unknown as {
            cinemaAudio: (c: BaseAudioContext, t: string) => number;
          }
        ).cinemaAudio(context, tier);
        const audio = await context.startRendering();
        const frames = Math.min(audio.length, Math.ceil(duration * 44100));
        const bytes = new ArrayBuffer(44 + frames * 4),
          view = new DataView(bytes);
        const text = (at: number, value: string) =>
          [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
        text(0, "RIFF");
        view.setUint32(4, bytes.byteLength - 8, true);
        text(8, "WAVE");
        text(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, 44100, true);
        view.setUint32(28, 44100 * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        text(36, "data");
        view.setUint32(40, frames * 4, true);
        const channels = [audio.getChannelData(0), audio.getChannelData(1)];
        let peak = 0;
        for (let i = 0; i < frames; i++)
          for (let c = 0; c < 2; c++) {
            const value = channels[c][i];
            peak = Math.max(peak, Math.abs(value));
            view.setInt16(
              44 + i * 4 + c * 2,
              Math.round(Math.max(-1, Math.min(1, value)) * 32767),
              true,
            );
          }
        return { bytes: Array.from(new Uint8Array(bytes)), duration, peak };
      }, tier);
      await writeFile(
        path.join(output, tier.toLowerCase() + ".wav"),
        Buffer.from(result.bytes),
      );
      console.log(
        JSON.stringify({
          tier,
          duration: result.duration,
          peak: result.peak,
          bytes: result.bytes.length,
        }),
      );
    }
  } finally {
    await browser.close();
  }
}
void main();
