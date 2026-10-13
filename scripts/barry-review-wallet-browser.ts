// Actual customer component and domain engine; LOCAL synthetic authentication only.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect, devices } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import {
  initialMemberTestCredits,
  memberTestView,
  memberTestCommand,
  testReceipt,
} from "../src/core/member-test-wallet";
import { initialCardEconomy, sevenPlayerPackUpgrade } from "../src/core/card-economy";
import {
  executeCredits,
  financialReport,
  wallet,
} from "../src/core/credits-sandbox";
import { newCreditOnly } from "../src/core/credit-only";
async function main() {
  mkdirSync("docs/qa/barry-review/local-wallet", { recursive: true });
  const alice = { id: "synthetic-alice", role: "member" } as const,
    bob = { id: "synthetic-bob", role: "member" } as const;
  const admin = {
    id: "synthetic-admin",
    role: "reviewer",
    aal: "aal2",
  } as const;
  let state = initialMemberTestCredits();
  state.creditOnly = newCreditOnly();
  state.economy = initialCardEconomy(
    Array.from({ length: 24 }, (_, i) => ({
      id: `synthetic-player-${i}`,
      provider: "fixture",
      providerId: `id-${i}`,
      name: `Synthetic Player ${i}`,
      sport: "nfl",
      assetKind: "player",
      position: ["QB", "RB", "WR", "TE"][i % 4],
      currentTeam: "TEST",
      status: "active",
      observedAt: Date.now(),
      sourceRevision: "QA",
      presentation: "docked-shirt-v1",
    })),
    Date.now(),
  );
  sevenPlayerPackUpgrade(state.economy!, Date.now());
  for (const m of [alice, bob])
    state = executeCredits(
      state,
      admin,
      `grant-${m.id}`,
      {
        kind: "promotion",
        member: m.id,
        amount: 2000,
        campaign: "credit-v2-local",
        reason: "Local fictional test balance only",
        confirmed: true,
        redeemable: false,
      },
      Date.now(),
    ).state;
  const peers = [alice, bob].map((m) => ({ id: m.id, label: m.id }));
  const script = await bundleCommunityFixture(
    "tests/fixtures/credit-v2-wallet.tsx",
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
  ]
    .map((n) => readFileSync(`src/app/${n}.css`, "utf8"))
    .join("\n");
  let origin = "";
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url!, origin);
      assert.equal(req.headers.host, new URL(origin).host);
      const m = req.headers.cookie === "qa=bob" ? bob : alice;
      if (u.pathname === "/api/test-wallet") {
        if (u.searchParams.has("format")) {
          res.writeHead(403).end();
          return;
        }
        let result: unknown = null;
        if (req.method === "POST") {
          const buffers = [];
          for await (const b of req) buffers.push(b);
          const input = JSON.parse(Buffer.concat(buffers).toString());
          const command = memberTestCommand(input.command);
          const out = executeCredits(
            state,
            m,
            input.request,
            command,
            Date.now(),
          );
          state = out.state;
          result = out.result;
          if (command.kind === "open-pack")
            result = testReceipt(state, command.entitlement, m.id);
        }
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({ state: memberTestView(state, m.id, peers), result }),
        );
        return;
      }
      if (u.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(script);
        return;
      }
      if (u.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(css);
        return;
      }
      if (
        u.pathname.startsWith("/brand/") ||
        u.pathname.startsWith("/images/")
      ) {
        const p = resolve("public", "." + u.pathname);
        assert.ok(p.startsWith(resolve("public") + sep));
        res.setHeader(
          "Content-Type",
          p.endsWith(".svg")
            ? "image/svg+xml"
            : p.endsWith(".webp")
              ? "image/webp"
              : "image/png",
        );
        res.end(readFileSync(p));
        return;
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><title>Docked local synthetic wallet acceptance</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><main id="main"><div id="fixture-root"></div></main><script src="/fixture.js"></script></body></html>',
      );
    } catch (e) {
      res
        .writeHead(400, { "Content-Type": "application/json" })
        .end(
          JSON.stringify({ error: (e as Error).message, outcome: "rejected" }),
        );
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const browser = await chromium.launch({ channel: "msedge" }),
    checks: string[] = [];
  try {
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      timezoneId: "Australia/Sydney",
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => void d.accept());
    const b = await browser.newContext();
    await b.addCookies([{ name: "qa", value: "bob", url: origin }]);
    const post = async (
      ctx: typeof context,
      command: unknown,
      request: string = randomUUID(),
    ) => {
      const r = await ctx.request.post(origin + "/api/test-wallet", {
        data: { request, command },
      });
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    };
    await page.goto(origin);
    await expect(
      page.getByRole("heading", { name: "Test wallet", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Withdraw · unavailable" }),
    ).toBeDisabled();
    const p = state.economy!.products["standard-nine-seven-test-v2"];
    const command = {
      kind: "buy-pack",
      product: p.id,
      configuration: p.version,
      policy: state.policy.version,
      confirmed: true,
    };
    await page
      .getByRole("button", { name: "Buy Standard · nine cards", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Open pack", exact: true }),
    ).toBeVisible();
    const key = Object.keys(state.economy!.packs)[0];
    await post(context, command, key);
    await page.getByRole("button", { name: "Open pack", exact: true }).click();
    await page.getByRole("button", { name: "Open pack seal" }).click();
    await expect(
      page.getByRole("button", { name: "Reveal all", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reveal all", exact: true }).click();
    await page
      .getByRole("button", { name: "Back to collection", exact: true })
      .click();
    const receipt = (
      await post(context, { kind: "open-pack", entitlement: key })
    ).result;
    assert.equal(receipt.cards.length, 9);
    assert.deepEqual(
      (await post(context, { kind: "open-pack", entitlement: key })).result,
      receipt,
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Test wallet", exact: true }),
    ).toBeVisible();
    checks.push(
      "Android Chrome emulation: nine-card purchase/open retries, persisted receipt and collection restoration",
    );
    const card = receipt.cards[0].id,
      listing = randomUUID();
    await post(context, { kind: "list", card, price: 1000 }, listing);
    await post(b, {
      kind: "buy",
      listing,
      expectedPrice: 1000,
      policy: state.policy.version,
      confirmed: true,
    });
    assert.equal(wallet(state, alice.id).available, 2025);
    assert.equal(wallet(state, bob.id).available, 1000);
    const resale = randomUUID();
    await post(b, { kind: "list", card, price: 900 }, resale);
    await page.reload();
    await page
      .getByRole("button", { name: "Buy test card", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Buy test card", exact: true }),
    ).toHaveCount(0);
    assert.equal(financialReport(state).commission, 143);
    checks.push(
      "Two ordinary projections: list, purchase, resale, 75/68 commission, unique ownership/history and restricted seller proceeds",
    );
    const cancel = randomUUID();
    await post(context, { kind: "list", card, price: 100 }, cancel);
    await post(context, { kind: "cancel-listing", listing: cancel });
    state = executeCredits(
      state,
      admin,
      "free",
      {
        kind: "swap-window",
        start: Date.now() + 10,
        end: Date.now() + 60000,
        reason: "Local free swap acceptance only",
      },
      Date.now(),
    ).state;
    await new Promise((r) => setTimeout(r, 20));
    const bobPack = randomUUID();
    await post(b, command, bobPack);
    const bc = (await post(b, { kind: "open-pack", entitlement: bobPack }))
      .result.cards[0].id;
    const offer = randomUUID();
    await post(
      context,
      { kind: "offer", other: bob.id, give: [card], take: [bc], feeEach: 0 },
      offer,
    );
    await post(b, { kind: "accept", swap: offer, feeEach: 0 });
    assert.equal(financialReport(state).swapFees, 0);
    checks.push(
      "Cancellation and free swap, unchanged commission; test proceeds never withdrawable",
    );
    // Execute once but lose the response; production component retains the same key.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Review listing" }).first(),
    ).toBeVisible();
    let lost = false;
    await page.route("**/api/test-wallet", async (route) => {
      if (route.request().method() === "POST" && !lost) {
        lost = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await page.getByRole("button", { name: "Review listing" }).first().click();
    await expect(
      page.getByRole("button", { name: "Retry pending transaction" }),
    ).toBeVisible();
    const count = Object.keys(state.listings).length;
    await page.reload();
    await page
      .getByRole("button", { name: "Retry pending transaction" })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry pending transaction" }),
    ).toHaveCount(0);
    assert.equal(Object.keys(state.listings).length, count);
    checks.push(
      "Lost response and page restart: same persisted request recovers without duplicate listing",
    );
    const bad = await context.request.post(origin + "/api/test-wallet", {
      data: {
        request: randomUUID(),
        command: {
          kind: "withdraw",
          amount: 100,
          beneficiary: "x",
          confirmed: true,
          policy: state.policy.version,
        },
      },
    });
    assert.equal(bad.status(), 400);
    const insufficient = await b.request.post(origin + "/api/test-wallet", {
      data: {
        request: randomUUID(),
        command: {
          ...command,
          product: "premium-nine-seven-test-v2",
          configuration:
            state.economy!.products["premium-nine-seven-test-v2"].version,
        },
      },
    });
    assert.equal(insufficient.status(), 400);
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 412, height: 915 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Test wallet", exact: true }),
      ).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const axe = await new AxeBuilder({ page }).analyze();
      writeFileSync(
        "docs/qa/barry-review/local-wallet/accessibility-detail.json",
        JSON.stringify(
          axe.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          null,
          2,
        ),
      );
      await page.screenshot({ path: "docs/qa/barry-review/local-wallet/current.png" });
      assert.deepEqual(
        axe.violations.map((v) => v.id),
        [],
      );
      if (viewport.width < 600)
        await expect(
          page
            .getByRole("navigation", { name: "Mobile app navigation" })
            .getByRole("link", { name: "Market", exact: true }),
        ).toHaveAttribute("aria-current", "page");
      await page.screenshot({
        path: `docs/qa/barry-review/local-wallet/wallet-${viewport.width}.png`,
      });
    }
    assert.deepEqual(errors, []);
    assert.equal(financialReport(state).circulation.difference, 0);
    checks.push(
      "360/412/1440 viewport accessibility and no overflow/console errors; blocked withdrawals, insufficient funds",
    );
    writeFileSync(
      "docs/qa/barry-review/local-wallet/local-browser.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          passed: true,
          scope:
            "Actual component + engine, local synthetic auth; NOT hosted auth or physical Android",
          checks,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(JSON.stringify({ passed: true, checks }));
    await b.close();
    await context.close();
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
