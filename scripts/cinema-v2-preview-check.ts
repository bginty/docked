import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const output = process.env.DOCKED_VISUAL_EVIDENCE;
  if (!output)
    throw Error("Set DOCKED_VISUAL_EVIDENCE to a local evidence directory.");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const reports: Array<Record<string, unknown> & { frameIntervals: number[] }> =
    [];
  try {
    for (const tier of ["Legendary", "Icon"]) {
      const context = await browser.newContext({
        viewport: { width: 412, height: 850 },
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
        recordVideo: {
          dir: path.join(output, "video"),
          size: { width: 412, height: 850 },
        },
      });
      const page = await context.newPage();
      await page.addInitScript("window.__name = value => value;");
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://127.0.0.1:3137/preview/pack-opening");
      await page
        .getByRole("button", { name: "V2 " + tier, exact: true })
        .click();
      await page
        .getByRole("button", { name: "Open pack", exact: true })
        .click();
      const scene = page.locator(".cinema-v2");
      await expect(scene).toHaveAttribute("data-pack-reveal-phase", "mystery");
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(output, tier.toLowerCase() + "-mystery.png"),
      });
      await page.evaluate(() => {
        const record = {
          frames: [] as number[],
          previous: 0,
          started: performance.now(),
        };
        const sample = (now: number) => {
          if (record.previous) record.frames.push(now - record.previous);
          record.previous = now;
          if (now - record.started < 6500) requestAnimationFrame(sample);
        };
        Object.assign(window, { cinemaFrames: record });
        requestAnimationFrame(sample);
      });
      await page
        .getByRole("button", { name: "Reveal card", exact: true })
        .click();
      await page.waitForTimeout(1250);
      await page.screenshot({
        path: path.join(output, tier.toLowerCase() + "-rarity.png"),
      });
      await expect(scene).toHaveAttribute("data-pack-reveal-phase", "flipping");
      await page.waitForTimeout(tier === "Icon" ? 465 : 415);
      await page.screenshot({
        path: path.join(output, tier.toLowerCase() + "-flip.png"),
      });
      await expect(scene).toHaveAttribute("data-pack-reveal-phase", "revealed");
      await page.waitForTimeout(160);
      await page.screenshot({
        path: path.join(output, tier.toLowerCase() + "-player.png"),
      });
      await page.waitForTimeout(1700);
      await page.screenshot({
        path: path.join(output, tier.toLowerCase() + "-settled.png"),
      });
      const result = await scene.evaluate((el) => ({
        rect: el.getBoundingClientRect().toJSON(),
        card: el
          .querySelector(".cinema-v2-card-anchor")!
          .getBoundingClientRect()
          .toJSON(),
        quality: (el as HTMLElement).dataset.vfxQuality,
        renderMs: (el as HTMLElement).dataset.vfxRenderMs,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      const timing = await page.evaluate(
        () =>
          (window as unknown as { cinemaFrames: { frames: number[] } })
            .cinemaFrames.frames,
      );
      reports.push({ tier, errors, ...result, frameIntervals: timing });
      await context.close();
      await page
        .video()!
        .saveAs(path.join(output, tier.toLowerCase() + "-afl-full.webm"));
    }
    await writeFile(
      path.join(output, "preview-check.json"),
      JSON.stringify(reports, null, 2),
    );
    console.log(
      JSON.stringify(
        reports.map((report) => ({
          ...report,
          frameIntervals: `${report.frameIntervals.length} samples stored`,
        })),
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}
void main();
