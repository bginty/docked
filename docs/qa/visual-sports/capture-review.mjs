// Final-build viewport evidence only; no injected styles or application data.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const output = "docs/qa/visual-sports/after";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const routes = {
  football: "/sports/football",
  basketball: "/sports/basketball",
  tennis: "/sports/tennis",
  edges: "/edges",
  results: "/results",
  article: "/learn/minimum-odds",
};
for (const width of [390, 1366]) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
  });
  const page = await context.newPage();
  for (const [name, route] of Object.entries(routes)) {
    await page.goto("http://localhost:3000" + route, {
      waitUntil: "networkidle",
    });
    for (const photo of await page.locator(".sport-image img").all()) {
      await photo.scrollIntoViewIfNeeded();
      await photo.evaluate((image) => image.decode());
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `${output}/review-${name}-${width}.png` });
    if (name === "football" && width === 390) {
      await page.locator(".sport-information-layout").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${output}/review-football-body-${width}.png`,
      });
    }
    if (name === "edges") {
      await page.locator(".no-edge-visual").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/review-no-edge-${width}.png` });
    }
  }
  await context.close();
}
await writeFile(
  `${output}/review-manifest.json`,
  JSON.stringify(
    {
      buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
      capturedAt: new Date().toISOString(),
      widths: [390, 1366],
      routes,
      note: "Final application viewport screenshots, with decoded images and no style or data injection.",
    },
    null,
    2,
  ) + "\n",
);
await browser.close();
console.log("Final review screenshots captured");
