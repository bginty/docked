/** Public policy rendering only; no account, storage or payment mutation. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
const out = "docs/qa/final-australia-20261102";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const path of [
    "privacy",
    "refund-policy",
    "retention",
    "commercial-policy",
  ]) {
    const response = await page.goto("https://docked.com.au/" + path, {
      waitUntil: "networkidle",
    });
    assert.equal(response.status(), 200);
    assert(
      (await page.locator("body").innerText()).includes(
        "2026-11-02-release-preparation-v2",
      ),
    );
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert(geometry.scrollWidth <= geometry.width);
    await page.screenshot({
      path: out + "/policy-" + path + "-390.png",
      fullPage: true,
    });
    checks.push({
      path,
      status: 200,
      version: "2026-11-02-release-preparation-v2",
      ...geometry,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("https://docked.com.au/privacy", {
    waitUntil: "networkidle",
  });
  await page.screenshot({
    path: out + "/policy-privacy-1440.png",
    fullPage: true,
  });
  await fs.writeFile(
    out + "/policy-rendered.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        passed: true,
        authenticated: false,
        mutations: 0,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: true,
      mobilePolicies: checks.length,
      desktopPrivacy: true,
      authenticated: false,
    }),
  );
} finally {
  await browser.close();
}
