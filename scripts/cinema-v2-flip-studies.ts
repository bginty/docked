import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const output = process.env.DOCKED_VISUAL_EVIDENCE;
  if (!output) throw Error("Set DOCKED_VISUAL_EVIDENCE.");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const studies: unknown[] = [];
  try {
    for (const tier of ["Legendary", "Icon"])
      for (const version of ["v1", "v2"]) {
        const context = await browser.newContext({
          viewport: { width: 412, height: 850 },
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto("http://127.0.0.1:3137/preview/pack-opening");
        // Keyboard activation avoids the development-only Next toolbar covering
        // the last comparison button at the bottom of a short preview page.
        await page
          .getByRole("button", {
            name: version === "v2" ? "V2 " + tier : "Preview " + tier,
            exact: true,
          })
          .press("Enter");
        await page
          .getByRole("button", { name: "Open pack", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Reveal card", exact: true })
          .click();
        await expect(page.locator("[data-pack-reveal-phase]")).toHaveAttribute(
          "data-pack-reveal-phase",
          "flipping",
        );
        const pose = await page
          .locator(
            version === "v2" ? ".cinema-v2-shell" : ".pack-reveal-object",
          )
          .evaluate((el) => {
            const animation = el.getAnimations()[0];
            animation.pause();
            let low = 0,
              high = Number(animation.effect!.getTiming().duration),
              angle = 0;
            for (let i = 0; i < 15; i++) {
              animation.currentTime = (low + high) / 2;
              const matrix = new DOMMatrix(getComputedStyle(el).transform);
              angle = Math.abs(
                (Math.atan2(matrix.m13, matrix.m11) * 180) / Math.PI,
              );
              if (angle < 72) low = Number(animation.currentTime);
              else high = Number(animation.currentTime);
            }
            return { angle, timeMs: animation.currentTime };
          });
        await page.waitForTimeout(version === "v2" ? 300 : 120);
        await page.screenshot({
          path: path.join(output, `${version}-${tier.toLowerCase()}-flip.png`),
        });
        studies.push({ tier, version, ...pose });
        await context.close();
      }
    const file = path.join(output, "capture-results.json");
    const original = JSON.parse(await readFile(file, "utf8")) as Array<{
      flipStudy?: string;
    }>;
    for (const row of original)
      if (row.flipStudy)
        row.flipStudy =
          "Actual DOM animation held near 72 degrees for matching turn angles; full videos are uninterrupted";
    await writeFile(file, JSON.stringify(original, null, 2));
    await writeFile(
      path.join(output, "flip-studies.json"),
      JSON.stringify(studies, null, 2),
    );
    console.log(JSON.stringify(studies));
  } finally {
    await browser.close();
  }
}
void main();
