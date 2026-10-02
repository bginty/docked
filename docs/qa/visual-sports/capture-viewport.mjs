import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const output = "docs/qa/visual-sports/after";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
for (const width of [1440, 390, 430]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.locator(".hero-photo img").evaluate((image) => image.decode());
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/homepage-viewport-${width}.png` });
  console.log(`Captured homepage-viewport-${width}.png`);
  await page.close();
}
await browser.close();
