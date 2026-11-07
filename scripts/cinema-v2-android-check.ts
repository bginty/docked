import { _android, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const output = process.env.DOCKED_VISUAL_EVIDENCE;
  if (!output) throw Error("Set DOCKED_VISUAL_EVIDENCE.");
  await mkdir(output, { recursive: true });
  // Only the disposable read-only AVD; never select a personal phone implicitly.
  const device = (await _android.devices()).find(
    (d) => d.serial() === "emulator-5556",
  );
  if (!device) throw Error("Isolated Android AVD is unavailable.");
  const context = await device.launchBrowser();
  const page = await context.newPage();
  await page.addInitScript("window.__name = value => value;");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const results: unknown[] = [];
  try {
    for (const tier of ["Legendary", "Icon"]) {
      await page.goto("http://127.0.0.1:3137/preview/pack-opening");
      await page
        .getByRole("button", { name: "V2 " + tier, exact: true })
        .click();
      await page
        .getByRole("button", { name: "Open pack", exact: true })
        .click();
      const scene = page.locator(".cinema-v2");
      await expect(scene).toHaveAttribute("data-pack-reveal-phase", "mystery");
      await page
        .getByRole("button", { name: "Reveal card", exact: true })
        .click();
      await expect(scene).toHaveAttribute("data-pack-reveal-phase", "rarity");
      await page.waitForTimeout(700);
      await page.screenshot({
        path: path.join(output, tier.toLowerCase() + "-android-rarity.png"),
      });
      await expect(scene).toHaveAttribute(
        "data-pack-reveal-phase",
        "revealed",
        { timeout: 15000 },
      );
      await expect(
        page.getByRole("button", { name: "Share My Pull", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(output, tier.toLowerCase() + "-android-player.png"),
      });
      results.push(
        await scene.evaluate((el) => ({
          tier: (el as HTMLElement).dataset.tier,
          quality: (el as HTMLElement).dataset.vfxQuality,
          renderMs: (el as HTMLElement).dataset.vfxRenderMs,
          userAgent: navigator.userAgent,
          width: innerWidth,
          height: innerHeight,
          devicePixelRatio,
          overflow: document.documentElement.scrollWidth > innerWidth,
          player: el
            .querySelector("[data-player-name]")
            ?.getAttribute("data-player-name"),
        })),
      );
      await page.getByRole("button", { name: "View pack summary" }).click();
      await expect(page.locator(".pack-summary > li")).toHaveCount(1);
      await page.getByRole("button", { name: "Close panel" }).click();
    }
    await writeFile(
      path.join(output, "android-results.json"),
      JSON.stringify(
        {
          device: device.model(),
          serial: device.serial(),
          environment:
            "Disposable Android 16 API36 AVD, software GPU; not physical Samsung",
          results,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ results, errors }));
  } finally {
    await context.close();
    await device.close();
  }
}
void main();
