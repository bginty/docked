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
  packNow,
} from "../tests/fixtures/pack-economy";
import { executeCredits } from "../src/core/credits-sandbox";
import { memberTestView, testReceipt } from "../src/core/member-test-wallet";
import { paidPackCatalogueUpgrade } from "../src/core/card-economy";
import { paidPackOffers } from "../src/core/paid-pack-catalogue";
function catalogue() {
  const s = packFixture();
  paidPackCatalogueUpgrade(s.economy!, packNow);
  return s;
}
async function main() {
  const out = `docs/qa/member-platform/browser-${Date.now()}`;
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
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  let state = catalogue(),
    calls = 0,
    loseResponse = false,
    rejectPurchase = false;
  const requests: string[] = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/api/test-wallet") {
      res.setHeader("Content-Type", "application/json");
      try {
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
            state: memberTestView(
              state,
              packMember.id,
              [],
              false,
              packNow + calls,
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
  const checks: unknown[] = [];
  try {
    for (const width of [1536, 1440, 1024, 412, 360]) {
      state = catalogue();
      calls = 0;
      const context = await browser.newContext({
        viewport: { width, height: 915 },
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "/fantasy/test-wallet?view=packs");
      await expect(page.locator(".pack-product")).toHaveCount(6);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: out + "/packs-" + width + ".png",
        fullPage: true,
      });
      for (const offer of paidPackOffers) {
        await page
          .getByRole("button", { name: "Buy Packs", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Buy " + offer.name, exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText(offer.name);
        const before = calls;
        await page.keyboard.press("Escape");
        assert.equal(calls, before);
        await page
          .getByRole("button", { name: "Buy " + offer.name, exact: true })
          .click();
        const axe = await new AxeBuilder({ page })
          .include(".pack-purchase-sheet")
          .analyze();
        assert.deepEqual(
          axe.violations
            .filter((v) => ["critical", "serious"].includes(v.impact ?? ""))
            .map((v) => v.id),
          [],
        );
        await page
          .getByRole("button", { name: "Confirm Purchase", exact: true })
          .dblclick();
        await expect(page.locator(".pack-opening")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Skip remaining reveals" }),
        ).toBeVisible({ timeout: 15000 });
        await page
          .getByRole("button", { name: "Skip remaining reveals" })
          .click();
        await expect(page.locator(".pack-summary li")).toHaveCount(offer.cards);
        assert.equal(calls, before + 2);
        await page.getByRole("button", { name: /Replay saved result/ }).click();
        assert.equal(calls, before + 2);
        await page.getByRole("button", { name: "Close panel" }).click();
      }
      assert.equal(
        Object.values(state.economy!.packs).reduce(
          (n, p) => n + p.cards.length,
          0,
        ),
        26,
      );
      assert.deepEqual(errors, []);
      checks.push({
        width,
        sixPurchases: true,
        counts: [9, 3, 1, 9, 3, 1],
        duplicateCharge: false,
        replay: true,
        axeSerious: 0,
      });
      await context.close();
    }
    writeFileSync(out + "/browser.json", JSON.stringify(checks, null, 2));
    console.log(JSON.stringify({ out, checks }));
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
