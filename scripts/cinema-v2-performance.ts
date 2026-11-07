import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const output = process.env.DOCKED_VISUAL_EVIDENCE;
  if (!output) throw Error("Set DOCKED_VISUAL_EVIDENCE.");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const reports: unknown[] = [];
  try {
    const idleContext = await browser.newContext({
      viewport: { width: 412, height: 850 },
      deviceScaleFactor: 2,
    });
    const idle = await idleContext.newPage();
    await idle.addInitScript("window.__name = value => value;");
    await idle.goto("http://127.0.0.1:3137/preview/pack-opening");
    const idleResult = await idle.evaluate(
      () =>
        new Promise((resolve) => {
          let previous = 0;
          const samples: number[] = [];
          const start = performance.now();
          const sample = (now: number) => {
            if (previous) samples.push(now - previous);
            previous = now;
            if (now - start < 2000) requestAnimationFrame(sample);
            else {
              const sum = samples.reduce((a, b) => a + b, 0);
              resolve({
                frames: samples.length,
                fps: (samples.length / sum) * 1000,
                p50ms: [...samples].sort((a, b) => a - b)[
                  Math.floor(samples.length * 0.5)
                ],
              });
            }
          };
          requestAnimationFrame(sample);
        }),
    );
    reports.push({ idlePage: idleResult });
    await idleContext.close();
    for (const rate of [1, 4])
      for (const tier of ["Legendary", "Icon"]) {
        const context = await browser.newContext({
          viewport: { width: 412, height: 850 },
          deviceScaleFactor: 2,
          reducedMotion: "no-preference",
        });
        const page = await context.newPage();
        await page.addInitScript("window.__name = value => value;");
        await page.goto("http://127.0.0.1:3137/preview/pack-opening");
        await page
          .getByRole("button", { name: "V2 " + tier, exact: true })
          .click();
        await page
          .getByRole("button", { name: "Open pack", exact: true })
          .click();
        await expect(page.locator(".cinema-v2")).toHaveAttribute(
          "data-pack-reveal-phase",
          "mystery",
        );
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        await page.evaluate(() => {
          const samples: number[] = [];
          Object.assign(window, { cinemaPerformanceSamples: samples });
          let previous = 0;
          const start = performance.now();
          const sample = (now: number) => {
            if (previous) samples.push(now - previous);
            previous = now;
            if (now - start < 5500) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        await page
          .getByRole("button", { name: "Reveal card", exact: true })
          .click();
        await expect(page.locator(".cinema-v2")).toHaveAttribute(
          "data-pack-reveal-phase",
          "revealed",
          { timeout: 12000 },
        );
        await page.waitForTimeout(2400);
        const measured = await page.evaluate(() => {
          const samples = (
            window as unknown as { cinemaPerformanceSamples: number[] }
          ).cinemaPerformanceSamples;
          const sorted = [...samples].sort((a, b) => a - b);
          const total = samples.reduce((a, b) => a + b, 0);
          const scene = document.querySelector<HTMLElement>(".cinema-v2")!;
          return {
            frames: samples.length,
            fps: Math.round((samples.length / total) * 10000) / 10,
            p50ms: sorted[Math.floor(sorted.length * 0.5)],
            p95ms: sorted[Math.floor(sorted.length * 0.95)],
            over25ms: samples.filter((n) => n > 25).length,
            maxMs: sorted.at(-1),
            quality: scene.dataset.vfxQuality,
            meanCanvasDrawMs: scene.dataset.vfxRenderMs,
            userAgent: navigator.userAgent,
            hardwareConcurrency: navigator.hardwareConcurrency,
            backingWidth: scene.querySelector("canvas")!.width,
            devicePixelRatio,
          };
        });
        reports.push({ tier, cpuSlowdown: rate, ...measured });
        await context.close();
      }
    await writeFile(
      path.join(output, "performance.json"),
      JSON.stringify(
        {
          environment:
            "Windows headless Edge, mobile viewport, 2x DPR; not an Android device",
          capture: "No video/screenshots during measurement",
          reports,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(reports, null, 2));
  } finally {
    await browser.close();
  }
}
void main();
