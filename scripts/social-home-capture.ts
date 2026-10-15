import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { request, chromium, expect } from "@playwright/test";
async function main() {
  const origin = "http://127.0.0.1:3033",
    root = "docs/qa/social-visual-preview";
  const qa = JSON.parse(
    await readFile("tmp/marketplace-auth/fixtures.private.json", "utf8"),
  );
  const client = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const r = await client.post("/api/auth", {
    data: {
      action: "login",
      email: qa.users[1].email,
      password: qa.password,
      app: true,
    },
  });
  assert.equal(r.status(), 200);
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const context = await browser.newContext({
      storageState: await client.storageState(),
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    for (const [width, height] of [
      [1440, 960],
      [412, 815],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(origin + "/fantasy/social", {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator('[data-composer-ready="true"]')).toBeVisible({
        timeout: 30000,
      });
      await expect(
        page.getByRole("button", { name: "Cancel", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("textbox", { name: "Your post" })
        .fill("Local unsent draft");
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(
        page.getByRole("textbox", { name: "Your post" }),
      ).toHaveValue("");
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLImageElement>(".member-photo img")]
          .filter((i) => {
            const b = i.getBoundingClientRect();
            return b.top < innerHeight && b.bottom > 0;
          })
          .every((i) => i.complete && i.naturalWidth > 0),
      );
      await page.evaluate(() => scrollTo(0, 0));
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({ path: `${root}/social-${width}.png` });
      await page
        .locator(".social-shared-cards")
        .first()
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${root}/social-cards-${width}.png` });
    }
    await writeFile(
      root + "/final-home.json",
      JSON.stringify(
        {
          passed: true,
          at: new Date().toISOString(),
          checks: [
            "Final desktop/mobile compact composer, empty/draft/cancel states, persisted avatar pixels and card snapshots",
            "No horizontal page overflow; synthetic local account only; no post submitted",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    await client.dispose();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Local capture failed");
  process.exitCode = 1;
});
