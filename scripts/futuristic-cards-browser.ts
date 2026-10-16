import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { futuristicCard } from "../tests/fixtures/futuristic-data";
import { packFixture } from "../tests/fixtures/pack-economy";
import { marketplaceView, marketQuery } from "../src/core/marketplace";
async function main() {
  const out = `docs/qa/futuristic-cards/browser-${Date.now()}`;
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/futuristic-cards.tsx",
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
    "standings",
    "pack-shop",
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
    if (path === "/api/marketplace") {
      const state = marketplaceView(
        packFixture(),
        "visual-member",
        [],
        marketQuery.parse({}),
      );
      const card = {
        ...futuristicCard,
        salary: 500000,
        salaryRules: null,
        ownerReservations: [],
        fresh: true,
        eligible: true,
        fixture: null,
        transferReason: "",
        availability: "Active",
        gameplay: "Local fixture",
      };
      const row = {
        id: "local-listing",
        card,
        own: false,
        seller: "Local collector",
        price: 1000,
        preference: "sell",
        status: "OPEN",
        version: 1,
        createdAt: Date.now(),
        cancelledAt: null,
        quote: { price: 1000, fee: 75, net: 925, policy: state.policy },
        receipt: null,
        direction: "Purchase",
      };
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          state: { ...state, rows: [row], total: 1, teams: ["ARI"] },
        }),
      );
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
    server.listen(process.argv.includes("--serve") ? 3027 : 0, "127.0.0.1", r),
  );
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  if (process.argv.includes("--serve")) {
    console.log(origin + "/fantasy/cards?futuristic=1&context=collection");
    return;
  }

  const browser = await chromium.launch({ channel: "msedge" });
  const results: unknown[] = [];
  try {
    for (const width of [1440, 1024, 412, 360]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const go = async (view: string) => {
        await page.goto(
          origin +
            "/fantasy/" +
            (view === "lineup"
              ? "play"
              : view === "collection"
                ? "cards"
                : view) +
            "?futuristic=1&context=" +
            view,
        );
      };
      const face = () =>
        page
          .locator(".collectible-face")
          .filter({
            has: page.locator(
              '.collectible-name[data-player-name="Taylor McBride"]',
            ),
          })
          .first();
      const capture = async (view: string, target = face()) => {
        await expect(target).toBeVisible();
        await target.scrollIntoViewIfNeeded();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          view + " horizontal overflow",
        );
        assert.equal(
          await target.locator("button,a,summary,details,input").count(),
          0,
          "Pristine face",
        );
        assert.equal(
          await target.locator(".jersey-number").textContent(),
          "85",
        );
        assert.equal(
          await target.locator(".collectible-city").textContent(),
          "Arizona",
        );
        const box = await target.boundingBox();
        assert.ok(
          box && Math.abs(box.width / box.height - 2 / 3) < 0.01,
          "Canonical ratio",
        );
        await target.screenshot({
          path: out + "/" + view + "-card-" + width + ".png",
        });
        if (view !== "detail" && view !== "reveal")
          await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: out + "/" + view + "-" + width + ".png",
          fullPage: view !== "detail" && view !== "reveal",
        });
      };
      await go("collection");
      await capture("collection");
      await page
        .getByRole("button", {
          name: "View Taylor McBride card details",
          exact: true,
        })
        .click();
      await capture(
        "detail",
        page.getByRole("dialog").locator(".collectible-face").first(),
      );
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      for (const view of ["market", "social", "member", "lineup"]) {
        await go(view);
        await capture(view);
      }
      await go("reveal");
      await page.getByRole("button", { name: "Replay saved result" }).click();
      await capture("reveal", page.locator(".pack-case .collectible-face"));
      await page.getByRole("button", { name: "View pack summary" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      assert.notEqual(
        await page.evaluate(() => document.body.style.overflow),
        "hidden",
      );
      await go("rarities");
      await expect(
        page.locator('[data-preview="standard"] .collectible-face'),
      ).toHaveCount(6);
      await page.screenshot({
        path: out + "/rarities-" + width + ".png",
        fullPage: true,
      });
      for (let i = 0; i < 6; i++)
        await page
          .locator('[data-preview="standard"] .collectible-face')
          .nth(i)
          .screenshot({ path: out + "/rarity-" + i + "-" + width + ".png" });
      await page.getByLabel("Long player name").check();
      const names = await page
        .locator('[data-preview="standard"] .collectible-name')
        .evaluateAll((els) =>
          els.every(
            (el) =>
              el.scrollHeight <= el.clientHeight + 1 &&
              el.scrollWidth <= el.clientWidth + 1,
          ),
        );
      assert.ok(names, "Long names fit");
      await page.screenshot({
        path: out + "/long-names-" + width + ".png",
        fullPage: true,
      });
      if (width === 1440 || width === 412) {
        await page.getByLabel("Long player name").uncheck();
        for (const palette of [
          "CHI",
          "WHITE",
          "KC",
          "BAL",
          "GB",
          "GOLD",
          "UNKNOWN",
        ]) {
          await page.getByLabel("Team palette").selectOption(palette);
          await page.locator('[data-preview="standard"]').screenshot({
            path: out + "/palette-" + palette + "-" + width + ".png",
          });
          if (palette === "UNKNOWN")
            assert.equal(
              await page
                .locator('[data-preview="standard"] .collectible-city')
                .first()
                .textContent(),
              "",
            );
        }
        await page.getByLabel("No verified number").check();
        assert.equal(
          await page
            .locator('[data-preview="standard"] .jersey-number')
            .count(),
          0,
        );
        await page.getByLabel("No verified number").uncheck();
        await page.getByLabel("Team palette").selectOption("ARI");
        const button = page
          .locator('[data-preview="standard"] .card-face')
          .first();
        await page.keyboard.press("Tab");
        await button.focus();
        assert.notEqual(
          await button.evaluate((el) => getComputedStyle(el).outlineStyle),
          "none",
        );
        await page
          .locator('[data-preview="standard"]')
          .screenshot({ path: out + "/keyboard-focus-" + width + ".png" });
      }
      const axe = await new AxeBuilder({ page })
        .include('[data-preview="standard"]')
        .analyze();
      assert.deepEqual(
        axe.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => v.id),
        [],
      );
      assert.deepEqual(errors, []);
      results.push({ width, contexts: 7, rarities: 6, passed: true });
      await context.close();
    }
    const animated = await browser.newContext({
      viewport: { width: 412, height: 900 },
      reducedMotion: "no-preference",
      isMobile: true,
      hasTouch: true,
    });
    const animatedPage = await animated.newPage();
    let mutations = 0;
    animatedPage.on("request", (r) => {
      if (r.method() === "POST") mutations++;
    });
    await animatedPage.goto(
      origin + "/preview/rarity-frames?futuristic=1&context=rarities",
    );
    await animatedPage
      .getByRole("button", { name: "Preview six-card reveal" })
      .click();
    for (let i = 0; i < 6; i++) {
      await expect(
        animatedPage.locator(`[data-reveal-index="${i}"]`),
      ).toBeVisible();
      if (i === 1) {
        const samples = await animatedPage
          .locator(".pack-arrival")
          .evaluate(async (el) => {
            const values: number[] = [];
            const start = performance.now();
            while (performance.now() - start <= 2100) {
              values.push(
                new DOMMatrixReadOnly(getComputedStyle(el).transform).m11,
              );
              await new Promise<number>(requestAnimationFrame);
            }
            return values;
          });
        assert.ok(samples.length > 10);
        for (let s = 1; s < samples.length; s++)
          assert.ok(
            samples[s] >= samples[s - 1] - 0.035,
            "Reveal must not turn backwards",
          );
      }
      const next = animatedPage.getByRole("button", {
        name: i === 5 ? "View pack summary" : "Reveal next card",
      });
      await expect(next).toBeEnabled();
      await expect(animatedPage.locator(".pack-card-back")).toBeHidden();
      await expect(
        animatedPage.locator(".pack-case .collectible-frame"),
      ).toHaveCount(1);
      assert.ok(
        await animatedPage
          .locator(".pack-arrival")
          .evaluate(
            (el) =>
              new DOMMatrixReadOnly(getComputedStyle(el).transform).isIdentity,
          ),
      );
      if (i === 5)
        await animatedPage.screenshot({ path: out + "/animated-icon-412.png" });
      await next.click();
    }
    await expect(animatedPage.locator(".pack-summary li")).toHaveCount(6);
    assert.equal(mutations, 0, "Replay never issues cards");
    results.push({
      normalMotion: true,
      singleForwardReveal: true,
      sixCards: true,
      mutations,
    });
    await animated.close();
    writeFileSync(
      out + "/results.json",
      JSON.stringify(
        {
          scope:
            "Production components with isolated local fixtures; no hosted or physical-device acceptance",
          results,
        },
        null,
        2,
      ),
    );
    console.log(out);
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
