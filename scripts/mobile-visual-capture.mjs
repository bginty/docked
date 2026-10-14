import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const phase = process.argv.includes("--before") ? "before" : "after";
mkdirSync("docs/qa/mobile-cleanup", { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 412, height: 815 },
});
await context.route("**/*", (r) =>
  new URL(r.request().url()).hostname === "127.0.0.1"
    ? r.continue()
    : r.abort(),
);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("Page error:", e.message));
for (const width of [412, 1440]) {
  await page.setViewportSize({ width, height: 815 });
  for (const tab of ["play", "cards", "social", "market"]) {
    await page.goto("http://127.0.0.1:3023/fantasy/" + tab);
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `docs/qa/mobile-cleanup/${phase}-${tab}-${width}.png`,
    });
  }
}
await browser.close();
