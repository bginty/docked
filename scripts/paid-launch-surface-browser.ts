/** Local built app only, no credentials or customer sessions. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const origin = "http://127.0.0.1:3108",
  out = "docs/qa/paid-launch-final-20261118";
async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const checks: unknown[] = [];
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 1000 },
    ]) {
      const context = await browser.newContext({ viewport });
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const response = await page.goto(origin, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      assert(
        await page
          .getByRole("heading", {
            name: "Build your permanent card collection.",
          })
          .isVisible(),
      );
      assert(
        await page
          .getByText("Australian public registration is not open yet.")
          .isVisible(),
      );
      assert.equal(await page.locator('a[href="/app/signup"]').count(), 0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        "Horizontal mobile overflow",
      );
      assert.equal(errors.length, 0);
      await page.screenshot({
        path: `${out}/landing-${viewport.width}.png`,
        fullPage: true,
      });
      checks.push({
        viewport,
        homeStatus: response?.status(),
        noSignup: true,
        noHorizontalOverflow: true,
        clientErrors: errors,
      });
      if (viewport.width === 390) {
        for (const path of [
          "/commercial-policy",
          "/refund-policy",
          "/privacy",
          "/terms",
        ]) {
          const r = await page.goto(origin + path, {
            waitUntil: "domcontentloaded",
          });
          assert.equal(r?.status(), 200, path);
          checks.push({ path, status: r?.status() });
        }
      }
      await context.close();
    }
    writeFileSync(
      `${out}/local-browser.json`,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          passed: true,
          hosted: false,
          physicalAndroid: false,
          authenticated: false,
          productionWrites: 0,
          checks,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
