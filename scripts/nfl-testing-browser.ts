import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const out = "docs/qa/nfl-testing";
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/nfl-testing-panel.tsx",
  );
  const css = [
    "brand-theme",
    "globals",
    "fantasy",
    "owner-command",
    "nfl-testing",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const real = JSON.parse(readFileSync(out + "/report.json", "utf8"));
  let mode = "real";
  const server = createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(script);
    } else if (req.url === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
    } else if (req.url === "/report.json") {
      const report = structuredClone(real);
      if (mode === "empty") {
        report.players = [];
        report.health = "Awaiting initial import";
      }
      if (mode === "stale") {
        report.health = "Sync failed · retained data";
        for (const p of report.players) {
          for (const s of p.seasons) {
            s.points = null;
            s.included = 0;
            s.complete = false;
            for (const w of s.weeks) {
              w.points = null;
              w.included = 0;
            }
          }
          for (const r of p.history) {
            r.retainedPoints = r.points;
            r.points = null;
            r.status = "Incomplete stats";
            r.stale = true;
          }
        }
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(report));
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><title>NFL feed local acceptance</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const checks = [];
  try {
    for (const width of [1440, 1024, 412, 360]) {
      const context = await browser.newContext({
        viewport: { width, height: width > 700 ? 1000 : 915 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(origin);
      await expect(
        page.getByRole("heading", { name: "NFL postgame feed" }),
      ).toBeVisible();
      const sample = real.players.find((p: any) => p.name === "Carson Wentz");
      await page.getByLabel("Player", { exact: true }).selectOption(sample.id);
      await expect(
        page.getByRole("cell", { name: "6.32", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("25.54", { exact: true })).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "horizontal overflow",
      );
      const axe = (
        await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
      ).violations;
      writeFileSync(`${out}/axe-${width}.json`, JSON.stringify(axe, null, 2));
      await page.screenshot({
        path: `${out}/postgame-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(
        axe.map((v) => v.id),
        [],
      );
      await page.screenshot({
        path: `${out}/postgame-${width}.png`,
        fullPage: true,
      });
      checks.push({ width, axe: 0, realPlayerScore: 6.32, seasonTotal: 25.54 });
      const longest = real.players.reduce((a: any, b: any) =>
        a.history.length >= b.history.length ? a : b,
      );
      await page.getByLabel("Player", { exact: true }).selectOption(longest.id);
      await page
        .getByRole("group", { name: /Weekly base score trend/ })
        .focus();
      await expect(
        page.getByRole("group", { name: /Weekly base score trend/ }),
      ).toBeFocused();
      assert.deepEqual(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze()
        ).violations.map((v) => v.id),
        [],
      );
      await context.close();
    }
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
    });
    mode = "empty";
    const page = await context.newPage();
    await page.goto(origin);
    await expect(
      page.getByText(/Awaiting reviewed player mappings/),
    ).toBeVisible();
    await page.screenshot({ path: `${out}/awaiting-412.png`, fullPage: true });
    mode = "stale";
    await page.goto(origin);
    await expect(page.getByText("Sync failed · retained data")).toBeVisible();
    await expect(page.getByText(/Last known:/).first()).toBeVisible();
    await page.screenshot({ path: `${out}/stale-412.png`, fullPage: true });
    writeFileSync(
      `${out}/browser.json`,
      JSON.stringify(
        {
          checks,
          emptyAndStale: true,
          scope:
            "Actual component, real imported baseline; isolated empty/stale UI variants; not hosted auth or physical Samsung",
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: real postgame report at four viewports, keyboard-selectable filters, empty/stale states and accessibility",
    );
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
