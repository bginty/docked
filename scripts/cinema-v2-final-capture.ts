import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

async function main() {
  const output = process.env.DOCKED_VISUAL_EVIDENCE;
  if (!output) throw Error("Set DOCKED_VISUAL_EVIDENCE.");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results: unknown[] = [];
  try {
    for (const tier of ["Legendary", "Icon"]) {
      // Uninterrupted playback. Stage studies below use a separate browser.
      const context = await browser.newContext({
        viewport: { width: 412, height: 850 },
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
        recordVideo: {
          dir: path.join(output, "raw-video"),
          size: { width: 412, height: 850 },
        },
      });
      const videoStart = Date.now();
      const page = await context.newPage();
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
      const startOffset = Math.max(0, (Date.now() - videoStart) / 1000 - 0.2);
      await page.waitForTimeout(850);
      await page
        .getByRole("button", { name: "Reveal card", exact: true })
        .click();
      await expect(page.locator(".cinema-v2")).toHaveAttribute(
        "data-pack-reveal-phase",
        "revealed",
        { timeout: 7000 },
      );
      await page.waitForTimeout(2200);
      await context.close();
      const raw = path.join(output, `${tier.toLowerCase()}-raw.webm`);
      await page.video()!.saveAs(raw);
      execFileSync(
        path.join(
          process.env.LOCALAPPDATA!,
          "ms-playwright/ffmpeg-1011/ffmpeg-win64.exe",
        ),
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          String(startOffset),
          "-i",
          raw,
          "-c:v",
          "libvpx",
          "-b:v",
          "1800k",
          "-deadline",
          "realtime",
          "-cpu-used",
          "4",
          "-an",
          path.join(output, `${tier.toLowerCase()}-afl-full.webm`),
        ],
      );
      for (const version of ["v1", "v2"]) {
        const study = await browser.newContext({
          viewport: { width: 412, height: 850 },
          deviceScaleFactor: 1,
          reducedMotion: "no-preference",
        });
        const p = await study.newPage();
        await p.goto("http://127.0.0.1:3137/preview/pack-opening");
        await p
          .getByRole("button", {
            name: version === "v2" ? "V2 " + tier : "Preview " + tier,
            exact: true,
          })
          .click();
        await p.getByRole("button", { name: "Open pack", exact: true }).click();
        await p
          .getByRole("button", { name: "Reveal card", exact: true })
          .click();
        const scene = p.locator("[data-pack-reveal-phase]");
        await p.waitForTimeout(1200);
        await p.screenshot({
          path: path.join(
            output,
            `${version}-${tier.toLowerCase()}-rarity.png`,
          ),
        });
        await expect(scene).toHaveAttribute(
          "data-pack-reveal-phase",
          "flipping",
        );
        const duration =
          version === "v2"
            ? tier === "Icon"
              ? 1000
              : 900
            : tier === "Icon"
              ? 680
              : 620;
        const shell = p.locator(
          version === "v2" ? ".cinema-v2-shell" : ".pack-reveal-object",
        );
        await shell.evaluate((el, ms) => {
          const animation = el.getAnimations()[0];
          animation.pause();
          animation.currentTime = ms * 0.52;
        }, duration);
        await p.waitForTimeout(version === "v2" ? 350 : 150);
        await p.screenshot({
          path: path.join(output, `${version}-${tier.toLowerCase()}-flip.png`),
        });
        // Restore normal timeline; the recorded playback above was never paused.
        await shell.evaluate((el) => el.getAnimations()[0]?.play());
        await expect(scene).toHaveAttribute(
          "data-pack-reveal-phase",
          "revealed",
        );
        await p.waitForTimeout(230);
        await p.screenshot({
          path: path.join(
            output,
            `${version}-${tier.toLowerCase()}-player.png`,
          ),
        });
        results.push({
          tier,
          version,
          flipStudy:
            "Actual DOM animation held at 52% for a still; video is unmodified playback",
          horizontalOverflow: await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
        });
        await study.close();
      }
    }
    // Layout evidence on short Samsung-sized and desktop viewports.
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 360, height: 640 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 1366, height: 900 },
    ]) {
      const c = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const p = await c.newPage();
      await p.goto("http://127.0.0.1:3137/preview/pack-opening");
      await p.getByRole("button", { name: "V2 Icon", exact: true }).click();
      await p.getByRole("button", { name: "Open pack", exact: true }).click();
      await p.getByRole("button", { name: "Reveal card", exact: true }).click();
      await expect(p.locator(".cinema-v2")).toHaveAttribute(
        "data-pack-reveal-phase",
        "flipping",
        { timeout: 7000 },
      );
      const turn = p.locator(".cinema-v2-shell");
      await turn.evaluate((el) => {
        const animation = el.getAnimations()[0];
        animation.pause();
        animation.currentTime = 520;
      });
      const bounds = await p.locator(".cinema-v2").evaluate((el) => {
        const scene = el.getBoundingClientRect();
        const face = el
          .querySelector(".cinema-v2-front")!
          .getBoundingClientRect();
        return {
          stageTop: scene.top,
          stageBottom: scene.bottom,
          cardTop: face.top,
          cardBottom: face.bottom,
        };
      });
      if (
        bounds.cardTop < bounds.stageTop ||
        bounds.cardBottom > bounds.stageBottom
      )
        throw Error(
          "Flip exceeds stage at " +
            viewport.width +
            ": " +
            JSON.stringify(bounds),
        );
      await p.screenshot({
        path: path.join(output, `layout-flip-${viewport.width}.png`),
      });
      await turn.evaluate((el) => el.getAnimations()[0]?.play());
      await expect(p.locator(".cinema-v2")).toHaveAttribute(
        "data-pack-reveal-phase",
        "revealed",
        { timeout: 7000 },
      );
      await expect(
        p.getByRole("button", { name: "View pack summary" }),
      ).toBeInViewport();
      await p.waitForTimeout(1200);
      await p.screenshot({
        path: path.join(output, `layout-${viewport.width}.png`),
      });
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      results.push({
        viewport,
        horizontalOverflow: overflow,
        flipBounds: bounds,
      });
      if (overflow) throw Error("Horizontal overflow at " + viewport.width);
      await c.close();
    }
    await writeFile(
      path.join(output, "capture-results.json"),
      JSON.stringify(results, null, 2),
    );
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
  }
}
void main();
