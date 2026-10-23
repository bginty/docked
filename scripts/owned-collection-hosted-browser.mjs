// Signed-out hosted acceptance only. Never manufactures a member session.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
const out = "docs/qa/owned-collection/release";
const release = JSON.parse(
  await fs.readFile(`${out}/deployment-promoted.json`, "utf8"),
);
const identity = await (
  await fetch("https://docked.com.au/api/beta-release", { cache: "no-store" })
).json();
assert.equal(identity.commit, release.commit);
assert.equal(identity.publicRegistration, false);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const checks = [];
try {
  for (const width of [412, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 915 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const sport of ["nfl", "basketball", "afl", "nrl"]) {
      for (const tab of ["cards", "packs"]) {
        const start = performance.now();
        const response = await page.goto(
          `https://docked.com.au/fantasy/${tab}?sport=${sport}`,
          { waitUntil: "domcontentloaded" },
        );
        assert.equal(response.status(), 200);
        await expect(
          page.getByRole("link", { name: "Sign in", exact: true }),
        ).toBeVisible({ timeout: 20000 });
        await expect(page.locator(".owned-grid,.pack-shop")).toHaveCount(0);
        await expect(
          page.getByRole("region", { name: "Loading Docked", exact: true }),
        ).toHaveCount(0);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
        );
        checks.push({
          sport,
          tab,
          width,
          signedOutRecoveryMs: Math.round(performance.now() - start),
          privateInventoryVisible: false,
        });
      }
    }
    await page.screenshot({ path: `${out}/signed-out-${width}.png` });
    assert.deepEqual(errors, []);
    await page.close();
  }
  const report = {
    passed: true,
    at: new Date().toISOString(),
    commit: release.commit,
    scope:
      "Actual Production, signed out. These times measure access recovery, not authenticated collection loading.",
    authenticatedMemberTesting: false,
    checks,
  };
  await fs.writeFile(
    `${out}/hosted-browser.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks: checks.length }));
} finally {
  await browser.close();
}
