/** LOCAL ONLY: real components/core with simulated identity and in-memory HTTP. Not Auth/Postgres E2E. */
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../tests/fixtures/marketplace-state";
import {
  executeCredits,
  wallet,
  validateCredits,
} from "../src/core/credits-sandbox";
import { testCard } from "../src/core/member-test-wallet";
import { marketQuery, marketplaceView } from "../src/core/marketplace";
async function main() {
  const dir = `docs/qa/fixed-price-marketplace/browser-${Date.now()}`;
  mkdirSync(dir, { recursive: true });
  let state = marketplaceFixture(),
    dropBuy = false,
    failRead = false;
  const own = (i: number) =>
    Object.keys(state.cards).filter(
      (id) => state.commerce.cards[id].owner === marketActors[i].id,
    );
  const cardId = own(0)[0],
    card = testCard(state, cardId);
  const initial = marketActors.map((a) => wallet(state, a.id).spendable);
  const js = await bundleCommunityFixture(
    "tests/fixtures/fixed-price-marketplace.tsx",
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
  ]
    .map((f) => readFileSync(`src/app/${f}.css`, "utf8"))
    .join("\n");
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://local"),
      actor = marketActors[req.headers.cookie?.includes("qa=b") ? 1 : 0];
    const json = (v: unknown, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(v));
    };
    try {
      if (url.pathname === "/local-identity")
        return json({
          member: actor.id,
          cards: own(actor === marketActors[0] ? 0 : 1).map((id) =>
            testCard(state, id),
          ),
        });
      if (url.pathname === "/api/marketplace") {
        let result: unknown = null;
        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          for await (const b of req) chunks.push(b);
          const input = JSON.parse(Buffer.concat(chunks).toString());
          const out = executeCredits(
            state,
            actor,
            input.request,
            input.command,
            Date.now(),
          );
          state = out.state;
          result = out.result;
          if (dropBuy && input.command.kind === "buy") {
            dropBuy = false;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end("{");
            return;
          }
        } else if (failRead)
          return json({ error: "Simulated network failure" }, 503);
        return json({
          state: marketplaceView(
            state,
            actor.id,
            marketLabels,
            marketQuery.parse(Object.fromEntries(url.searchParams)),
            { reserved: [], rounds: [], tradingEnabled: true },
          ),
          result,
        });
      }
      if (url.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(js);
        return;
      }
      if (url.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
        return;
      }
      if (
        url.pathname.startsWith("/brand/") ||
        url.pathname.startsWith("/images/")
      ) {
        const file = resolve("public", "." + url.pathname);
        assert.ok(file.startsWith(resolve("public") + sep));
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg")
            ? "image/svg+xml"
            : file.endsWith(".webp")
              ? "image/webp"
              : "image/png",
        );
        res.end(readFileSync(file));
        return;
      }
      if (url.pathname.startsWith("/api/"))
        return json({ error: "Outside component fixture" }, 503);
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Docked isolated marketplace UI</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    } catch (e) {
      json({ error: (e as Error).message, outcome: "rejected" }, 400);
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    browser = await chromium.launch({ channel: "msedge" });
  const checks: string[] = [],
    errors: string[] = [];
  try {
    const a = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const b = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    await b.addCookies([{ name: "qa", value: "b", url: origin }]);
    const pa = await a.newPage(),
      pb = await b.newPage();
    for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
    await pb.goto(origin + "/fantasy/market");
    await expect(
      pb.getByRole("heading", { name: "No listings found" }),
    ).toBeVisible();
    const openSell = async () => {
      await pa.goto(origin + "/fantasy/cards");
      await pa
        .getByRole("button", { name: `View ${card.name}`, exact: true })
        .click();
      await pa.getByRole("button", { name: "Sell card", exact: true }).click();
      const modal = pa.getByRole("dialog", {
        name: "Confirm listing",
        exact: true,
      });
      await expect(modal).toContainText(card.name);
      return modal;
    };
    let dialog = await openSell();
    await pa.goBack();
    await expect(dialog).toHaveCount(0);
    dialog = await openSell();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(Object.keys(state.listings).length, 0);
    checks.push("Exact-card dialog; cancel creates nothing");
    dialog = await openSell();
    await dialog.getByLabel("Your asking price").fill("1000");
    await expect(dialog.locator(".market-fees")).toContainText("950 credits");
    await pa.screenshot({ path: `${dir}/confirm-412.png`, fullPage: true });
    await dialog
      .getByRole("button", { name: "List card", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Card listed" }),
    ).toBeVisible();
    assert.equal(Object.keys(state.listings).length, 1);
    await pa.goto(origin + "/fantasy/market?tab=listings");
    await expect(pa.locator(".market-tile")).toHaveCount(1);
    await expect(pa.getByText("Select card", { exact: true })).toHaveCount(0);
    await expect(pb.locator(".market-tile")).toHaveCount(1, { timeout: 15000 });
    await expect(pb.locator(".market-tile")).toContainText(
      "Seller: Local Alice",
    );
    checks.push(
      "Listing persists once; active-only My Listings; already-open other browser updates by polling",
    );
    for (const width of [1440, 412, 360]) {
      await pa.setViewportSize({ width, height: 915 });
      await pb.setViewportSize({ width, height: 915 });
      await pa.screenshot({
        path: `${dir}/listings-${width}.png`,
        fullPage: true,
      });
      await pb.screenshot({
        path: `${dir}/browse-${width}.png`,
        fullPage: true,
      });
      for (const page of [pa, pb])
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
    }
    await pa.setViewportSize({ width: 412, height: 915 });
    await pa
      .getByRole("button", { name: "Manage listing", exact: true })
      .click();
    const manage = pa.getByRole("dialog", {
      name: "Manage listing",
      exact: true,
    });
    await manage.getByLabel("New asking price").fill("1200");
    await pa.screenshot({ path: `${dir}/manage-412.png`, fullPage: true });
    await manage
      .getByRole("button", { name: "Save price", exact: true })
      .click();
    await expect(
      manage.getByRole("heading", { name: "Price saved" }),
    ).toBeVisible();
    await expect(pb.locator(".market-price")).toHaveText("1,200 credits", {
      timeout: 15000,
    });
    await manage
      .getByRole("button", { name: "Close", exact: true })
      .last()
      .click();
    await pa
      .getByRole("button", { name: "Manage listing", exact: true })
      .click();
    await manage
      .getByRole("button", { name: "Remove listing", exact: true })
      .click();
    await manage
      .getByRole("button", { name: "Confirm removal", exact: true })
      .click();
    await expect(
      manage.getByRole("heading", { name: "Listing removed" }),
    ).toBeVisible();
    await expect(pb.locator(".market-tile")).toHaveCount(0, { timeout: 15000 });
    checks.push(
      "Versioned repricing and removal update both browsers without logout",
    );
    dialog = await openSell();
    await dialog.getByLabel("Your asking price").fill("1000");
    await dialog
      .getByRole("button", { name: "List card", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Card listed" }),
    ).toBeVisible();
    await expect(pb.locator(".market-tile")).toHaveCount(1, { timeout: 15000 });
    await pb.getByRole("button", { name: "Buy card", exact: true }).click();
    await pb
      .getByRole("button", { name: "Review purchase", exact: true })
      .click();
    await expect(
      pb.getByRole("button", { name: "Confirm purchase", exact: true }),
    ).toBeVisible();
    // Price changes away and back: matching amount must not revive stale consent.
    const active = Object.entries(state.listings).find(
      ([, l]) => l.status === "OPEN",
    )!;
    for (const [i, price] of [1100, 1000].entries())
      state = executeCredits(
        state,
        marketActors[0],
        `stale-reprice-${i}`,
        {
          kind: "reprice-listing",
          listing: active[0],
          price,
          expectedRevision: state.listings[active[0]].revision,
        },
        Date.now(),
      ).state;
    await pb
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .click();
    await expect(
      pb.getByRole("button", { name: "Review purchase", exact: true }),
    ).toBeVisible();
    assert.equal(wallet(state, marketActors[1].id).spendable, initial[1]);
    await pb
      .getByRole("button", { name: "Review purchase", exact: true })
      .click();
    await expect(
      pb.getByRole("button", { name: "Confirm purchase", exact: true }),
    ).toBeVisible();
    checks.push(
      "Browser Back closes sheet; stale version clears consent even after price returns to original amount",
    );
    dropBuy = true;
    await pb
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .click();
    await pb
      .getByRole("button", { name: "Check original request", exact: true })
      .click();
    await expect(
      pb.getByRole("heading", { name: "Request confirmed" }),
    ).toBeVisible();
    assert.equal(state.commerce.cards[cardId].owner, marketActors[1].id);
    assert.equal(wallet(state, marketActors[0].id).spendable, initial[0] + 950);
    assert.equal(
      wallet(state, marketActors[1].id).spendable,
      initial[1] - 1000,
    );
    assert.equal(
      Object.values(state.listings).filter((l) => l.status === "SOLD").length,
      1,
    );
    validateCredits(state);
    checks.push(
      "Lost purchase response recovers once; gross 1000 / fee 50 / seller 950; ownership and journal reconcile",
    );
    await pa.goto(origin + "/fantasy/market?tab=activity");
    await pb.goto(origin + "/fantasy/market?tab=activity");
    await expect(pa.locator(".market-activity")).toContainText("Received 950");
    await expect(pb.locator(".market-activity")).toContainText("Paid");
    await pa.getByRole("button", { name: "Bought", exact: true }).click();
    await expect(pa.locator(".market-activity > article")).toHaveCount(0);
    await pa.getByRole("button", { name: "Sold", exact: true }).click();
    await expect(pa.locator(".market-activity > article")).toHaveCount(1);
    for (const width of [1440, 1024, 412, 360]) {
      await pa.setViewportSize({ width, height: width < 600 ? 915 : 900 });
      await pa.screenshot({
        path: `${dir}/activity-${width}.png`,
        fullPage: true,
      });
      assert.ok(
        await pa.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `No overflow ${width}`,
      );
      const violations = (
        await new AxeBuilder({ page: pa })
          .disableRules(["color-contrast"])
          .analyze()
      ).violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      );
      assert.deepEqual(violations, []);
    }
    checks.push(
      "Activity filters, snapshot identity, 1440/1024/412/360 no overflow, critical/serious axe checks",
    );
    failRead = true;
    await pb.goto(origin + "/fantasy/market");
    await expect(pb.getByRole("alert")).toContainText(
      "Simulated network failure",
    );
    await expect(
      pb.getByRole("heading", { name: "No listings found" }),
    ).toHaveCount(0);
    failRead = false;
    await pb.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      pb.getByRole("heading", { name: "No listings found" }),
    ).toBeVisible();
    checks.push("Read failure is distinct from empty feed; retry recovers");
    assert.deepEqual(errors, []);
    writeFileSync(
      `${dir}/results.json`,
      JSON.stringify(
        {
          kind: "Component HTTP test; simulated identity and in-memory persistence, NOT Auth/Postgres E2E",
          checks,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ checks, errors }));
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
