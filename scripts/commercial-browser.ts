import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import type { CommercialLedger } from "../src/server/commercial-ledger";
import { CommercialMemberView } from "../src/server/commercial-member-view";
import { commercialCard } from "../src/core/commercial-presentation";
import { bundleCommunityFixture } from "../tests/fixtures/bundle-community";
/** Loopback fixture transport, not hosted auth acceptance or a bypass in the app. */
export async function commercialBrowser(
  ledger: CommercialLedger,
  member: string,
) {
  const reportDir =
    process.env.DOCKED_DB_TEST_REPORT_DIR ??
    "docs/qa/commercial-billing-20261101";
  if (
    ledger.environment !== "acceptance" ||
    new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "").hostname !== "127.0.0.1"
  )
    throw Error("Isolated acceptance required");
  const view = new CommercialMemberView(ledger, member, async () => {}),
    script = await bundleCommunityFixture(
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
  const server = createServer(async (req, res) => {
    const u = new URL(req.url!, "http://127.0.0.1");
    const json = (v: unknown) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(v));
    };
    try {
      if (u.pathname === "/local-identity") return json({ member });
      if (u.pathname === "/api/admin/commercial-billing") {
        if (req.method !== "GET")
          throw Error("Read-only owner presentation fixture");
        return json({
          report: await ledger.financialReport(),
          jobs: { attention: 0, overdue: 0, completed: 1 },
          cases:
            await ledger.sql`select id,member_id,exposure_credits,reason,state,revision,created_at from commercial_billing.recovery_cases where state='OPEN' order by created_at,id limit 50`,
        });
      }
      if (u.pathname === "/api/sports-beta")
        return json({ allowed: ["afl", "nrl"] });
      if (u.pathname === "/api/workspace-wallet") {
        const s = await view.packs();
        return json({ state: { ...s, wallet: await ledger.wallet(member) } });
      }
      if (u.pathname === "/api/fantasy/collection")
        return json(await view.collection(Object.fromEntries(u.searchParams)));
      if (u.pathname === "/api/store/google/commercial") {
        if (req.method === "GET")
          return json(
            u.searchParams.get("view") === "wallet"
              ? { member, wallet: await ledger.wallet(member) }
              : await view.packs(Number(u.searchParams.get("offset") ?? 0)),
          );
        let raw = "";
        for await (const c of req) raw += c;
        const body = JSON.parse(raw);
        if (u.searchParams.get("action") === "pack")
          return json(
            await ledger.buyPack(member, body.request, body, async () => {}),
          );
        if (u.searchParams.get("action") === "open") {
          const r = await ledger.openPack(member, body.id, async () => {});
          return json({
            id: r.pack,
            name: r.product.name,
            opened_at: r.openedAt,
            cards: r.cards.map((c) =>
              commercialCard(c as Parameters<typeof commercialCard>[0]),
            ),
          });
        }
        throw Error("Only isolated pack actions allowed");
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
        assert.ok(file.startsWith(resolve("public") + sep));
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
        return json({ error: "Isolated fixture" });
      }
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked isolated commercial acceptance</title><link rel="stylesheet" href="/fixture.css"></head><body class="fantasy-mode"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>',
      );
    } catch (e) {
      res.statusCode = 400;
      json({ error: (e as Error).message, outcome: "rejected" });
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const browser = await chromium.launch({ channel: "msedge" }),
    checks = [];
  try {
    for (const sport of ["nfl", "afl", "nrl"]) {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "/fantasy/cards?tab=packs&sport=" + sport);
      await expect(
        page.getByRole("heading", {
          name: sport.toUpperCase() + " Packs",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".pack-product")).toHaveCount(6);
      assert.equal(await page.getByText("NBA", { exact: true }).count(), 0);
      const before = (await ledger.wallet(member)).balance;
      await page
        .getByRole("button", { name: "Buy Standard 9 Pack", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText("700");
      for (const chance of ["85%", "12%", "2.5%", "0.49%", "0.01%"])
        await expect(
          page
            .getByRole("dialog")
            .getByRole("cell", { name: chance, exact: true }),
        ).toBeVisible();
      assert.equal((await ledger.wallet(member)).balance, before);
      await page
        .getByRole("button", { name: "Confirm Purchase", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: /Open pack/i }).first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: /Open pack/i })
        .first()
        .click();
      await expect(
        page
          .getByRole("button", {
            name: /^(Reveal All|Skip remaining reveals)$/,
          })
          .first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: /^(Reveal All|Skip remaining reveals)$/ })
        .first()
        .click();
      await expect(
        page.getByRole("button", { name: "Buy another pack", exact: true }),
      ).toBeVisible();
      assert.equal((await ledger.wallet(member)).balance, before - 700);
      await page
        .getByRole("button", { name: "Buy another pack", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Confirm Purchase", exact: true }),
      ).toBeVisible();
      assert.equal((await ledger.wallet(member)).balance, before - 700);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.screenshot({
        path: `${reportDir}/${sport}-reveal-390.png`,
        fullPage: true,
      });
      await page.goto(origin + "/fantasy/cards?sport=" + sport);
      await expect(page.locator(".owned-tile")).toHaveCount(9);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `${reportDir}/${sport}-collection-390.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({
        path: `${reportDir}/${sport}-collection-1440.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      checks.push({
        sport,
        pack: "STANDARD 9",
        charged: 700,
        cards: 9,
        confirmationBeforeCharge: true,
        mobile: 390,
        desktop: 1440,
        pageErrors: errors,
      });
      await page.close();
    }
    const premium = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await premium.goto(origin + "/fantasy/cards?tab=packs&sport=afl");
    const premiumBefore = (await ledger.wallet(member)).balance;
    await premium
      .getByRole("button", { name: "Buy Premium 9 Pack", exact: true })
      .click();
    await expect(premium.getByRole("dialog")).toContainText("5,000");
    for (const chance of ["90%", "9.9%", "0.1%"])
      await expect(
        premium
          .getByRole("dialog")
          .getByRole("cell", { name: chance, exact: true }),
      ).toBeVisible();
    assert.equal((await ledger.wallet(member)).balance, premiumBefore);
    await premium
      .getByRole("button", { name: "Confirm Purchase", exact: true })
      .click();
    await premium
      .getByRole("button", { name: /Open pack/i })
      .first()
      .click();
    await premium
      .getByRole("button", { name: /^(Reveal All|Skip remaining reveals)$/ })
      .first()
      .click();
    await expect(
      premium.getByRole("button", { name: "Buy another pack", exact: true }),
    ).toBeVisible();
    assert.equal((await ledger.wallet(member)).balance, premiumBefore - 5000);
    await premium.screenshot({
      path: `${reportDir}/afl-premium-reveal-390.png`,
      fullPage: true,
    });
    checks.push({
      sport: "afl",
      pack: "PREMIUM 9",
      charged: 5000,
      cards: 9,
      confirmationBeforeCharge: true,
      mobile: 390,
      desktop: 0,
      pageErrors: [],
    });
    await premium.close();
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.goto(origin + "/fantasy/test-wallet");
    await expect(
      page.getByRole("heading", { name: "Docked Credits", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `${reportDir}/wallet-390.png`,
      fullPage: true,
    });
    await page.goto(origin + "/admin/commercial-billing");
    await expect(
      page.getByRole("heading", {
        name: "Commercial billing review",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Recovery reviews/ }),
    ).toBeVisible();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `${reportDir}/owner-review-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Review hold", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Confirm waiver", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Internal decision reason")
      .fill("Isolated preview only; no waiver submitted");
    await expect(
      page.getByRole("button", { name: "Confirm waiver", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    writeFileSync(
      `${reportDir}/browser.json`,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          transport: "loopback fixture",
          database: "real isolated PostgreSQL",
          googleCheckout: false,
          hostedAuthenticated: false,
          ownerPresentation: {
            widths: [390, 1440],
            explicitReasonRequired: true,
            actualOwnerAuth: false,
            decisionsSubmitted: 0,
          },
          checks,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    const page = browser.contexts().at(-1)?.pages().at(-1);
    if (page)
      await page.screenshot({
        path: `${reportDir}/browser-failure.png`,
        fullPage: true,
      });
    throw e;
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
