import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { testReceipt } from "../src/core/member-test-wallet";
async function main() {
  const out = "docs/qa/nfl-roster-audit";
  const state = JSON.parse(
    readFileSync(
      "private-data/nfl-roster-audit/verified-local-state.json",
      "utf8",
    ),
  );
  const pack = JSON.parse(readFileSync(out + "/cleanup-result.json", "utf8"))
    .affectedPacks[0].id;
  const receipt = testReceipt(state, pack, state.economy.packs[pack].member);
  assert.equal(receipt.cards.length, 7);
  assert.ok(receipt.notice);
  const js = await bundleCommunityFixture(
    "tests/fixtures/nfl-roster-replay.tsx",
  );
  const css = [
    "brand-theme",
    "globals",
    "fantasy",
    "fantasy-play",
    "pack-opening",
    "collectible",
    "pack-shop",
    "mobile-cleanup",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const server = createServer((req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname;
    if (path === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(js);
    }
    if (path === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (path === "/receipt.json") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(receipt));
    }
    const asset = resolve("public", "." + decodeURIComponent(path));
    if (asset.startsWith(resolve("public") + sep)) {
      try {
        res.setHeader(
          "Content-Type",
          path.endsWith(".svg") ? "image/svg+xml" : "image/png",
        );
        return res.end(readFileSync(asset));
      } catch {}
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local test cleanup</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const checks = [];
  try {
    for (const width of [1440, 1024, 412, 360]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      await page.goto(`http://127.0.0.1:${(server.address() as any).port}`);
      await expect(page.getByText(receipt.notice!)).toBeVisible();
      await page.screenshot({
        path: `${out}/replay-${width}.png`,
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.getByRole("button", { name: "Skip remaining reveals" }).click();
      await expect(
        page.getByText("7 confirmed cards", { exact: false }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");
      checks.push({
        width,
        noticeVisible: true,
        cards: receipt.cards.length,
        overflow: false,
        revealRetainedOnly: true,
        escapeCloses: true,
        bodyLockReleased: true,
        scope:
          "local component with real cleaned saved receipt; no hosted authentication",
      });
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
  writeFileSync(`${out}/browser.json`, JSON.stringify(checks, null, 2));
  console.log(checks);
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
