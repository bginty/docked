import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
const old = execFileSync(
  "git",
  ["show", "1cabfc48:src/components/use-workspace-wallet.ts"],
  { encoding: "utf8" },
);
const results = [];
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const before of [true, false]) {
    const page = await browser.newPage();
    let calls = 0;
    let balance = 100;
    let entered = () => {};
    let release = () => {};
    let delayed = false;
    const script = await bundleCommunityFixture(
      "tests/fixtures/wallet-refresh.tsx",
      before
        ? { [path.resolve("src/components/use-workspace-wallet.ts")]: old }
        : {},
    );
    await page.route("https://fixture.invalid/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/api/test-wallet") {
        calls++;
        const snapshot = balance;
        if (delayed) {
          delayed = false;
          entered();
          await new Promise<void>((r) => (release = r));
        }
        await new Promise((r) => setTimeout(r, 100));
        await route
          .fulfill({
            json: {
              state: {
                member: "fixture-member",
                wallet: { spendable: snapshot },
                packs: [],
                swaps: [],
              },
            },
          })
          .catch(() => {});
      } else
        await route.fulfill({
          contentType: "text/html",
          body: '<main id="fixture-root"></main>',
        });
    });
    await page.goto("https://fixture.invalid/");
    await page.addScriptTag({ content: script });
    await page.waitForFunction(
      () => document.querySelector("output")?.textContent?.trim() === "100",
    );
    const initial = calls;
    balance = 200;
    await page.getByRole("button", { name: "Resume burst" }).click();
    await page.waitForFunction(
      () => document.querySelector("output")?.textContent?.trim() === "200",
    );
    const burst = calls - initial;
    assert.equal(initial, 1);
    assert.equal(burst, before ? 3 : 1);
    if (!before) {
      delayed = true;
      balance = 250;
      const started = new Promise<void>((r) => (entered = r));
      await page.getByRole("button", { name: "Resume burst" }).click();
      await started;
      balance = 300;
      await page.getByRole("button", { name: "Resume burst" }).click();
      release();
      await page.waitForFunction(
        () => document.querySelector("output")?.textContent?.trim() === "300",
      );
      assert.equal(calls - initial - burst, 2);
    }
    results.push({
      version: before ? "baseline-1cabfc48" : "candidate",
      initialRequestsForTwoConsumers: initial,
      requestsForThreeResumeSignals: burst,
      postInvalidationFreshRead: !before ? "passed" : "not changed",
    });
    await page.close();
  }
} finally {
  await browser.close();
}
await fs.mkdir("docs/qa/ux-refinement-20261108", { recursive: true });
await fs.writeFile(
  "docs/qa/ux-refinement-20261108/wallet-performance.json",
  JSON.stringify(
    {
      scope:
        "Isolated real React wallet hook, deterministic100ms mocked reads; request counts, not Production latency",
      results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(results));
