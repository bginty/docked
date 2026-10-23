// Actual hosted signed-out checks. No manufactured member session.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
const out =
  process.env.DOCKED_HOSTED_BROWSER_EVIDENCE ?? "docs/qa/global-sport/release";
assert(out.startsWith("docs/qa/") && !out.includes(".."));
const release = JSON.parse(
  await fs.readFile(out + "/deployment-promoted.json", "utf8"),
);
console.log("Checking live release identity");
const identity = await (
  await fetch("https://docked.com.au/api/beta-release", {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  })
).json();
assert.equal(identity.commit, release.commit);
assert.equal(identity.publicRegistration, false);
console.log("Launching isolated signed-out browser");
const browser = await chromium.launch({ channel: "msedge", timeout: 45000 }),
  checks = [];
try {
  for (const width of [412, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 915 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const path of [
      "/fantasy/play?sport=nfl",
      ...(out === "docs/qa/play-owned/release"
        ? [
            "/fantasy/play?sport=basketball",
            "/fantasy/play?sport=afl",
            "/fantasy/play?sport=nrl",
          ]
        : []),
      "/fantasy/cards?sport=basketball",
      "/fantasy/market?sport=afl",
      "/fantasy/social?sport=nrl",
      "/fantasy/history?sport=afl",
      "/fantasy/history?sport=nrl",
    ]) {
      console.log(JSON.stringify({ checking: path, width }));
      const start = performance.now();
      await page.goto("https://docked.com.au" + path, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await expect(
        page
          .getByRole("link", { name: "Sign in", exact: true })
          .or(page.getByRole("button", { name: "Sign in", exact: true }))
          .first(),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        page.locator(".historical-match,.social-timeline,.owned-grid"),
      ).toHaveCount(0);
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
        path,
        width,
        signedOutRecoveryMs: Math.round(performance.now() - start),
        privateContentVisible: false,
      });
    }
    await page.screenshot({ path: `${out}/signed-out-${width}.png` });
    assert.deepEqual(errors, []);
    await page.close();
  }
  await fs.writeFile(
    out + "/hosted-browser.json",
    JSON.stringify(
      {
        passed: true,
        commit: release.commit,
        at: new Date().toISOString(),
        authenticatedMemberTesting: false,
        scope:
          "Actual Production signed-out access recovery; not authenticated feed/gameplay performance",
        checks,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks: checks.length }));
} finally {
  await browser.close();
}
