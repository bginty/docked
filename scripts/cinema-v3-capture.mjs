import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const output = process.env.DOCKED_VISUAL_EVIDENCE;
if (!output) throw Error("Set DOCKED_VISUAL_EVIDENCE");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const tier of [
    "Core",
    "Rare",
    "Elite",
    "Ultra Rare",
    "Legendary",
    "Icon",
  ]) {
    const context = await browser.newContext({
      viewport: { width: 412, height: 850 },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:3139/preview/pack-opening");
    await page.getByRole("button", { name: "V3 " + tier, exact: true }).click();
    await page.getByRole("button", { name: "Open pack", exact: true }).click();
    const scene = page.locator(".cinema-v2");
    await page
      .getByRole("button", { name: "Reveal card", exact: true })
      .click();
    await expect(scene).toHaveAttribute("data-pack-reveal-phase", "rarity");
    const charge = {
      Core: 350,
      Rare: 650,
      Elite: 1000,
      "Ultra Rare": 1500,
      Legendary: 2200,
      Icon: 2700,
    }[tier];
    await page.waitForTimeout(charge * 0.55);
    await page.screenshot({
      path: path.join(
        output,
        tier.replaceAll(" ", "-").toLowerCase() + "-announcement.png",
      ),
    });
    await expect(scene).toHaveAttribute("data-pack-reveal-phase", "revealed", {
      timeout: 8000,
    });
    await page.screenshot({
      path: path.join(
        output,
        tier.replaceAll(" ", "-").toLowerCase() + "-player.png",
      ),
    });
    results.push({
      tier,
      errors,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
    await context.close();
  }
  await writeFile(
    path.join(output, "visual-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
