import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, type Browser } from "@playwright/test";
import type { CreditsState } from "../src/core/credits-sandbox";
import { wallet } from "../src/core/credits-sandbox";
import { marketActors } from "../tests/fixtures/marketplace-state";
/** Actual components/domain engine; synthetic local transport, NOT auth/database E2E. */
export async function verifyPackFlow(
  browser: Browser,
  origin: string,
  read: () => CreditsState,
  drop: () => void,
) {
  const root = process.argv.includes("--master-v2") ? "docs/qa/master-v2" : "docs/qa/social-upgrade";
  await mkdir(root, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 815 },
    reducedMotion: "no-preference",
    recordVideo: {
      dir: root + "/recording",
      size: { width: 412, height: 815 },
    },
  });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(origin + "/fantasy/test-wallet?view=packs");
    const buy = page.getByRole("button", { name: /Buy Standard/ });
    await expect(buy).toBeEnabled();
    const before = structuredClone(read()),
      member = marketActors[0].id;
    drop();
    await buy.click();
    await expect(
      page.getByRole("button", { name: "Retry pending transaction" }),
    ).toBeVisible();
    const issued = Object.keys(read().entitlements).filter(
      (id) => !before.entitlements[id],
    );
    assert.equal(issued.length, 1);
    const issuedSnapshot = structuredClone(read().economy!.packs[issued[0]]);
    const balance = wallet(read(), member).spendable;
    await page.reload();
    await page
      .getByRole("button", { name: "Retry pending transaction" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator('[data-reveal-index="0"]')).toBeVisible();
    const openingEvents = () =>
      read().events.filter(
        (e) =>
          e.kind === "open-pack" &&
          JSON.stringify(e.command).includes(issued[0]),
      );
    assert.equal(
      openingEvents().length,
      1,
      "Automatic opening uses issued entitlement exactly once",
    );
    assert.equal(wallet(read(), member).spendable, balance);
    assert.deepEqual(
      read().economy!.packs[issued[0]].draws,
      issuedSnapshot.draws,
    );
    for (let i = 0; i < 9; i++) {
      const stage = page.locator(`[data-reveal-index="${i}"]`);
      await expect(stage).toBeVisible();
      await expect(page.locator(".pack-stage-revealed")).toBeVisible({
        timeout: 10000,
      });
      const next = page.getByRole("button", {
        name: i === 8 ? "View pack summary" : "Reveal next card",
      });
      assert.ok(await next.isEnabled());
      const box = await page.locator(".pack-next").boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= 815);
      if (i === 1)
        await page.screenshot({ path: root + "/automatic-reveal-mobile.png" });
      await next.click();
    }
    await expect(
      page.getByText("9 confirmed cards", { exact: false }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByText(/^Purchase history ·/).click();
    await page
      .getByRole("button", { name: "Replay saved pack" })
      .last()
      .click();
    await page.getByRole("button", { name: "Skip remaining reveals" }).click();
    await expect(page.locator(".pack-summary li")).toHaveCount(9);
    assert.equal(
      openingEvents().length,
      1,
      "Replay and Skip do not mutate issuance",
    );
    assert.equal(
      Object.keys(read().entitlements).length,
      Object.keys(before.entitlements).length + 1,
    );
    assert.equal(wallet(read(), member).spendable, balance);
    assert.deepEqual(errors, []);
    const report = {
      passed: true,
      scope:
        "Local actual React components and domain engine; synthetic cookie identity/in-memory HTTP, not authenticated database E2E",
      checks: [
        "Lost purchase response and full-page reload recover same operation and issued entitlement",
        "Purchase recovery automatically opens the actual nine-card result; one charge and one opening",
        "All nine consecutive card stages settle; next controls within mobile viewport",
        "Replay and Skip reuse retained cards without issuance or charge",
      ],
      physicalS24: false,
    };
    await writeFile(root + "/pack-flow.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await context.close();
  }
}
