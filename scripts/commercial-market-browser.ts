import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
import { CommercialMarketView } from "../src/server/commercial-market-view";
import { CommercialMemberView } from "../src/server/commercial-member-view";
import type { CommercialMarketLedger } from "../src/server/commercial-market-ledger";
import { sellerQuote } from "../src/core/credits-policy";
import type { Sql } from "postgres";
/** Only disposable native PostgreSQL and loopback HTTP. No hosted auth bypass. */
export async function commercialMarketBrowser(
  ledger: CommercialMarketLedger,
  seller: string,
  buyer: string,
  access: (member: string) => Parameters<CommercialMarketLedger["command"]>[2],
  version: string,
  listing: string,
) {
  assert.equal(ledger.environment, "acceptance");
  assert.equal(
    new URL(process.env.AUSTRALIAN_SALARY_TEST_DB!).hostname,
    "127.0.0.1",
  );
  const script = await bundleCommunityFixture(
    "tests/fixtures/commercial-member.tsx",
  );
  const css =
    [
      ...readFileSync("src/app/layout.tsx", "utf8").matchAll(
        /import "\.\/([^"\n]+\.css)"/g,
      ),
    ]
      .map((m) => readFileSync("src/app/" + m[1], "utf8"))
      .join("\n") +
    "\n" +
    readFileSync("src/app/test-wallet.css", "utf8");
  let origin = "";
  const timings: number[] = [];
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://127.0.0.1");
    const json = (value: unknown) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
    };
    try {
      const member = req.headers["x-isolated-member"];
      assert(member === seller || member === buyer);
      if (u.pathname === "/local-identity") return json({ member });
      if (u.pathname === "/api/sports-beta")
        return json({ allowed: ["afl", "nrl"] });
      if (u.pathname === "/api/workspace-wallet")
        return json({
          state: await new CommercialMemberView(ledger, member, async () => {
            await ledger.sql.begin((raw) =>
              access(member).actor(raw as unknown as Sql),
            );
          }).summary(),
        });
      if (u.pathname === "/api/marketplace/quote")
        return json(sellerQuote(Number(u.searchParams.get("price"))));
      if (u.pathname === "/api/marketplace") {
        const start = performance.now();
        let result = null;
        if (req.method === "POST") {
          assert.equal(req.headers.origin, origin);
          const chunks: Buffer[] = [];
          let n = 0;
          for await (const chunk of req) {
            n += chunk.length;
            assert(n <= 8192);
            chunks.push(chunk);
          }
          result = await ledger.command(
            member,
            JSON.parse(Buffer.concat(chunks).toString()),
            access(member),
          );
        } else assert.equal(req.method, "GET");
        const state = await new CommercialMarketView(
          ledger,
          member,
          access(member).actor,
          { terms: version, privacy: version },
          true,
        ).read(Object.fromEntries(u.searchParams));
        timings.push(Math.round(performance.now() - start));
        return json({ state, result });
      }
      if (u.pathname === "/fixture.js") {
        res.setHeader("Content-Type", "text/javascript");
        return res.end(script);
      }
      if (u.pathname === "/fixture.css") {
        res.setHeader("Content-Type", "text/css");
        return res.end(css);
      }
      if (/^\/(brand|images|fonts)\//.test(u.pathname)) {
        const file = resolve("public", "." + u.pathname);
        assert(file.startsWith(resolve("public") + sep));
        res.setHeader(
          "Content-Type",
          file.endsWith(".svg")
            ? "image/svg+xml"
            : file.endsWith(".webp")
              ? "image/webp"
              : file.endsWith(".woff2")
                ? "font/woff2"
                : "image/png",
        );
        return res.end(readFileSync(file));
      }
      if (u.pathname.startsWith("/api/")) {
        res.statusCode = 403;
        return json({ error: "Isolated fixture endpoint unavailable" });
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    } catch (e) {
      res.statusCode = 400;
      json({
        error: e instanceof Error ? e.message : "Isolated operation refused",
        outcome: "rejected",
      });
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const browser = await chromium.launch({ channel: "msedge" });
  const errors: string[] = [];
  try {
    const sellerPage = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { "x-isolated-member": seller },
      reducedMotion: "reduce",
    });
    const buyerPage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { "x-isolated-member": buyer },
      reducedMotion: "reduce",
    });
    for (const page of [sellerPage, buyerPage]) {
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
    }
    await sellerPage.goto(origin + "/fantasy/market?tab=listings&sport=nfl");
    await expect(
      sellerPage.getByText("Docked Credits · No cash withdrawals.", {
        exact: true,
      }),
    ).toBeVisible();
    await sellerPage
      .getByRole("button", { name: "Manage listing" })
      .first()
      .click();
    await sellerPage.getByLabel("New asking price").fill("1200");
    await expect(
      sellerPage.getByText("1,140 credits", { exact: true }),
    ).toBeVisible();
    await sellerPage
      .getByRole("button", { name: "Save price", exact: true })
      .click();
    await expect(
      sellerPage.getByRole("heading", { name: "Price saved" }),
    ).toBeVisible();
    const before = (await ledger.wallet(buyer)).balance;
    await buyerPage.goto(
      origin + "/fantasy/market?listing=" + listing + "&sport=nfl",
    );
    await buyerPage
      .getByRole("button", { name: "Review purchase", exact: true })
      .click();
    await expect(
      buyerPage.getByText("You pay 1,200 credits.", { exact: true }),
    ).toBeVisible();
    assert.equal((await ledger.wallet(buyer)).balance, before);
    await buyerPage
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .click();
    await expect(
      buyerPage.getByRole("button", { name: "Continue Browsing", exact: true }),
    ).toBeVisible();
    assert.equal((await ledger.wallet(buyer)).balance, before - 1200);
    // A confirmed purchase must also remove the stale active listing, without
    // waiting for navigation or the ten-second background polling interval.
    await expect(
      buyerPage.getByRole("button", { name: "Buy card", exact: true }),
    ).toHaveCount(0, { timeout: 5000 });
    await buyerPage.screenshot({
      path: "docs/qa/v31-revenue-launch-20261113/market-purchase-mobile.png",
      fullPage: true,
    });
    await buyerPage
      .getByRole("button", { name: "Continue Browsing", exact: true })
      .click();
    await buyerPage.goto(origin + "/fantasy/market?tab=activity&sport=nfl");
    await expect(buyerPage.locator(".market-activity")).toContainText("1,200");
    await sellerPage.goto(origin + "/fantasy/market?tab=activity&sport=nfl");
    await expect(sellerPage.locator(".market-activity")).toContainText("1,140");
    const cancelled = sellerPage
      .locator(".market-activity article")
      .filter({ hasText: "No credits exchanged" });
    await expect(cancelled).toHaveCount(1);
    await expect(cancelled).not.toContainText("Bought");
    await expect(
      sellerPage.getByText("Balance refresh unavailable", { exact: false }),
    ).toHaveCount(0);
    await sellerPage.screenshot({
      path: "docs/qa/v31-revenue-launch-20261113/market-sale-desktop.png",
      fullPage: true,
    });
    await sellerPage
      .locator(".market-activity article")
      .filter({ hasText: "1,140" })
      .getByRole("button", { name: "Transaction details" })
      .click();
    await expect(sellerPage.locator(".market-activity > article")).toHaveCount(
      1,
    );
    await expect(sellerPage.locator(".market-activity")).toContainText("1,140");
    assert.equal(await buyerPage.getByText("NBA", { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    const sorted = timings.toSorted((a, b) => a - b);
    const report = {
      at: new Date().toISOString(),
      transport: "loopback fixture",
      database: "native isolated PostgreSQL",
      hostedAuth: false,
      genuineGooglePayment: false,
      syntheticMembers: 2,
      widths: [390, 1440],
      checks: [
        "commercial label",
        "seller fee quote and reprice",
        "buyer reviewed exact changed price",
        "no debit before confirmation",
        "one atomic debit and ownership receipt",
        "mobile purchase celebration",
        "buyer and seller activity",
        "cancellation shown without invented payment",
        "transaction details target exact listing",
        "commercial wallet header loads",
        "NBA hidden",
        "zero browser runtime errors",
      ],
      requests: timings.length,
      localRequestP95Ms: sorted[Math.floor((sorted.length - 1) * 0.95)],
      productionWrites: 0,
    };
    writeFileSync(
      "docs/qa/v31-revenue-launch-20261113/market-browser.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  } catch (e) {
    await browser.contexts().at(-1)?.pages().at(-1)?.screenshot({
      path: "docs/qa/v31-revenue-launch-20261113/market-browser-failure.png",
      fullPage: true,
    });
    throw e;
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
