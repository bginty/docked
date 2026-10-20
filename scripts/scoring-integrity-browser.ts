import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
async function main() {
  const out =
    "docs/qa/scoring-integrity/" +
    (process.argv.includes("--before") ? "before" : "after");
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/play-standings-visual.tsx",
  );
  const css = [
    "brand-theme",
    "globals",
    "sports-visuals",
    "sports-experience",
    "community-app",
    "native",
    "mobile-app",
    "app-auth",
    "beta-experience",
    "fantasy",
    "fantasy-play",
    "pack-opening",
    "scoring",
    "test-wallet",
    "marketplace",
    "mobile-cleanup",
    "play-cards",
    "social-hub",
    "collectible",
    "card-viewer",
    "standings",
    "pack-shop",
    "player-statistics",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  const server = createServer((req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname;
    res.setHeader("Cache-Control", "no-store");
    if (path === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (path === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (path === "/local-identity") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ member: "visual-member" }));
    }
    if (path.startsWith("/brand/") || path.startsWith("/images/")) {
      const file = resolve("public", "." + path);
      assert.ok(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          path.endsWith("svg")
            ? "image/svg+xml"
            : path.endsWith("webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    if (path.startsWith("/api/")) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      return res.end('{"error":"Local visual fixture only"}');
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked LOCAL Play & Standings</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><p style="margin:0;padding:4px 12px;font-size:11px">LOCAL FIXTURE · illustrative teams and scores · no real accounts</p><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
    );
  });
  await new Promise<void>((r) =>
    server.listen(process.argv.includes("--serve") ? 3025 : 0, "127.0.0.1", r),
  );
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  if (process.argv.includes("--serve")) {
    console.log(origin + "/fantasy/play?scenario=entered");
    return;
  }

  const browser = await chromium.launch({ channel: "msedge" });
  const evidence = [];
  try {
    for (const width of [412, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: 915 },
        isMobile: width === 412,
        deviceScaleFactor: 1,
      });
      await page.goto(
        origin +
          "/fantasy/results?mode=SALARY_CAP&period=weekly&season=2026&week=2",
      );
      await expect(
        page.getByRole("heading", { name: "Rankings", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: out + "/rankings-" + width + ".png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "View Team", exact: true })
        .first()
        .click();
      await expect(page.getByRole("dialog").locator(".seven-slot")).toHaveCount(
        7,
      );
      const slots = await page
        .locator(".community-team-field .seven-slot")
        .evaluateAll((nodes) =>
          nodes.map((el) => ({
            slot: el.getAttribute("data-slot"),
            name: el.querySelector(".collectible-name")?.textContent,
            x: el.getBoundingClientRect().x,
            y: el.getBoundingClientRect().y,
          })),
        );
      await page.screenshot({
        path: out + "/other-team-" + width + ".png",
        fullPage: false,
      });
      if (!process.argv.includes("--before")) {
        const by = Object.fromEntries(slots.map((s) => [s.slot, s]));
        assert.ok(
          by.QB1.y < by.RB1.y &&
            by.RB1.y === by.RB2.y &&
            by.WR1.y === by.WR2.y &&
            by.TE1.y === by.FLEX1.y,
        );
        assert.ok(
          by.RB1.y < by.WR1.y && by.WR1.y < by.TE1.y && by.TE1.x < by.FLEX1.x,
        );
      }
      evidence.push({ width, slots });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Find My Team" }).click();
      await page
        .locator(".current-member")
        .getByRole("button", { name: "View Team" })
        .click();
      await page.screenshot({
        path: out + "/own-rankings-" + width + ".png",
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      if (!process.argv.includes("--before")) {
        await page.clock.install();
        await page.goto(
          origin + "/fantasy/results?mode=SALARY_CAP&season=2026&week=3",
        );
        await expect(
          page.getByRole("combobox", { name: "Week", exact: true }),
        ).toHaveValue("fixture-SALARY_CAP-3");
        await page.evaluate(() => {
          Object.assign(window, { gameDayTest: { points: 54321 } });
          window.dispatchEvent(new Event("focus"));
        });
        await page.clock.runFor(30001);
        await expect(
          page.getByRole("region", { name: "Game day summary" }),
        ).toContainText("543.21");
        await page.getByRole("button", { name: "Find My Team" }).click();
        await expect(page.locator(".current-member")).toContainText("543.21");
        await page.evaluate(() => {
          Object.assign(window, { gameDayTest: { fail: true } });
          window.dispatchEvent(new Event("focus"));
        });
        await page.clock.runFor(30001);
        await expect(
          page.getByText(
            "Scores could not refresh. Your last result is still shown.",
          ),
        ).toBeVisible();
        await expect(page.locator(".current-member")).toContainText("543.21");
        await page.clock.resume();
      }
      await page.goto(origin + "/fantasy/play?scenario=gameday");
      await expect(page.locator(".seven-slot")).toHaveCount(7);
      await page.screenshot({
        path: out + "/play-" + width + ".png",
        fullPage: true,
      });
      if (!process.argv.includes("--before")) {
        const query =
          "?scenario=gameday&integrity=1&competition=visual-round-0&mode=SALARY_CAP&season=2026&week=7";
        await page.goto(origin + "/fantasy/play" + query);
        await expect(
          page.locator('.seven-slot[data-slot="FLEX1"]'),
        ).toContainText("19.46");
        const mapping = async () =>
          page.locator(".seven-slot").evaluateAll((nodes) =>
            nodes
              .map((el) => ({
                slot: el.getAttribute("data-slot"),
                card: el
                  .querySelector("[data-card-id]")
                  ?.getAttribute("data-card-id"),
                score: el.querySelector(".game-day-player-score")?.textContent,
              }))
              .sort((a, b) => a.slot!.localeCompare(b.slot!)),
          );
        const play = await mapping();
        await page.screenshot({
          path: out + "/same-lineup-play-" + width + ".png",
          fullPage: true,
        });
        await page.goto(origin + "/fantasy/results" + query);
        await expect(page.locator(".current-member")).toContainText(
          "Local Test Team",
        );
        await page
          .locator(".current-member")
          .getByRole("button", { name: "View Team" })
          .click();
        await expect(
          page.getByRole("dialog").locator(".seven-slot"),
        ).toHaveCount(7);
        const rankings = await mapping();
        assert.deepEqual(rankings, play);
        await page.screenshot({
          path: out + "/same-lineup-rankings-top-" + width + ".png",
        });
        await page
          .locator('.seven-slot[data-slot="FLEX1"]')
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: out + "/same-lineup-rankings-flex-" + width + ".png",
        });
        evidence.push({ width, parity: { play, rankings } });
        await page.keyboard.press("Escape");
        await page
          .getByRole("row")
          .filter({ hasText: "Comparison fixture" })
          .getByRole("button", { name: "View Team" })
          .click();
        assert.deepEqual(await mapping(), play);
        await page.keyboard.press("Escape");
        await page.goto(origin + "/fantasy/game-log?integrity=1");
        await expect(
          page.locator(".statistics-fpts").filter({ hasText: "14.90" }),
        ).toBeVisible();
        await page.screenshot({
          path: out + "/kamara-game-log-" + width + ".png",
          fullPage: true,
        });
      }
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
  writeFileSync(out + "/geometry.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ out, viewports: 2, passed: true }));
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
