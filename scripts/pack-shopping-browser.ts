import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  packFixture,
  packMember,
  packNow as sourcePackNow,
} from "../tests/fixtures/pack-economy";
import { executeCredits } from "../src/core/credits-sandbox";
import {
  memberTestView,
  memberTestSummary,
  testReceipt,
  testCard,
} from "../src/core/member-test-wallet";
import { refreshEconomyCatalogue } from "../src/server/economy-catalogue";
import type { Sql } from "postgres";
import { prepareRosterBetaCatalogue } from "../src/core/roster-beta-prepare";
import { jerseyPresentation } from "../src/core/card-presentation";
import { paidPackCatalogueUpgrade } from "../src/core/card-economy";
async function main() {
  const nba = process.argv.includes("--nba");
  const sport = nba
    ? "basketball"
    : process.argv.includes("--afl")
      ? "afl"
      : process.argv.includes("--nrl")
        ? "nrl"
        : "nfl";
  const realRoster = process.argv.includes("--real-rosters");
  const packNow = realRoster ? Date.now() : sourcePackNow;
  const fixture = () => {
    const state = packFixture(sport);
    if (sport === "nfl" && process.argv.includes("--three-sport"))
      paidPackCatalogueUpgrade(state.economy!, packNow);
    if (realRoster) {
      assert.notEqual(sport, "nfl");
      const players = JSON.parse(
        readFileSync(
          "public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json",
          "utf8",
        ),
      ).players;
      state.economy = prepareRosterBetaCatalogue(
        state.economy!,
        players,
        packNow,
      ).economy;
    }
    return state;
  };
  const packPath =
    "/fantasy/test-wallet?view=packs" +
    (sport !== "nfl" ? `&fixtureSport=${sport}&sport=${sport}` : "");
  const out = process.argv.includes("--three-sport")
    ? `docs/qa/three-sport-parity/packs/${sport}`
    : `docs/qa/${realRoster ? `real-rosters/${sport}/packs` : sport !== "nfl" ? `overnight-multisport/${sport}/packs` : process.argv.includes("--futuristic") ? "futuristic-cards/pack-regression" : "pack-shopping"}/browser-${Date.now()}`;
  mkdirSync(out, { recursive: true });
  const script = await bundleCommunityFixture(
    "tests/fixtures/pack-shopping.tsx",
  );
  const cardsScript = await bundleCommunityFixture(
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
    "standings",
    "pack-shop",
    "owned-collection",
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  let state = fixture(),
    calls = 0,
    loseResponse = false,
    rejectPurchase = false;
  const requests: string[] = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/api/nba-beta") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ allowed: sport === "basketball" }));
    }
    if (url.pathname === "/api/sports-beta") {
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({ allowed: sport === "nfl" ? [] : [sport] }),
      );
    }
    if (url.pathname === "/api/test-wallet") {
      res.setHeader("Content-Type", "application/json");
      try {
        // Exercise the same observation refresh as the hosted read/purchase path.
        // All transport and observations remain isolated local fixtures.
        const observations = Object.values(state.economy!.players)
          .filter((p) => p.sport === "nfl")
          .map((p) => ({
            id: p.id,
            team: p.currentTeam,
            position: p.position,
            status: "ACT",
            checked_at: new Date(packNow),
            raw_id: p.sourceRevision,
            verified_jersey_number: p.verifiedJerseyNumber ?? null,
          }));
        await refreshEconomyCatalogue(
          (async () => observations) as unknown as Sql,
          state,
        );
        let result: unknown = {};
        if (req.method === "POST") {
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const body = JSON.parse(raw);
          calls++;
          requests.push(body.request);
          if (rejectPurchase && body.command.kind === "buy-pack") {
            rejectPurchase = false;
            throw Error("Pack unavailable: insufficient eligible supply");
          }
          const next = executeCredits(
            state,
            packMember,
            body.request,
            body.command,
            packNow + calls,
          );
          state = next.state;
          result =
            body.command.kind === "open-pack"
              ? testReceipt(state, body.command.entitlement, packMember.id)
              : next.result;
          if (loseResponse && body.command.kind === "buy-pack") {
            loseResponse = false;
            res.statusCode = 504;
            return res.end(
              '{"error":"Purchase response unavailable. Reconcile the pending request."}',
            );
          }
        }
        return res.end(
          JSON.stringify({
            state:
              url.searchParams.get("view") === "summary"
                ? memberTestSummary(state, packMember.id, packNow + calls)
                : memberTestView(
                    state,
                    packMember.id,
                    [],
                    false,
                    packNow + calls,
                    [],
                    { catalogue: false },
                  ),
            result,
          }),
        );
      } catch (e) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({ outcome: "rejected", error: String(e) }),
        );
      }
    }
    if (url.pathname === "/local-identity") {
      res.setHeader("Content-Type", "application/json");
      return res.end('{"member":"visual-member"}');
    }
    if (url.pathname === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(script);
    }
    if (url.pathname === "/cards.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(cardsScript);
    }
    if (url.pathname === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      return res.end(css);
    }
    if (
      url.pathname.startsWith("/brand/") ||
      url.pathname.startsWith("/images/")
    ) {
      const file = resolve("public", "." + url.pathname);
      assert.ok(file.startsWith(resolve("public") + sep));
      try {
        res.setHeader(
          "Content-Type",
          file.endsWith("svg")
            ? "image/svg+xml"
            : file.endsWith("webp")
              ? "image/webp"
              : "image/png",
        );
        return res.end(readFileSync(file));
      } catch {
        res.statusCode = 404;
        return res.end();
      }
    }
    if (url.pathname.startsWith("/api/")) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      return res.end('{"error":"Local fixture"}');
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked isolated pack verification</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="${url.pathname === "/fantasy/cards" ? "/cards.js" : "/fixture.js"}"></script></body></html>`,
    );
  });
  await new Promise<void>((r) =>
    server.listen(process.argv.includes("--serve") ? 3026 : 0, "127.0.0.1", r),
  );
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  if (process.argv.includes("--serve")) {
    console.log(origin + "/fantasy/test-wallet?view=packs");
    return;
  }
  const browser = await chromium.launch({ channel: "msedge" });
  const results: unknown[] = [];
  let lastPage: import("@playwright/test").Page | null = null;
  try {
    if (process.argv.includes("--three-sport")) {
      for (const width of [412, 1440]) {
        state = fixture();
        calls = 0;
        const page = await browser.newPage({
          viewport: { width, height: 915 },
          reducedMotion: "reduce",
        });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(origin + packPath);
        await expect(page.locator(".pack-product")).toHaveCount(6);
        await expect(
          page.getByRole("heading", {
            name: `Weekly ${sport.toUpperCase()} Starter Pack`,
          }),
        ).toBeVisible();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        for (const [family, price] of [
          ["Standard", 700],
          ["Premium", 5000],
        ] as const) {
          await page
            .getByRole("button", { name: `Buy ${family} 9 Pack`, exact: true })
            .click();
          await expect(page.getByRole("dialog")).toContainText(
            price.toLocaleString("en-AU"),
          );
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        }
        await page.screenshot({
          path: `${out}/buy-${width}.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "Buy Standard 9 Pack", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Confirm Purchase", exact: true })
          .dblclick();
        await expect(
          page.getByRole("button", { name: "Reveal next card" }),
        ).toBeVisible({ timeout: 15000 });
        assert.equal(Object.keys(state.economy!.instances).length, 9);
        assert.equal(calls, 2);
        assert(
          Object.values(state.economy!.instances).every(
            (c) =>
              state.economy!.players[c.playerId].sport === sport &&
              c.rarity !== "CORE",
          ),
        );
        await page
          .getByRole("button", { name: "Skip remaining reveals" })
          .click();
        await expect(page.locator(".pack-summary li")).toHaveCount(9);
        await page.screenshot({
          path: `${out}/reveal-${width}.png`,
          fullPage: true,
        });
        assert.deepEqual(errors, []);
        results.push({
          width,
          sport,
          products: 6,
          paidCards: 9,
          duplicateTapProtected: true,
          productionMutation: false,
        });
        await page.close();
      }
      writeFileSync(
        out + "/browser.json",
        JSON.stringify({ passed: true, isolated: true, results }, null, 2),
      );
      console.log(JSON.stringify(results));
      return;
    }
    for (const width of [1440, 1024, 412, 360]) {
      state = fixture();
      calls = 0;
      const context = await browser.newContext({
        viewport: { width, height: 915 },
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      lastPage = page;
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", () => {
        throw Error("Native dialog is forbidden");
      });
      await page.goto(origin + packPath);
      await expect(
        page.getByRole("combobox", {
          name: width < 900 ? "Active sport" : "Active sport desktop",
          exact: true,
        }),
      ).toHaveValue(sport);
      await expect(
        page.getByRole("heading", {
          name: `${sport === "basketball" ? "NBA" : sport.toUpperCase()} Packs`,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Install Docked", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Eligible players", { exact: true }),
      ).toHaveCount(0);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `${out}/buy-${width}.png`,
        fullPage: true,
      });
      const buy = page.getByRole("button", {
        name: "Buy Premium 9 Pack",
        exact: true,
      });
      await buy.click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Confirm purchase" }),
      ).toBeVisible();
      await expect(dialog).toContainText(sport !== "nfl" ? "20,000" : "23,200");
      assert.equal(calls, 0);
      await page.screenshot({
        path: `${out}/review-${width}.png`,
        fullPage: true,
      });
      const axe = await new AxeBuilder({ page })
        .include(".pack-purchase-sheet")
        .analyze();
      assert.deepEqual(
        axe.violations
          .filter((v) => ["critical", "serious"].includes(v.impact ?? ""))
          .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        [],
      );
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      assert.equal(calls, 0);
      await buy.click();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.equal(calls, 0);
      assert.notEqual(
        await page.evaluate(() => document.body.style.overflow),
        "hidden",
      );
      await buy.click();
      await dialog
        .getByRole("button", { name: "Confirm Purchase", exact: true })
        .dblclick();
      await expect(
        page.getByRole("button", { name: "Reveal next card" }),
      ).toBeVisible({ timeout: 15000 });
      assert.equal(Object.keys(state.economy!.instances).length, 9);
      assert.equal(calls, 2);
      await expect(page.locator(".pack-opening")).toHaveClass(/pack-simple/);
      if (realRoster) {
        const verified = new Set(
          Object.keys(state.economy!.instances).map(
            (id) => jerseyPresentation(testCard(state, id)).number,
          ),
        );
        for (const number of await page
          .locator(".jersey-number")
          .allTextContents())
          assert(
            verified.has(number),
            "Revealed number must match a source-verified card in this receipt",
          );
      } else assert.equal(await page.locator(".jersey-number").count(), 0);
      await page.getByLabel("Opening settings").click();
      await expect(
        page.getByLabel("Reduce motion", { exact: true }),
      ).toBeChecked();
      await page.screenshot({
        path: `${out}/reveal-${width}.png`,
        fullPage: true,
      });
      await page.getByLabel("Opening settings").click();
      await page.getByRole("button", { name: "Reveal next card" }).click();
      await expect(page.locator(".pack-count")).toContainText("2 of 9");
      await page
        .getByRole("button", { name: "Skip remaining reveals" })
        .click();
      await expect(page.locator(".pack-summary li")).toHaveCount(9);
      await page.getByRole("button", { name: /Replay saved result/ }).click();
      assert.equal(calls, 2);
      await page.getByRole("button", { name: "Close panel" }).click();
      await page.getByRole("button", { name: "History", exact: true }).click();
      await expect(page.locator(".pack-history-row")).toHaveCount(1);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Pack history" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Replay", exact: true }).click();
      await expect(page.getByText("REPLAY · NO NEW AWARDS")).toBeVisible();
      assert.equal(calls, 2);
      await page.getByRole("button", { name: "Close panel" }).click();
      if (sport === "nfl") {
        await page.goto(origin + "/fantasy/cards");
        await expect(
          page.getByRole("heading", { name: "My collection" }),
        ).toBeVisible();
        for (const name of [
          "Estimated Portfolio Value",
          "Eligibility & Collection Options",
          "Scoring Rules",
        ])
          await expect(page.getByText(name, { exact: true })).toHaveCount(0);
        await page.screenshot({
          path: `${out}/cards-${width}.png`,
          fullPage: true,
        });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
      }
      assert.deepEqual(errors, []);
      results.push({ width, passed: true, axeSerious: 0 });
      await context.close();
    }
    state = fixture();
    calls = 0;
    requests.length = 0;
    const page = await browser.newPage({
      viewport: { width: 412, height: 915 },
      reducedMotion: "no-preference",
    });
    lastPage = page;
    await page.goto(origin + packPath);
    rejectPurchase = true;
    await page
      .getByRole("button", { name: "Buy Premium 9 Pack", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Purchase", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "insufficient eligible supply",
    );
    assert.equal(Object.keys(state.economy!.instances).length, 0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    loseResponse = true;
    await page
      .getByRole("button", { name: "Buy Premium 9 Pack", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Purchase", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    assert.equal(Object.keys(state.economy!.instances).length, 9);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.reload();
    await page
      .getByRole("button", { name: "Retry pending transaction" })
      .click();
    await expect(
      page.getByRole("button", { name: "Reveal next card" }),
    ).toBeEnabled({ timeout: 15000 });
    assert.equal(requests[1], requests[2]);
    assert.equal(Object.keys(state.economy!.instances).length, 9);
    await page.getByLabel("Opening settings").click();
    await page.getByLabel("Reduce motion", { exact: true }).check();
    await expect(page.locator(".pack-opening")).toHaveClass(/pack-simple/);
    await page.getByRole("button", { name: "Close panel" }).click();
    await page.goto(origin + "/fantasy/test-wallet?view=packs&sport=football");
    await expect(
      page.getByRole("heading", { name: "EPL · Coming soon" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Buy Premium 9 Pack", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Active sport", exact: true })
      .selectOption("nfl");
    await expect(
      page.getByRole("heading", { name: "NFL Packs" }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("docked:active-sport")),
      "nfl",
    );
    await page.goto(origin + "/fantasy/cards");
    await expect(
      page.getByRole("combobox", { name: "Active sport", exact: true }),
    ).toHaveValue("nfl");
    await page.goto(origin + "/fantasy/profile");
    await expect(
      page.getByRole("button", { name: "Install Docked", exact: true }),
    ).toHaveCount(0);
    const offerInstall = () =>
      page.evaluate(`(() => {
      const event = new Event("beforeinstallprompt",{cancelable:true});
      Object.assign(event,{prompt:async()=>{Object.assign(window,{installRequested:true});},userChoice:Promise.resolve({outcome:"accepted"})});
      window.dispatchEvent(event);
    })()`);
    await offerInstall();
    await expect(
      page.getByRole("button", { name: "Install Docked", exact: true }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(() => "installRequested" in window),
      false,
    );
    await page
      .getByRole("button", { name: "Install Docked", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Install Docked", exact: true }),
    ).toHaveCount(0);
    await offerInstall();
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(
      page.getByRole("button", { name: "Install Docked", exact: true }),
    ).toHaveCount(0);
    await page.goto(origin + "/fantasy/test-wallet?view=packs");
    await offerInstall();
    await expect(
      page.getByRole("button", { name: "Install Docked", exact: true }),
    ).toHaveCount(0);
    results.push({
      errorsAndLostResponse: true,
      motionToggle: true,
      unsupportedSport: true,
      sportPersistence: true,
      installGating: true,
    });
    writeFileSync(
      `${out}/browser.json`,
      JSON.stringify(
        {
          results,
          sport,
          isolatedComponents: true,
          authenticatedHosted: false,
        },
        null,
        2,
      ),
    );
    writeFileSync(
      sport !== "nfl"
        ? `docs/qa/overnight-multisport/${sport}/packs/latest-browser.json`
        : "docs/qa/pack-shopping/latest-browser.json",
      JSON.stringify({ out, results }, null, 2),
    );
    console.log(JSON.stringify({ out, results }));
  } catch (error) {
    console.error(error);
    if (lastPage && !lastPage.isClosed()) {
      await lastPage.screenshot({ path: `${out}/failure.png`, fullPage: true });
      writeFileSync(
        `${out}/failure.txt`,
        await lastPage.locator("body").innerText(),
      );
    }
    throw error;
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
